/**
 * Normaliza/encode e retorna a URL pública para usar em <Image src> ou <img>
 * Aceita chaves de storage, URLs absolutas, data URLs, etc.
 */
export function getFileUrl(key?: string | null): string | null {
  if (!key) return null;

  if (key.startsWith('data:')) return key;
  if (/^https?:\/\//.test(key) || key.startsWith('//') || key.startsWith('/api/public-files/')) {
    return key;
  }

  const normalized = key.replace(/^\/+/, '').replace(/^uploads\//, '');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `/api/public-files/${encoded}`;
}