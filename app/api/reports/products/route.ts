
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Relatório de produtos
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

    // Buscar produtos com suas vendas
    const products = await prisma.product.findMany({
      where: {
        company_id: session.user.company_id!,
      },
      include: {
        category: true,
        variants: true,
        order_items: {
          where: {
            order: {
              status: { not: 'CANCELADO' },
            },
          },
          include: {
            order: true,
          },
        },
      },
    });

    const productsReport = products.map((product) => {
      const totalVendido = product.order_items.reduce((acc, item) => acc + item.quantity, 0);
      const receitaTotal = product.order_items.reduce(
        (acc, item) => acc + Number(item.total_price),
        0
      );

      return {
        id: product.id,
        name: product.name,
        category: product.category?.name || 'Sem categoria',
        sku: product.sku,
        base_price: Number(product.base_price),
        active: product.active,
        variants_count: product.variants.length,
        total_vendido: totalVendido,
        receita_total: receitaTotal,
      };
    });

    return NextResponse.json({
      products: productsReport,
      total_products: products.length,
      active_products: products.filter((p) => p.active).length,
    });
  } catch (error) {
    console.error('Erro ao gerar relatório de produtos:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
