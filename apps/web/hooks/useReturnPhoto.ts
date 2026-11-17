import { useAuth } from "@clerk/nextjs"
import { useCallback } from "react"
import { requestReturnPhoto } from "@/lib/return-photo"
import { usePhotoUpload } from "./usePhotoUpload"

export function useReturnPhotoToken() {
  const { getToken, sessionClaims } = useAuth()
  const hasConvexAudience = sessionClaims?.aud === "convex"
  return useCallback(
    () => getToken(hasConvexAudience ? undefined : { template: "convex" }),
    [getToken, hasConvexAudience]
  )
}

export function useReturnPhotoUpload(reservationId: string) {
  const getToken = useReturnPhotoToken()
  const uploadFile = useCallback(
    async (file: File) => {
      const response = await requestReturnPhoto(reservationId, await getToken(), { file })
      const { key } = await response.json()
      if (typeof key !== "string" || !key) throw new Error("Missing uploaded photo reference")
      return key
    },
    [getToken, reservationId]
  )
  return usePhotoUpload({ uploadFile })
}
