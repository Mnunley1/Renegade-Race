/** URLSearchParams already decodes its value. Validate, but never decode it again for navigation. */
export function safeReturnPath(value: string | null): string {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//")) return "/"
  try {
    const decoded = decodeURIComponent(value)
    if (
      [...decoded].some(
        (character) =>
          character === "\\" || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      ) ||
      decoded.startsWith("//")
    )
      return "/"
    const url = new URL(value, "https://return.invalid")
    if (url.origin !== "https://return.invalid") return "/"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/"
  }
}

export function authReturnLink(path: string, returnPath: string): string {
  const safePath = safeReturnPath(returnPath)
  return safePath === "/" ? path : `${path}?${new URLSearchParams({ redirect_url: safePath })}`
}
