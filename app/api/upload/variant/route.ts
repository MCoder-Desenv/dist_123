// app/api/upload/variant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sharp from 'sharp'; // npm install sharp
import { uploadFile } from '@/lib/storage';
import { getServerAuthSession, hasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Permissão
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipo de arquivo não permitido' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'Arquivo muito grande. Máx 5MB' }, { status: 400 });
    }

    // 3. Validação com sharp
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      await sharp(buffer).metadata(); // lança erro se não for imagem válida
    } catch {
      return NextResponse.json({ success: false, error: 'Arquivo inválido. Envie uma imagem válida.' }, { status: 400 });
    }

    const originalName = (file as any).name || '';
    const ext = path.extname(originalName) || `.${(file.type || 'image/jpeg').split('/')[1] || 'jpg'}`;

    const uuid = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const fileName = `products/temp/${uuid}${ext}`;

    await uploadFile(buffer, fileName);

    const fileUrl = `/api/files/${fileName}`;

    return NextResponse.json({
      success: true,
      data: {
        file_key: fileName,
        file_url: fileUrl,
      },
    });
  } catch (err) {
    console.error('variant upload error:', err);
    return NextResponse.json({ success: false, error: 'Erro ao enviar imagem' }, { status: 500 });
  }
}