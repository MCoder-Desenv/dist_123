import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, hasPermission } from '@/lib/auth';
import { deleteFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // 1) Autenticação
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    // 2) Permissão (ajuste roles conforme sua app)
    if (!hasPermission(session.user.role, ['ADMINISTRADOR', 'MASTER_DIST'])) {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    // 3) Parse body
    const body = await request.json().catch(() => null);
    let key = typeof body?.key === 'string' ? body.key : null;
    if (!key) {
      return NextResponse.json({ success: false, error: 'Chave (key) é obrigatória' }, { status: 400 });
    }

    // Normalizar (remover /uploads/ ou leading slashes)
    key = key.replace(/^\/uploads\//, '').replace(/^\/+/, '');

    // 4) Validações de segurança
    if (key.includes('..') || key.startsWith('/')) {
      return NextResponse.json({ success: false, error: 'Chave inválida' }, { status: 400 });
    }

    // 5) Apenas permitir remoção de temporários por padrão (mais seguro)
    const ALLOWED_TEMP_PREFIXES = ['products/temp/'];
    const isTemp = ALLOWED_TEMP_PREFIXES.some((p) => key!.startsWith(p));
    if (!isTemp) {
      return NextResponse.json({
        success: false,
        error: 'Somente chaves temporárias podem ser deletadas por este endpoint',
      }, { status: 403 });
    }

    // 6) Deletar arquivo
    await deleteFile(key);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('upload DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Erro ao deletar arquivo' }, { status: 500 });
  }
}