
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Relatório de vendas
export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const allowedRoles = ['ADMINISTRADOR', 'SUB_MASTER', 'MASTER_DIST', 'FINANCEIRO', 'LEITURA'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      company_id: session.user.company_id!,
      status: { not: 'CANCELADO' },
    };

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    // Buscar pedidos com itens
    const orders = await prisma.order.findMany({
      where,
      include: {
        order_items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            variant: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Análises
    const totalVendas = orders.reduce((acc, order) => acc + Number(order.total_amount), 0);
    const totalPedidos = orders.length;
    const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

    // Vendas por dia
    const vendasPorDia: Record<string, number> = {};
    orders.forEach((order) => {
      const dia = order.created_at.toISOString().split('T')[0];
      vendasPorDia[dia] = (vendasPorDia[dia] || 0) + Number(order.total_amount);
    });

    // Produtos mais vendidos
    const produtosMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    orders.forEach((order) => {
      order.order_items.forEach((item) => {
        const key = item.product_id;
        if (!produtosMap[key]) {
          produtosMap[key] = {
            name: item.product.name,
            quantity: 0,
            revenue: 0,
          };
        }
        produtosMap[key].quantity += item.quantity;
        produtosMap[key].revenue += Number(item.total_price);
      });
    });

    const produtosMaisVendidos = Object.entries(produtosMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Vendas por categoria
    const categoriaMap: Record<string, { name: string; revenue: number; quantity: number }> = {};
    orders.forEach((order) => {
      order.order_items.forEach((item) => {
        const categoryName = item.product.category?.name || 'Sem categoria';
        if (!categoriaMap[categoryName]) {
          categoriaMap[categoryName] = { name: categoryName, revenue: 0, quantity: 0 };
        }
        categoriaMap[categoryName].revenue += Number(item.total_price);
        categoriaMap[categoryName].quantity += item.quantity;
      });
    });

    const vendasPorCategoria = Object.values(categoriaMap).sort((a, b) => b.revenue - a.revenue);

    // Métodos de pagamento
    const metodosPagamento: Record<string, number> = {};
    orders.forEach((order) => {
      metodosPagamento[order.payment_method] =
        (metodosPagamento[order.payment_method] || 0) + 1;
    });

    // Tipos de entrega
    const tiposEntrega: Record<string, number> = {};
    orders.forEach((order) => {
      tiposEntrega[order.delivery_type] = (tiposEntrega[order.delivery_type] || 0) + 1;
    });

    return NextResponse.json({
      resumo: {
        totalVendas,
        totalPedidos,
        ticketMedio,
      },
      vendasPorDia,
      produtosMaisVendidos,
      vendasPorCategoria,
      metodosPagamento,
      tiposEntrega,
      orders,
    });
  } catch (error) {
    console.error('Erro ao gerar relatório de vendas:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
