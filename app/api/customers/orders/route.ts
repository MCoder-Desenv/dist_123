
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get('customer_id');
    const company_id = searchParams.get('company_id');

    if (!customer_id || !company_id) {
      return NextResponse.json(
        { error: 'customer_id e company_id são obrigatórios' },
        { status: 400 }
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        customer_id,
        company_id,
      },
      include: {
        order_items: {
          include: {
            product: {
              select: {
                name: true,
                image_url: true,
              },
            },
            variant: {
              select: {
                name: true,
                image_url: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos' },
      { status: 500 }
    );
  }
}
