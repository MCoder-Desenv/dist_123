import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyFilter } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user || !session.user.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const companyId = session.user.company_id;

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('start_date'); // YYYY-MM-DD
    const endDateParam = searchParams.get('end_date');

    const companyFilter = getCompanyFilter(session);
    const where: any = { ...companyFilter };

    // Aplicar filtro de data
    if (startDateParam || endDateParam) {
        where.created_at = {};

        if (startDateParam) {
            // Interpreta como horário local do servidor, não UTC puro
            const start = new Date(`${startDateParam}T00:00:00`);
            where.created_at.gte = start;
        }

        if (endDateParam) {
            const end = new Date(`${endDateParam}T23:59:59.999`);
            where.created_at.lte = end;
        }
    }

    const [
      total_orders,
      total_revenue,
      total_products,
      pending_orders
    ] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where,
        _sum: { total_amount: true }
      }),
      prisma.product.count({
        where: {
          company_id: companyId,
          active: true
        }
      }),
      prisma.order.count({
        where: {
          ...companyFilter,
          status: 'RECEBIDO'
        }
      })
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayWhere = {
      ...companyFilter,
      created_at: {
        gte: today,
        lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      }
    };

    const [orders_today, revenue_today] = await Promise.all([
      prisma.order.count({ where: todayWhere }),
      prisma.order.aggregate({
        where: todayWhere,
        _sum: { total_amount: true }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total_orders,
        orders_today: orders_today,
        total_revenue: Number(total_revenue._sum.total_amount || 0),
        revenue_today: Number(revenue_today._sum.total_amount || 0),
        total_products,
        pending_orders
      }
    });

  } catch (error) {
    console.error('Stats GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}