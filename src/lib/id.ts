
let counter = 0;

/**
 * Generates a unique identifier.
 * Uses crypto.randomUUID when available, falls back to a timestamp + counter.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}


