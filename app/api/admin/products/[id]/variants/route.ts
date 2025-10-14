
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany, getCompanyFilter, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { variantSchema } from '@/lib/validations';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/products/[id]/variants - Listar variações do produto
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    const productId = params.id;

    // Verificar se produto existe
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    // Para rotas públicas
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === 'true';
    
    if (isPublic) {
      if (!product.active) {
        return NextResponse.json(
          { success: false, error: 'Produto não encontrado' },
          { status: 404 }
        );
      }
    } else {
      // Para rotas privadas, verificar autenticação e permissões
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: 'Não autorizado' },
          { status: 401 }
        );
      }

      if (!canAccessCompany(session.user.company_id, product.company_id)) {
        return NextResponse.json(
          { success: false, error: 'Sem permissão' },
          { status: 403 }
        );
      }
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        product_id: productId,
        active: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: variants
    });

  } catch (error) {
    console.error('Product variants GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/variants - Criar nova variação
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Apenas MASTER_DIST pode criar variações de produtos
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão. Apenas MASTER_DIST podem criar variações de produtos.' },
        { status: 403 }
      );
    }

    const productId = params.id;

    // Verificar se produto existe e pertence à empresa
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !canAccessCompany(session.user.company_id, product.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = variantSchema.parse(body);

    const variant = await prisma.productVariant.create({
      data: {
        name: validatedData.name,
        volume: validatedData.volume,
        unit_type: validatedData.unit_type,
        price_modifier: validatedData.price_modifier || 0,
        stock_quantity: validatedData.stock_quantity,
        product_id: productId,
        active: true
      }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: product.company_id,
      user_id: session.user.id,
      entity_type: 'ProductVariant',
      entity_id: variant.id,
      action: 'CREATE',
      new_values: { ...validatedData, product_id: productId }
    });

    return NextResponse.json({
      success: true,
      message: 'Variação criada com sucesso!',
      data: variant
    });

  } catch (error) {
    console.error('Product variants POST error:', error);
    
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
