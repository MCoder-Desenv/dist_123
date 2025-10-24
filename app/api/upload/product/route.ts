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
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar permissão
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productId = (formData.get('product_id') as string) ?? null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    if (!productId) {
      return NextResponse.json({ success: false, error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    // Verificar se produto existe e pertence à empresa
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      return NextResponse.json({ success: false, error: 'Produto não encontrado' }, { status: 404 });
    }

    // Verificar se pode acessar o produto
    if (!canAccessCompany(session.user.company_id, product.company_id)) {
      return NextResponse.json({ success: false, error: 'Sem permissão para este produto' }, { status: 403 });
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
      return NextResponse.json({ success: false, error: 'Arquivo muito grande. Máximo 5MB.' }, { status: 400 });
    }

    // Upload do novo arquivo (salva em public/uploads)
    let fileKey: string;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.type.split('/')[1] ?? 'jpg';
      const fileName = `products/${product.company_id}/${productId}-${Date.now()}.${ext}`;
      fileKey = await uploadFile(buffer, fileName);
    } catch (err: any) {
      console.error('Erro uploadFile:', err);
      // Retornar mensagem clara para o frontend (sem stack)
      return NextResponse.json(
        { success: false, error: err?.message || 'Erro ao enviar o arquivo' },
        { status: 500 }
      );
    }

    const imageUrl = `/uploads/${fileKey}`;

    // Atualizar produto com nova imagem
    let updatedProduct;
    try {
      updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: { image_url: imageUrl }
      });
    } catch (err: any) {
      console.error('Erro prisma.update product image_url:', err);
      // tentativa de cleanup do arquivo recém enviado
      try { await deleteFile(fileKey); } catch (delErr) { console.warn('Falha ao deletar arquivo após erro de BD', delErr); }
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar produto no banco de dados' },
        { status: 500 }
      );
    }

    // Deletar imagem antiga se existir (não interrompe fluxo principal se falhar)
    if (product.image_url) {
      try {
        const oldFileKey = product.image_url.replace(/^\/uploads\//, '');
        if (oldFileKey) await deleteFile(oldFileKey);
      } catch (error) {
        // apenas loga, não falha a requisição
        console.warn('Erro ao deletar imagem antiga:', error);
      }
    }

    // Log de auditoria (não falha a resposta se der erro no log)
    try {
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
    } catch (err) {
      console.warn('Erro ao criar audit log:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Imagem do produto atualizada com sucesso!',
      data: { image_url: imageUrl, file_key: fileKey }
    });

  } catch (error: any) {
    console.error('Product image upload error:', error);
    // Mensagem genérica para o frontend; evita vazar stack
    const msg = error?.message || 'Erro interno do servidor';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}