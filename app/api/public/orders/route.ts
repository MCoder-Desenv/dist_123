import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';
import { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // company_id é obrigatório
    const companyId = body.company_id;
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'ID da empresa é obrigatório' }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId, active: true } });
    if (!company) {
      return NextResponse.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Se veio reorder_from_order_id: buscar o pedido e reconstruir items
    let itemsFromRequest = Array.isArray(body.items) ? body.items : [];

    if (body.reorder_from_order_id) {
      const oldOrder = await prisma.order.findUnique({
        where: { id: body.reorder_from_order_id },
        include: { order_items: true },
      });

      if (!oldOrder) {
        return NextResponse.json({ success: false, error: 'Pedido para recomprar não encontrado' }, { status: 404 });
      }

      // garante que o pedido pertence à mesma empresa
      if (oldOrder.company_id !== companyId) {
        return NextResponse.json({ success: false, error: 'Pedido não pertence a essa empresa' }, { status: 400 });
      }

      // mapear itens do pedido antigo para o formato esperado
      itemsFromRequest = oldOrder.order_items.map((it) => ({
        product_id: it.product_id,
        variant_id: it.variant_id ?? null,
        quantity: it.quantity,
      }));
    }

    // Montar um objeto que siga a estrutura esperada pelo validation schema
    const payloadForValidation = {
      ...body,
      items: itemsFromRequest,
    };

    // Validar com orderSchema (zod) - lançará se inválido
    const validated = orderSchema.parse(payloadForValidation);

    // Usar transação para validar (leitura) e criar de forma atômica, evitando condições de corrida.
    const createdOrder = await prisma.$transaction(async (tx) => {

      let subtotal = 0;
      const orderItemsToCreate: any[] = [];

      for (const item of validated.items) {

        // Buscar produto garantindo company_id e active usando tx
        const product = await tx.product.findFirst({
          where: {
            id: item.product_id,
            company_id: companyId,
            active: true,
          },
        });

        if (!product) {
          // lançar erro identificável para ser capturado fora da transação
          const msg = `VALIDATION:PRODUCT_NOT_FOUND:${item.product_id}`;
          throw new Error(msg);
        }

        let unitPrice = Number(product.base_price ?? 0);

        // Se houver variant_id, validar explicitamente que a variação existe,
        // pertence ao produto e está ativa antes de usar seu price_modifier
        if (item.variant_id) {

          const variant = await tx.productVariant.findUnique({
            where: { id: item.variant_id },
          });

          if (!variant) {
            const msg = `VALIDATION:VARIANT_NOT_FOUND:${item.variant_id}`;
            throw new Error(msg);
          }

          if (variant.product_id !== product.id) {
            const msg = `VALIDATION:VARIANT_MISMATCH:${item.product_id}:${item.variant_id}`;
            throw new Error(msg);
          }

          if (!variant.active) {
            const msg = `VALIDATION:VARIANT_INACTIVE:${item.variant_id}`;
            throw new Error(msg);
          }

          unitPrice += Number(variant.price_modifier ?? 0);
        }

        const quantity = Number(item.quantity ?? 0);
        const totalPrice = unitPrice * quantity;
        subtotal += totalPrice;

        orderItemsToCreate.push({
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
        });

      }

      const deliveryFee = 0; // ajustar conforme necessidade
      const totalAmount = subtotal + deliveryFee;

      // Criar pedido com nested create dos order_items
      const createdOrder = await tx.order.create({
        data: {
          company_id: companyId,
          user_id: null,
          customer_id: validated.customer_id || null,
          customer_cnpj_cpf: validated.customer_cnpj_cpf || '',
          customer_phone: validated.customer_phone || null,
          customer_name: validated.customer_name,
          customer_email: validated.customer_email || null,
          delivery_address: validated.delivery_address || null,
          delivery_type: validated.delivery_type,
          payment_method: validated.payment_method,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          notes: validated.notes || null,
          // usa enum do Prisma para não quebrar o TypeScript
          status: OrderStatus.RECEBIDO,
          order_items: {
            create: orderItemsToCreate,
          },
        },
        include: {
          order_items: {
            include: {
              product: { select: { name: true } },
              variant: { select: { name: true, volume: true, unit_type: true } },
            },
          },
        },
      });

      // Criar lançamento financeiro dentro da mesma transação
      await tx.financialEntry.create({
        data: {
          company_id: companyId,
          order_id: createdOrder.id,
          type: 'RECEITA',
          amount: totalAmount,
          description: `Pedido #${createdOrder.id}`,
          payment_method: validated.payment_method,
          due_date: new Date(),
          status: 'PENDENTE',
        },
      });

      return createdOrder;
    });

    // Fora da tx: criar audit log (não faz parte da transação DB)
    try {
      await createAuditLog({
        company_id: companyId,
        user_id: undefined,
        entity_type: 'Order',
        entity_id: createdOrder.id,
        action: 'CREATE',
        new_values: {
          customer_name: createdOrder.customer_name,
          total_amount: createdOrder.total_amount,
          status: createdOrder.status,
        },
      });
    } catch (auditErr) {
      console.error('[Public Orders POST] error creating audit log (non-blocking):', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Pedido criado com sucesso!',
      data: createdOrder,
    }, { status: 201 });

  } catch (error) {
    console.error('Public Orders POST error:', error);

    // Interceptar erros lançados pela validação dentro da transação
    if (error instanceof Error && error.message && error.message.startsWith('VALIDATION:')) {
      const parts = error.message.split(':');
      const code = parts[1];
      const payload = parts.slice(2).join(':');

      switch (code) {
        case 'PRODUCT_NOT_FOUND':
          return NextResponse.json({ success: false, error: `Produto não encontrado: ${payload}` }, { status: 400 });
        case 'VARIANT_NOT_FOUND':
          return NextResponse.json({ success: false, error: `Variação não encontrada: ${payload}` }, { status: 400 });
        case 'VARIANT_MISMATCH':
          // payload = `${productId}:${variantId}`
          return NextResponse.json({ success: false, error: `Variação inválida para o produto: ${payload}` }, { status: 400 });
        case 'VARIANT_INACTIVE':
          return NextResponse.json({ success: false, error: `Variação inativa: ${payload}` }, { status: 400 });
        default:
          return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
      }
    }

    // tentativa de mapear erros de validação / zod
    if (error && typeof error === 'object' && 'issues' in (error as any)) {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: (error as any).issues }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}