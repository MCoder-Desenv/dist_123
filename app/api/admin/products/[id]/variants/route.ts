// /api/admin/products/[id]/variants/route.ts
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
        sku: validatedData.sku,
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

// PATCH /api/products/[id]/variants - Atualizar variação (apenas atualização de 1 variação via body.id)
// Ex.: PATCH /api/admin/products/:productId/variants  body: { id: 'variant-id', active: true }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    // Restrição: apenas MASTER_DIST pode atualizar variações (siga a mesma regra do POST)
    if (session.user.role !== 'MASTER_DIST') {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    const productId = params.id;

    // Verificar produto e empresa
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !canAccessCompany(session.user.company_id, product.company_id)) {
      return NextResponse.json({ success: false, error: 'Produto não encontrado' }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Requisição inválida' }, { status: 400 });
    }

    const variantId: string | undefined = body?.id;
    if (!variantId) {
      return NextResponse.json({ success: false, error: 'ID da variação obrigatório' }, { status: 400 });
    }

    // Verificar se a variação existe e pertence ao produto
    const existingVariant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!existingVariant || existingVariant.product_id !== productId) {
      return NextResponse.json({ success: false, error: 'Variação não encontrada para este produto' }, { status: 404 });
    }

    // Construir objeto de update apenas com campos permitidos
    const allowedFields = [
      'name',
      'volume',
      'sku',
      'unit_type',
      'price_modifier',
      'stock_quantity',
      'active',
      'image_url'
    ] as const;

    const updateData: any = {};

    for (const f of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, f)) {
        // normalizações leves por campo
        if (f === 'price_modifier') {
          const n = parseFloat(String(body[f]));
          updateData[f] = Number.isNaN(n) ? existingVariant.price_modifier : n;
        } else if (f === 'stock_quantity') {
          const n = parseInt(String(body[f] ?? ''), 10);
          updateData[f] = Number.isNaN(n) ? existingVariant.stock_quantity : n;
        } else if (f === 'active') {
          updateData[f] = !!body[f];
        } else if (f === 'image_url') {
          updateData[f] = body[f] == null ? null : String(body[f]);
        } else {
          updateData[f] = body[f] == null ? null : String(body[f]);
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });

    // Auditoria
    try {
      await createAuditLog({
        company_id: product.company_id,
        user_id: session.user.id,
        entity_type: 'ProductVariant',
        entity_id: updated.id,
        action: 'UPDATE',
        new_values: updateData,
      });
    } catch (e) {
      console.warn('Falha ao criar log de auditoria (não crítico):', e);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Product variants PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}