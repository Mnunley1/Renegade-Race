import { useMutation } from "convex/react"
import { useCallback } from "react"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { type UploadFn, usePhotoUpload } from "./usePhotoUpload"

type ReservationPhotoKind = "dispute" | "review" | "damage" | "return"

const mutationByKind = {
  dispute: api.r2.generateDisputePhotoUploadUrl,
  review: api.r2.generateReviewPhotoUploadUrl,
  damage: api.r2.generateDamagePhotoUploadUrl,
  return: api.r2.generateReturnPhotoUploadUrl,
} as const

type Options = {
  kind: ReservationPhotoKind
  reservationId: string | Id<"reservations">
  maxFiles?: number
  onUploadComplete?: (keys: string[]) => void
}

export function useReservationPhotoUpload({
  kind,
  reservationId,
  maxFiles,
  onUploadComplete,
}: Options) {
  const generateUploadUrl = useMutation(mutationByKind[kind])

  const uploadFile = useCallback<UploadFn>(
    async (file) => {
      const { url, key } = await generateUploadUrl({
        reservationId: reservationId as Id<"reservations">,
      })
      const res = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
      }
      return key
    },
    [generateUploadUrl, reservationId]
  )

  return usePhotoUpload({ uploadFile, maxFiles, onUploadComplete })
}
