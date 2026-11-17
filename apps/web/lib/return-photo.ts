// Both the HTTP destination and the Clerk token audience come from trusted
// application configuration. Treat every photo reference as opaque data.
export function convexSiteOrigin(): string {
  if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_CONVEX_SITE_URL).origin
  }
  const url = new URL(process.env.NEXT_PUBLIC_CONVEX_URL!)
  if (url.hostname.endsWith(".convex.cloud")) {
    url.hostname = `${url.hostname.slice(0, -".cloud".length)}.site`
  } else if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.port) {
    url.port = String(Number(url.port) + 1)
  } else {
    throw new Error("Set NEXT_PUBLIC_CONVEX_SITE_URL to the Convex HTTP actions origin")
  }
  return url.origin
}

export async function requestReturnPhoto(
  reservationId: string,
  token: string | null,
  photo: { key: string; signal: AbortSignal } | { file: File }
) {
  if (!token) throw new Error("Sign in to access return photos")
  const url = new URL("/return-photo", convexSiteOrigin())
  url.searchParams.set("reservationId", reservationId)
  const headers = new Headers({ Authorization: `Bearer ${token}` })
  if ("key" in photo) {
    url.searchParams.set("key", photo.key)
  } else {
    headers.set("Content-Type", photo.file.type)
  }
  const response = await fetch(url, {
    method: "file" in photo ? "POST" : "GET",
    headers,
    body: "file" in photo ? photo.file : undefined,
    signal: "signal" in photo ? photo.signal : undefined,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  })
  if (!response.ok) throw new Error(`Cannot access return photo (${response.status})`)
  return response
}
