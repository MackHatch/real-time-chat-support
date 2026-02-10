/**
 * Sanitizes user input text by:
 * - Removing null bytes
 * - Normalizing line endings
 * - Trimming excessive whitespace
 * - Treating as plain text (no HTML interpretation)
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Normalize line endings to \n
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Trim excessive whitespace (more than 2 consecutive spaces)
  sanitized = sanitized.replace(/ {3,}/g, '  ');

  // Trim leading/trailing whitespace
  sanitized = sanitized.trim();

  // Treat as plain text - no HTML interpretation
  // (Frontend should render as text, not dangerouslySetInnerHTML)

  return sanitized;
}
