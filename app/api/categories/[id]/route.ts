
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { categorySchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/categories/[id] - Obter categoria
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const categoryId = params.id;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        products: {
          where: { active: true },
          orderBy: { sort_order: 'asc' },
          include: {
            variants: {
              where: { active: true }
            }
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar a categoria (mesma empresa)
    if (!canAccessCompany(session.user.company_id, category.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar esta categoria' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: category
    });

  } catch (error) {
    console.error('Category GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/categories/[id] - Atualizar categoria
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas MASTER_DIST pode editar categorias
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão. Apenas MASTER_DIST podem editar categorias.' },
        { status: 403 }
      );
    }

    const categoryId = params.id;

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar a categoria (mesma empresa)
    if (!canAccessCompany(session.user.company_id, existingCategory.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar esta categoria' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    // Verificar se nome já está em uso por outra categoria da empresa
    if (validatedData.name !== existingCategory.name) {
      const nameExists = await prisma.category.findFirst({
        where: {
      ...getCompanyFilter(session),
          name: validatedData.name,
          id: { not: categoryId }
        }
      });

      if (nameExists) {
        return NextResponse.json(
          { success: false, error: 'Nome da categoria já está em uso' },
          { status: 400 }
        );
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: validatedData
    });

    // Log de auditoria
    await createAuditLog({
      company_id: updatedCategory.company_id,
      user_id: session.user.id,
      entity_type: 'Category',
      entity_id: categoryId,
      action: 'UPDATE',
      old_values: existingCategory,
      new_values: validatedData
    });

    return NextResponse.json({
      success: true,
      message: 'Categoria atualizada com sucesso!',
      data: updatedCategory
    });

  } catch (error) {
    console.error('Category PUT error:', error);
    
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

// DELETE /api/categories/[id] - Desativar categoria
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas MASTER_DIST pode deletar categorias
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão. Apenas MASTER_DIST podem deletar categorias.' },
        { status: 403 }
      );
    }

    const categoryId = params.id;

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: { select: { products: true } }
      }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar a categoria (mesma empresa)
    if (!canAccessCompany(session.user.company_id, existingCategory.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar esta categoria' },
        { status: 403 }
      );
    }

    // Verificar se categoria tem produtos
    if (existingCategory._count.products > 0) {
      return NextResponse.json(
        { success: false, error: 'Não é possível excluir categoria que possui produtos' },
        { status: 400 }
      );
    }

    // Desativar ao invés de deletar (soft delete)
    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: { active: false }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: updatedCategory.company_id,
      user_id: session.user.id,
      entity_type: 'Category',
      entity_id: categoryId,
      action: 'DELETE',
      old_values: { active: true },
      new_values: { active: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Categoria desativada com sucesso!',
      data: updatedCategory
    });

  } catch (error) {
    console.error('Category DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
