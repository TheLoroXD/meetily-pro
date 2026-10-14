/**
 * Codes must stay in sync with `language_name_from_code` in
 * `frontend/src-tauri/src/summary/processor.rs`.
 */
const SUPPORTED_CODES: ReadonlySet<string> = new Set([
  'en',
  'zh',
  'zh-tw',
  'de',
  'es',
  'ru',
  'ko',
  'fr',
  'ja',
  'pt',
  'it',
  'nl',
  'pl',
  'ar',
  'hi',
  'ta',
  'tr',
  'vi',
  'th',
  'id',
  'sv',
  'cs',
  'da',
  'fi',
  'el',
  'he',
  'hu',
  'no',
  'ro',
  'uk',
]);


/**
 * Normalises a raw locale string (from transcription or storage) into a code we
 * can translate into. Handles BCP-47 regional tags: `pt-BR` -> `pt`, `en_GB` -> `en`.
 * Returns null for unsupported languages so callers can fall back to English
 * rather than sending a code Rust will silently drop.
 */
export function normaliseLanguageCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/_/g, '-');
  if (SUPPORTED_CODES.has(lower)) return lower;
  const base = lower.split('-')[0];
  if (SUPPORTED_CODES.has(base)) return base;
  return null;
}
