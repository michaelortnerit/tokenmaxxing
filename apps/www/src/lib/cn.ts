/** Joins truthy class strings — a zero-dep stand-in for clsx. */
function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export { cn };
