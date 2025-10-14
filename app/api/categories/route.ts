
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { categorySchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/categories - Listar categorias da empresa
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
    const includeProducts = searchParams.get('include_products') === 'true';

    const categories = await prisma.category.findMany({
      where: {
      ...getCompanyFilter(session),
        active: true
      },
      orderBy: { sort_order: 'asc' },
      include: {
        products: includeProducts ? {
          where: { active: true },
          orderBy: { sort_order: 'asc' },
          include: {
            variants: true
          }
        } : false,
        _count: {
          select: { products: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/categories - Criar nova categoria
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas MASTER_DIST pode criar categorias
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão. Apenas MASTER_DIST podem cadastrar categorias.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    // Verificar se nome já existe na empresa
    const existingCategory = await prisma.category.findFirst({
      where: {
      ...getCompanyFilter(session),
        name: validatedData.name
      }
    });

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Categoria já existe' },
        { status: 400 }
      );
    }

    const companyId = getCompanyIdForCreate(session);
    
    const category = await prisma.category.create({
      data: {
        company_id: companyId,
        name: validatedData.name,
        description: validatedData.description,
        sort_order: validatedData.sort_order || 0,
        active: true
      }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'Category',
      entity_id: category.id,
      action: 'CREATE',
      new_values: validatedData
    });

    return NextResponse.json({
      success: true,
      message: 'Categoria criada com sucesso!',
      data: category
    });

  } catch (error) {
    console.error('Categories POST error:', error);
    
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
