import { publicMediaUrl } from "@workspace/ui/lib/public-media"

export function r2Url(key: string | null | undefined): string | undefined {
  return publicMediaUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_URL, key)
}
