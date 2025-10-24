// /lib/storage.ts
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

function getLocalConfig() {
  // Diretório base absoluto dentro de public/uploads
  const dir = process.env.LOCAL_UPLOAD_DIR
    ? path.resolve(process.env.LOCAL_UPLOAD_DIR)
    : path.join(process.cwd(), 'public', 'uploads');

  const baseUrl = process.env.FILE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Garante que a pasta raiz exista
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return { dir, baseUrl };
}

function normalizeKey(key: string) {
  if (!key) return key;
  try {
    key = decodeURIComponent(key);
  } catch {
    // ignore
  }
  // Remove leading /uploads/ ou leading slashes
  key = key.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  // Prevent directory traversal
  if (key.includes('..')) {
    throw new Error('Invalid key');
  }
  return key;
}

/**
 * Salva um buffer de arquivo no disco local.
 * @param buffer Conteúdo do arquivo
 * @param fileName Caminho relativo completo (ex: "logos/abc123/logo.jpg")
 * @returns A chave relativa do arquivo
 */
export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
  const { dir } = getLocalConfig();
  const key = normalizeKey(fileName);
  const filePath = path.join(dir, key);

  // Garante que o diretório (ex: logos/abc123) exista
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  await fs.writeFile(filePath, new Uint8Array(buffer));
  return key;
}

export async function deleteFile(key: string): Promise<void> {
  const { dir } = getLocalConfig();
  const normalized = normalizeKey(key);
  const filePath = path.join(dir, normalized);
  try {
    await fs.unlink(filePath);
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.error(`Erro ao deletar arquivo ${key}:`, e);
      throw e;
    }
  }
}

export async function getDownloadUrl(key: string): Promise<string> {
  const { baseUrl } = getLocalConfig();
  const normalized = normalizeKey(key);
  // Encode each segment to preserve slashes
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl.replace(/\/$/, '')}/uploads/${encoded}`;
}

export async function renameFile(oldKey: string, newKey: string): Promise<void> {
  const { dir } = getLocalConfig();
  const oldNormalized = normalizeKey(oldKey);
  const newNormalized = normalizeKey(newKey);

  const oldPath = path.join(dir, oldNormalized);
  const newPath = path.join(dir, newNormalized);

  await fs.mkdir(path.dirname(newPath), { recursive: true });

  // If old file doesn't exist, throw a clear error
  try {
    await fs.access(oldPath);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      throw new Error(`Source file not found: ${oldNormalized}`);
    }
    throw e;
  }

  await fs.rename(oldPath, newPath);
}

export async function getFileContent(key: string): Promise<Buffer | null> {
  const { dir } = getLocalConfig();
  const normalized = normalizeKey(key);
  const filePath = path.join(dir, normalized);
  try {
    return await fs.readFile(filePath);
  } catch (e: any) {
    if (e.code === 'ENOENT') return null;
    console.error(`Erro ao ler arquivo ${key}:`, e);
    throw e;
  }
}