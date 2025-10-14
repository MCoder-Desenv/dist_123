import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Rota pública: POST /api/public/orders
 *
 * Body esperado (exemplo normal):
 * {
 *   company_id: string,
 *   customer_id?: string | null,
 *   customer_name: string,
 *   customer_email: string,
 *   customer_phone?: string | null,
 *   delivery_type: 'DELIVERY' | 'RETIRADA',
 *   payment_method: string,
 *   delivery_address?: { address, numeric, city, state, zip_code } | null,
 *   notes?: string,
 *   items: [{ product_id, variant_id?, quantity }]
 * }
 *
 * Para recomprar um pedido antigo envie:
 * {
 *   company_id: string,
 *   customer_id?: string | null,
 *   customer_name: string,
 *   customer_email: string,
 *   payment_method: string,
 *   delivery_type: 'DELIVERY' | 'RETIRADA',
 *   reorder_from_order_id: string
 * }
 *
 * Observações:
 * - Esta rota NÃO exige sessão (pública).
 * - Os preços são recalculados a partir dos produtos/variantes atuais.
 */

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

    // Recalcular preços com base nos produtos atualmente ativos da company
    let subtotal = 0;
    const orderItemsToCreate: any[] = [];

    for (const item of validated.items) {
      const product = await prisma.product.findFirst({
        where: {
          id: item.product_id,
          company_id: companyId,
          active: true,
        },
        include: {
          variants: {
            where: {
              id: item.variant_id || undefined,
              active: true,
            },
          },
        },
      });

      if (!product) {
        return NextResponse.json({ success: false, error: `Produto não encontrado: ${item.product_id}` }, { status: 400 });
      }

      let unitPrice = Number(product.base_price || 0);

      if (item.variant_id && product.variants.length > 0) {
        const variant = product.variants[0];
        unitPrice += Number(variant.price_modifier || 0);
      }

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItemsToCreate.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      });
    }

    const deliveryFee = 0; // se necessário, calcule aqui com base em regras
    const totalAmount = subtotal + deliveryFee;

    // Criar pedido + financial entry dentro de transação para consistência
    const result = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          company_id: companyId,
          user_id: null,
          customer_id: validated.customer_id || null,
          // >>> Ajuste aqui: garantir que customer_phone seja string (não null)
          customer_phone: validated.customer_phone ?? '',
          customer_name: validated.customer_name,
          customer_email: validated.customer_email,
          delivery_address: validated.delivery_address || null,
          delivery_type: validated.delivery_type,
          payment_method: validated.payment_method,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          notes: validated.notes || null,
          status: 'RECEBIDO',
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

      // criar audit log (se disponível)
      try {
        // >>> Ajuste aqui: createAuditLog espera user_id?: string, então passe undefined em vez de null
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
        console.error('Erro ao criar audit log (não crítico):', auditErr);
      }

      return createdOrder;
    });

    return NextResponse.json({
      success: true,
      message: 'Pedido criado com sucesso!',
      data: result,
    }, { status: 201 });

  } catch (error) {
    console.error('Public Orders POST error:', error);

    // tentativa de mapear erros de validação / zod
    if (error && typeof error === 'object' && 'issues' in (error as any)) {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: (error as any).issues }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}