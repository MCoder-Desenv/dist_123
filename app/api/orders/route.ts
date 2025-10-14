  import { NextRequest, NextResponse } from 'next/server';
  import { getServerAuthSession, hasPermission, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
  import { prisma } from '@/lib/prisma';
  import { orderSchema } from '@/lib/validations';
  import { createAuditLog } from '@/lib/audit';
  import { OrderStatus } from '@prisma/client';

  export const dynamic = 'force-dynamic';

  // GET /api/orders - Listar pedidos da empresa com suporte a filtro por data
  export async function GET(request: NextRequest) {
    try {
      const session = await getServerAuthSession();

      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: 'Não autorizado' },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const status = searchParams.get('status') || '';
      const search = searchParams.get('search') || '';
      const startDateParam = searchParams.get('start_date'); // formato: YYYY-MM-DD
      const endDateParam = searchParams.get('end_date');       // formato: YYYY-MM-DD
      const skip = (page - 1) * limit;

      const companyFilter = getCompanyFilter(session);
      const where: any = {
        ...companyFilter
      };

      // Filtros existentes
      if (status) {
        where.status = status;
      }

      if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
        where.status = status as OrderStatus;
      }

      if (search) {
        where.OR = [
          { customer_name: { contains: search, mode: 'insensitive' } },
          { customer_email: { contains: search, mode: 'insensitive' } },
          { customer_phone: { contains: search } }
        ];
      }

      // --- Novo: filtro por intervalo de datas ---
      if (startDateParam || endDateParam) {
        where.created_at = {};

        if (startDateParam) {
          const start = new Date(startDateParam);
          start.setHours(0, 0, 0, 0); // Início do dia
          where.created_at.gte = start;
        }

        if (endDateParam) {
          const end = new Date(endDateParam);
          end.setHours(23, 59, 59, 999); // Fim do dia
          where.created_at.lte = end;
        }
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            order_items: {
              include: {
                product: {
                  select: { name: true, image_url: true }
                },
                variant: {
                  select: { name: true, volume: true, unit_type: true }
                }
              }
            },
            user: {
              select: { first_name: true, last_name: true }
            }
          }
        }),
        prisma.order.count({ where })
      ]);

      // Mapear campos para o formato esperado pelo frontend
      // ... dentro do map
      const mappedOrders = orders.map(order => {
        const deliveryAddress = order.delivery_address as any;

        return {
          id: order.id,
          order_number: order.id.substring(0, 8).toUpperCase(),
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
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
          // incluir um resumo leve dos itens
          order_items: order.order_items?.map((it) => ({
            quantity: it.quantity,
            product: { name: it.product?.name ?? '' },
          })) ?? [],
        };
      });

      return NextResponse.json({
        success: true,
        data: mappedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Orders GET error:', error);
      return NextResponse.json(
        { success: false, error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }
  }

  // POST /api/orders - Criar novo pedido (sem alterações)
  export async function POST(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const isPublic = searchParams.get('public') === 'true';

      let session = null;
      if (!isPublic) {
        session = await getServerAuthSession();

        if (!session?.user) {
          return NextResponse.json(
            { success: false, error: 'Não autorizado' },
            { status: 401 }
          );
        }

        if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST', 'ATENDENTE'])) {
          return NextResponse.json(
            { success: false, error: 'Sem permissão' },
            { status: 403 }
          );
        }
      }

      const body = await request.json();
      console.log('POST /api/orders chamado com body:', body);

      let companyId: string;
      if (isPublic) {
        companyId = body.company_id;
        if (!companyId) {
          return NextResponse.json(
            { success: false, error: 'ID da empresa é obrigatório' },
            { status: 400 }
          );
        }

        const company = await prisma.company.findUnique({
          where: { id: companyId, active: true }
        });

        if (!company) {
          return NextResponse.json(
            { success: false, error: 'Empresa não encontrada' },
            { status: 404 }
          );
        }
      } else {
        companyId = session!.user.company_id!;
        if (!companyId) {
          return NextResponse.json(
            { success: false, error: 'Usuário sem empresa associada' },
            { status: 400 }
          );
        }
      }

      const validatedData = orderSchema.parse(body);

      let subtotal = 0;
      const orderItems = [];

      for (const item of validatedData.items) {
        const product = await prisma.product.findUnique({
          where: {
            id: item.product_id,
            company_id: companyId,
            active: true
          },
          include: {
            variants: {
              where: {
                id: item.variant_id || undefined,
                active: true
              }
            }
          }
        });

        if (!product) {
          return NextResponse.json(
            { success: false, error: `Produto não encontrado: ${item.product_id}` },
            { status: 400 }
          );
        }

        let unitPrice = Number(product.base_price);

        if (item.variant_id && product.variants.length > 0) {
          const variant = product.variants[0];
          unitPrice += Number(variant.price_modifier);
        }

        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        orderItems.push({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: totalPrice
        });
      }

      const deliveryFee = 0;
      const totalAmount = subtotal + deliveryFee;
      console.log('Criando pedido...');
      const order = await prisma.order.create({
        data: {
          company_id: companyId,
          user_id: session?.user.id || null,
          customer_id: body.customer_id || null,
          customer_name: validatedData.customer_name,
          customer_email: validatedData.customer_email,
          customer_phone: validatedData.customer_phone,
          delivery_address: validatedData.delivery_address,
          delivery_type: validatedData.delivery_type,
          payment_method: validatedData.payment_method,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          notes: validatedData.notes,
          status: 'RECEBIDO',
          order_items: {
            create: orderItems
          }
        },
        include: {
          order_items: {
            include: {
              product: {
                select: { name: true }
              },
              variant: {
                select: { name: true, volume: true, unit_type: true }
              }
            }
          }
        }
      });
      console.log('Pedido criado com sucesso:', order.id);

      await prisma.financialEntry.create({
        data: {
          company_id: companyId,
          order_id: order.id,
          type: 'RECEITA',
          amount: totalAmount,
          description: `Pedido #${order.id}`,
          payment_method: validatedData.payment_method,
          due_date: new Date(),
          status: 'PENDENTE'
        }
      });

      await createAuditLog({
        company_id: companyId,
        user_id: session?.user.id,
        entity_type: 'Order',
        entity_id: order.id,
        action: 'CREATE',
        new_values: {
          customer_name: order.customer_name,
          total_amount: order.total_amount,
          status: order.status
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Pedido criado com sucesso!',
        data: order
      });

    } catch (error) {
      console.error('Orders POST error:', error);

      if (error instanceof Error && 'code' in error) {
        return NextResponse.json(
          { success: false, error: 'Dados inválidos' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }
  }