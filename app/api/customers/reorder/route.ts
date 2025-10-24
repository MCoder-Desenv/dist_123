import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { order_id, customer_id, payment_method, company_id, cnpj_cpf, delivery_type, delivery_address, notes } = data;

    if (!order_id || !customer_id || !company_id) {
      return NextResponse.json(
        { error: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Buscar pedido original
    const originalOrder = await prisma.order.findUnique({
      where: { id: order_id },
      include: {
        order_items: {
          include: {
            product: true,
            variant: true,
          },
        },
        customer: true,
      },
    });

    if (!originalOrder || originalOrder.customer_id !== customer_id) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    // Calcular novos valores
    const subtotal = originalOrder.order_items.reduce((sum, item) => {
      const price = item.variant 
        ? parseFloat(item.product.base_price.toString()) + parseFloat(item.variant.price_modifier.toString())
        : parseFloat(item.product.base_price.toString());
      return sum + (price * item.quantity);
    }, 0);

    const delivery_fee = delivery_type === 'DELIVERY' ? 5.00 : 0;
    const total_amount = subtotal + delivery_fee;

    // Envolver criação em uma transação Prisma
    const newOrder = await prisma.$transaction(async (tx) => {
      // Criar novo pedido
      const createdOrder = await tx.order.create({
        data: {
          company_id,
          customer_id,
          customer_name: originalOrder.customer?.name || originalOrder.customer_name,
          customer_cnpj_cpf: originalOrder.customer_cnpj_cpf || originalOrder.customer_cnpj_cpf,
          customer_email: originalOrder.customer?.email || originalOrder.customer_email,
          customer_phone: originalOrder.customer?.phone || originalOrder.customer_phone,
          delivery_type: delivery_type || originalOrder.delivery_type,
          delivery_address: delivery_address || originalOrder.delivery_address,
          payment_method: payment_method || originalOrder.payment_method,
          subtotal,
          delivery_fee,
          total_amount,
          notes: notes || null,
          order_items: {
            create: originalOrder.order_items.map(item => {
              const price = item.variant 
                ? parseFloat(item.product.base_price.toString()) + parseFloat(item.variant.price_modifier.toString())
                : parseFloat(item.product.base_price.toString());
              
              return {
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity,
                unit_price: price,
                total_price: price * item.quantity,
              };
            }),
          },
        },
        include: {
          order_items: true,
        },
      });

      // Criar lançamento financeiro (await correto)
      await tx.financialEntry.create({
        data: {
          company_id,
          order_id: createdOrder.id,
          type: 'RECEITA',
          amount: total_amount,
          description: `Pedido #${createdOrder.id}`,
          payment_method: payment_method || originalOrder.payment_method,
          due_date: new Date(),
          status: 'PENDENTE',
        },
      });

      return createdOrder;
    });

    return NextResponse.json(newOrder);
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json(
      { error: 'Erro ao recomprar' },
      { status: 500 }
    );
  }
}
