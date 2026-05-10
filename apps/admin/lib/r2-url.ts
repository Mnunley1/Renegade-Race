const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

export function r2Url(key: string): string {
  const normalized = key.startsWith("/") ? key.slice(1) : key
  return `${R2_PUBLIC_URL}/${normalized}`
}
