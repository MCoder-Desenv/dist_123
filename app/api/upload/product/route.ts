import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany, getCompanyIdForCreate } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, deleteFile } from '@/lib/storage';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/upload/product - Upload de imagem de produto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar permissão
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const productId = formData.get('product_id') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Arquivo é obrigatório' },
        { status: 400 }
      );
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'ID do produto é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se produto existe e pertence à empresa
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se pode acessar o produto
    if (!canAccessCompany(session.user.company_id, product.company_id)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para este produto' },
        { status: 403 }
      );
    }

    // Verificar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de arquivo não permitido. Use JPG, PNG ou WebP.' },
        { status: 400 }
      );
    }

    // Verificar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Arquivo muito grande. Máximo 5MB.' },
        { status: 400 }
      );
    }

    // Upload do novo arquivo (salva em public/uploads)
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1]; // jpg, png, webp
    const fileName = `products/${product.company_id}/${productId}-${Date.now()}.${ext}`;

    const fileKey = await uploadFile(buffer, fileName);
    const imageUrl = `/uploads/${fileKey}`;

    // Atualizar produto com nova imagem
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { image_url: imageUrl }
    });

    // Deletar imagem antiga se existir
    if (product.image_url) {
      try {
        // Converte a URL salva no banco para a chave do arquivo
        const oldFileKey = product.image_url.replace(/^\/uploads\//, '');
        await deleteFile(oldFileKey);
      } catch (error) {
        console.log('Erro ao deletar imagem antiga:', error);
      }
    }

    // Log de auditoria
    const companyId = getCompanyIdForCreate(session);
    await createAuditLog({
      company_id: product.company_id,
      user_id: session.user.id,
      entity_type: 'Product',
      entity_id: productId,
      action: 'UPDATE',
      old_values: { image_url: product.image_url },
      new_values: { image_url: imageUrl }
    });

    return NextResponse.json({
      success: true,
      message: 'Imagem do produto atualizada com sucesso!',
      data: {
        image_url: imageUrl
      }
    });

  } catch (error) {
    console.error('Product image upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}