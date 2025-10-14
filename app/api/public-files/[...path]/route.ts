// app/api/public-files/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

const ALLOWED_PREFIXES = new Set([
  'logos',
  'products',
  // adicione aqui outros prefixos públicos permitidos (ex: 'companies', 'banners', ...)
]);

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const rawPieces = params?.path || [];
    const pieces = rawPieces.map((p) => {
      try { return decodeURIComponent(p); } catch { return p; }
    });

    if (!pieces || pieces.length === 0) {
      return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
    }

    // Segurança: somente permite requests que comecem com prefixos conhecidos
    const first = pieces[0];
    if (!ALLOWED_PREFIXES.has(first)) {
      return NextResponse.json({ success: false, error: 'Arquivo não permitido' }, { status: 403 });
    }

    const baseDir = process.env.LOCAL_UPLOAD_DIR
      ? path.resolve(process.env.LOCAL_UPLOAD_DIR)
      : path.join(process.cwd(), 'public', 'uploads');

    const relativePath = path.join(...pieces);
    const filePath = path.resolve(baseDir, relativePath);

    // Proteção path traversal
    const normalizedBase = path.resolve(baseDir);
    const normalizedFile = path.resolve(filePath);
    if (!normalizedFile.startsWith(normalizedBase + path.sep) && normalizedFile !== normalizedBase) {
      return NextResponse.json({ success: false, error: 'Arquivo não permitido' }, { status: 403 });
    }

    // Acesso ao arquivo
    try {
      await access(filePath, constants.R_OK);
    } catch {
      return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 });
    }

    const buffer = await fs.readFile(filePath);
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao acessar arquivo' }, { status: 500 });
  }
}