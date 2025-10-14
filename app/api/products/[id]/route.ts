
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/products/[id] - Obter produto
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: { id: true, name: true }
        },
        variants: {
          where: { active: true },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    // Para rotas públicas, verificar se produto está ativo
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === 'true';
    
    if (isPublic) {
      if (!product.active) {
        return NextResponse.json(
          { success: false, error: 'Produto não encontrado' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: product
      });
    }

    // Para rotas privadas, verificar autenticação
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se pode acessar o produto (mesma empresa)
    if (!canAccessCompany(session.user.company_id, product.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar este produto' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Product GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Atualizar produto
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas MASTER_DIST pode editar produtos
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão. Apenas MASTER_DIST podem editar produtos.' },
        { status: 403 }
      );
    }

    const productId = params.id;

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar o produto (mesma empresa)
    if (!canAccessCompany(session.user.company_id, existingProduct.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar este produto' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = productSchema.parse(body);

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

    // Verificar se SKU já está em uso por outro produto (se fornecido e diferente)
    if (validatedData.sku && validatedData.sku !== existingProduct.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
      ...getCompanyFilter(session),
          sku: validatedData.sku,
          id: { not: productId }
        }
      });

      if (existingSku) {
        return NextResponse.json(
          { success: false, error: 'SKU já está em uso' },
          { status: 400 }
        );
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: validatedData,
      include: {
        category: {
          select: { id: true, name: true }
        },
        variants: {
          where: { active: true }
        }
      }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: updatedProduct.company_id,
      user_id: session.user.id,
      entity_type: 'Product',
      entity_id: productId,
      action: 'UPDATE',
      old_values: existingProduct,
      new_values: validatedData
    });

    return NextResponse.json({
      success: true,
      message: 'Produto atualizado com sucesso!',
      data: updatedProduct
    });

  } catch (error) {
    console.error('Product PUT error:', error);
    
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

// DELETE /api/products/[id] - Desativar produto
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas MASTER_DIST pode deletar produtos
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão. Apenas MASTER_DIST podem deletar produtos.' },
        { status: 403 }
      );
    }

    const productId = params.id;

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar o produto (mesma empresa)
    if (!canAccessCompany(session.user.company_id, existingProduct.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para acessar este produto' },
        { status: 403 }
      );
    }

    // Desativar ao invés de deletar (soft delete)
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { active: false }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: updatedProduct.company_id,
      user_id: session.user.id,
      entity_type: 'Product',
      entity_id: productId,
      action: 'DELETE',
      old_values: { active: true },
      new_values: { active: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Produto desativado com sucesso!',
      data: updatedProduct
    });

  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
