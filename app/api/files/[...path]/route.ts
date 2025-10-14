// app/api/files/[...path]/route.ts
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

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const rawPieces = params?.path || [];
    const pieces = rawPieces.map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });

    if (!pieces || pieces.length === 0) {
      return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
    }

    const baseDir = process.env.LOCAL_UPLOAD_DIR
      ? path.resolve(process.env.LOCAL_UPLOAD_DIR)
      : path.join(process.cwd(), 'public', 'uploads');

    const relativePath = path.join(...pieces);
    const filePath = path.resolve(baseDir, relativePath);

    // Proteção contra path traversal
    const normalizedBase = path.resolve(baseDir);
    const normalizedFile = path.resolve(filePath);

    if (!normalizedFile.startsWith(normalizedBase + path.sep) && normalizedFile !== normalizedBase) {
      return NextResponse.json({ success: false, error: 'Arquivo não permitido' }, { status: 403 });
    }

    // Verifica existência e permissão de leitura
    try {
      await access(filePath, constants.R_OK);
    } catch {
      // Verifica diretório pai e retorna 404 (sem logs)
      return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 });
    }

    const buffer = await fs.readFile(filePath);
    const stat = await fs.stat(filePath);
    const data = new Uint8Array(buffer);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    return new NextResponse(data, {
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