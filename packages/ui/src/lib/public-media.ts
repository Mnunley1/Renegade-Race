const LEADING_SLASHES = /^\/+/
const INVALID_KEY_CHARACTERS = /[:?#]/

function unsafePath(value: string): boolean {
  return [...value].some(
    (character) =>
      character === "\\" || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
  )
}

function publicPath(path: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return false
  }
  return !(
    unsafePath(decoded) ||
    decoded.split("/").some((part) => part === "." || part === "..") ||
    decoded.replace(LEADING_SLASHES, "").startsWith("images/returns/") ||
    decoded.includes("return-photo")
  )
}

/** Public bucket keys only. Protected return evidence uses its authenticated API. */
export function publicMediaUrl(origin: unknown, key: unknown): string | undefined {
  if (typeof origin !== "string" || typeof key !== "string") return
  const trimmed = key.trim()
  const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed
  if (
    !normalized ||
    normalized.startsWith("/") ||
    INVALID_KEY_CHARACTERS.test(normalized) ||
    !publicPath(normalized)
  )
    return
  if (INVALID_KEY_CHARACTERS.test(decodeURIComponent(normalized))) return
  try {
    const base = new URL(origin.trim())
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    )
      return
    return `${base.origin}/${normalized.split("/").map(encodeURIComponent).join("/")}`
  } catch {
    return
  }
}

/** Validate legacy public URLs and local preview/assets without treating them as bucket keys. */
export function publicImageSource(value: unknown): string | undefined {
  if (typeof value !== "string") return
  const source = value.trim()
  if (!source || unsafePath(source)) return
  if (source.startsWith("/") && !source.startsWith("//"))
    return publicPath(source) ? source : undefined
  try {
    const url = new URL(source)
    if (url.protocol === "blob:") return source
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !publicPath(url.pathname)
    )
      return
    return url.href
  } catch {
    return
  }
}
