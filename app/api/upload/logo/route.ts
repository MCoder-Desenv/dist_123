// app/api/upload/logo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission, canAccessCompany } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, deleteFile } from '@/lib/storage';
import { createAuditLog } from '@/lib/audit';
import path from 'path';

export const dynamic = 'force-dynamic';

// POST /api/upload/logo - Upload de logo da empresa
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
    const file = formData.get('file') as File | null;
    const companyId = String(formData.get('company_id') || '');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Arquivo é obrigatório' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'ID da empresa é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se pode acessar a empresa
    if (!canAccessCompany(session.user.company_id, companyId)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para esta empresa' },
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

    // Buscar empresa atual para deletar logo antigo se existir
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Detectar extensão com segurança
    const originalName = (file as any).name || '';
    const extFromName = path.extname(originalName).toLowerCase();
    const mimeExt = file.type.split('/')[1];
    const ext = extFromName || (mimeExt ? `.${mimeExt}` : '.jpg');

    // Nome do arquivo fixo dentro da pasta da empresa
    const fileName = `logos/${companyId}/logo${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload do novo arquivo (substitui o antigo automaticamente)
    const fileKey = await uploadFile(buffer, fileName);
    const logoUrl = `/uploads/${fileKey}`;

    // Atualizar empresa com nova logo
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: { logo_url: logoUrl }
    });

    // Log de auditoria
    await createAuditLog({
      company_id: companyId,
      user_id: session.user.id,
      entity_type: 'Company',
      entity_id: companyId,
      action: 'UPDATE',
      old_values: { logo_url: company.logo_url },
      new_values: { logo_url: logoUrl }
    });

    return NextResponse.json({
      success: true,
      message: 'Logo atualizada com sucesso!',
      data: {
        logo_url: logoUrl
      }
    });

  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}