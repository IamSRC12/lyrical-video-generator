export function cn(
  ...inputs: Array<string | boolean | undefined | null>
): string {
  return inputs.filter(Boolean).join(" ");
}
