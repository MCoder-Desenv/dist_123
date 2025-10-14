
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/products - Listar produtos da empresa
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
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category_id') || '';
    const skip = (page - 1) * limit;

    const where: any = {
      ...getCompanyFilter(session),
      active: true
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (categoryId) {
      where.category_id = categoryId;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sort_order: 'asc' },
        include: {
          category: {
            select: { id: true, name: true }
          },
          variants: {
            where: { active: true },
            orderBy: { name: 'asc' }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/products - Criar novo produto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas MASTER_DIST pode criar produtos
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão. Apenas MASTER_DIST podem cadastrar produtos.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = productSchema.parse(body);
    
    const companyId = getCompanyIdForCreate(session);

    // Verificar se categoria existe e pertence à empresa
    const category = await prisma.category.findFirst({
      where: { 
        id: validatedData.category_id,
        ...getCompanyFilter(session)
      }
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada' },
        { status: 400 }
      );
    }

    // Verificar se SKU já existe na empresa (se fornecido)
    if (validatedData.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          ...getCompanyFilter(session),
          sku: validatedData.sku
        }
      });

      if (existingSku) {
        return NextResponse.json(
          { success: false, error: 'SKU já está em uso' },
          { status: 400 }
        );
      }
    }

    const product = await prisma.product.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        category_id: validatedData.category_id,
        sku: validatedData.sku,
        base_price: validatedData.base_price,
        active: validatedData.active,
        company_id: companyId
      },
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'Product',
      entity_id: product.id,
      action: 'CREATE',
      new_values: validatedData
    });

    return NextResponse.json({
      success: true,
      message: 'Produto criado com sucesso!',
      data: product
    });

  } catch (error) {
    console.error('Products POST error:', error);
    
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
