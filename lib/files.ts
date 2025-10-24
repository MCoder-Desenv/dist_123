// /lib/files.ts
// Utilitários relacionados a nomes de ficheiros

/**
 * sanitizeFilename
 * Remove diacríticos, espaços e caracteres perigosos.
 * Permite apenas caracteres alfanuméricos, '-' '_' e '.'.
 * Colapsa múltiplos '-' e remove '-' no início/fim.
 *
 * Ex.: "Água Crystal (foto).png" -> "Agua-Crystal-foto"
 *
 * Obs: não inclui a extensão — passe apenas o basename (sem ext) ou remova a ext antes.
 */
export function sanitizeFilename(name: string) {
  if (!name) return '';
  // Normalize to NFD to allow removal of diacritics
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Replace any sequence of invalid chars with '-'
  const replaced = normalized.replace(/[^a-zA-Z0-9-_.]/g, '-');
  // Collapse multiple dashes or underscores
  const collapsed = replaced.replace(/[-_]+/g, '-');
  // Trim leading/trailing dashes, underscores or dots
  const trimmed = collapsed.replace(/(^[-_.]+|[-_.]+$)/g, '');
  return trimmed;
}