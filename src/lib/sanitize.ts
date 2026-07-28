
/**
 * Strips HTML tags and collapses whitespace to prevent injection
 * in user-supplied text that is rendered or logged.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ensures a string is safe for use as a filename component.
 */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200)
    .trim();
}


