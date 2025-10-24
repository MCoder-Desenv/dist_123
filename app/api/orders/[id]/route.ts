import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Helpers

function mapOrderToFrontend(order: any) {
  const deliveryAddress = order.delivery_address as any;

  return {
    id: order.id,
    order_number: order.id.substring(0, 8).toUpperCase(),
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    customer_cnpj_cpf: order.customer_cnpj_cpf,
    delivery_type: order.delivery_type,
    payment_method: order.payment_method,
    status: order.status,
    subtotal: Number(order.subtotal),
    delivery_fee: Number(order.delivery_fee),
    total: Number(order.total_amount),
    notes: order.notes,
    address: deliveryAddress?.street || deliveryAddress?.address,
    city: deliveryAddress?.city,
    state: deliveryAddress?.state,
    zip_code: deliveryAddress?.zip_code || deliveryAddress?.zipCode,
    created_at: order.created_at.toISOString(),
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      product_name: item.product?.name ?? '',
      variant_name: item.variant?.name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      subtotal: Number(item.total_price),
    })),
  };
}

const ALLOWED_STATUS = [
  'RECEBIDO',
  'EM_SEPARACAO',
  'PRONTO',
  'EM_ROTA',
  'ENTREGUE',
  'CANCELADO',
] as const;

type PutBody = {
  status?: (typeof ALLOWED_STATUS)[number] | OrderStatus;
  notes?: string | null;
};

// GET /api/orders/[id] - Obter pedido
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const orderId = params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: {
            product: { select: { name: true, image_url: true } },
            variant: { select: { name: true, volume: true, unit_type: true } },
          },
        },
        user: { select: { first_name: true, last_name: true, email: true } },
        company: { select: { name: true, logo_url: true } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    // Autorização por empresa
    if (!canAccessCompany(session.user.company_id, order.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar este pedido' },
        { status: 403 }
      );
    }

    const mappedOrder = mapOrderToFrontend(order);

    return NextResponse.json({ success: true, data: mappedOrder });
  } catch (error) {
    console.error('Order GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id] - Atualizar pedido (status/notes)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Permissões
    const hasPerm = hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST', 'ATENDENTE']);

    if (!hasPerm) {
      console.warn('[PUT /api/orders/:id] Bloqueado por role');
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const orderId = params.id;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        company_id: true,
        status: true,
        notes: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    const canAccess = canAccessCompany(session.user.company_id, existingOrder.company_id);

    if (!canAccess) {
      console.warn('[PUT /api/orders/:id] Bloqueado por empresa diferente');
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar este pedido' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PutBody;

    const { status, notes } = body ?? {};

    const updateData: Record<string, any> = {};
    if (typeof status !== 'undefined') updateData.status = status;
    if (typeof notes !== 'undefined') updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum campo válido para atualizar' },
        { status: 400 }
      );
    }

    if (typeof status !== 'undefined') {
      const statusStr = String(status);
      const valid = ALLOWED_STATUS.includes(statusStr as (typeof ALLOWED_STATUS)[number]);
      const prismaValid = Object.values(OrderStatus).map(String).includes(statusStr);

      if (!valid && !prismaValid) {
        return NextResponse.json(
          { success: false, error: 'Status inválido' },
          { status: 400 }
        );
      }
      updateData.status = statusStr as OrderStatus;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        order_items: {
          include: {
            product: { select: { name: true, image_url: true } },
            variant: { select: { name: true, volume: true, unit_type: true } },
          },
        },
        user: { select: { first_name: true, last_name: true, email: true } },
        company: { select: { name: true, logo_url: true } },
      },
    });

    if (
      typeof status !== 'undefined' &&
      String(status) === 'ENTREGUE' &&
      existingOrder.status !== 'ENTREGUE'
    ) {
      const feResult = await prisma.financialEntry.updateMany({
        where: {
          order_id: orderId,
          type: 'RECEITA',
          status: 'PENDENTE',
        },
        data: {
          status: 'PAGO',
          paid_date: new Date(),
        },
      });
    }

    await createAuditLog({
      company_id: existingOrder.company_id,
      user_id: session.user.id,
      entity_type: 'Order',
      entity_id: orderId,
      action: 'UPDATE',
      old_values: {
        status: existingOrder.status,
        notes: existingOrder.notes,
      },
      new_values: updateData,
    });

    const mappedOrder = mapOrderToFrontend(updated);

    return NextResponse.json({
      success: true,
      message: 'Pedido atualizado com sucesso!',
      data: mappedOrder,
    });
  } catch (error) {
    console.error('Order PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}