"use client"

import { useAuth } from "@clerk/nextjs"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useReturnPhotoToken } from "@/hooks/useReturnPhoto"
import { requestReturnPhoto } from "@/lib/return-photo"

type Props = { reservationId: string; photoKey: string; alt: string }

export function ReturnPhoto(props: Props) {
  const { sessionId } = useAuth()
  if (!sessionId) return null
  // Drop the old image immediately if the session, booking or photo changes.
  return (
    <AuthenticatedPhoto
      {...props}
      key={JSON.stringify([sessionId, props.reservationId, props.photoKey])}
    />
  )
}

function AuthenticatedPhoto({ reservationId, photoKey, alt }: Props) {
  const getToken = useReturnPhotoToken()
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    async function load() {
      try {
        const response = await requestReturnPhoto(reservationId, await getToken(), {
          key: photoKey,
          signal: controller.signal,
        })
        const blob = await response.blob()
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
        setFailed(false)
      } catch {
        if (!controller.signal.aborted) {
          setUrl(undefined)
          setFailed(true)
        }
      }
    }
    void load()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [getToken, photoKey, reservationId])

  if (!url) {
    return (
      <span className="text-muted-foreground text-xs">
        {failed ? "Photo unavailable" : "Loading photo…"}
      </span>
    )
  }
  return <Image alt={alt} className="rounded-lg object-cover" fill src={url} unoptimized />
}

type Evidence = { notes?: string; photos: string[] }

export function ReturnEvidence({
  reservationId,
  evidence,
  title,
}: {
  reservationId: string
  evidence?: Evidence
  title: string
}) {
  if (!(evidence && (evidence.notes || evidence.photos.length))) return null
  return (
    <section className="my-4 space-y-2 text-left">
      <h3 className="font-semibold">{title}</h3>
      {evidence.notes && <p className="whitespace-pre-wrap text-sm">{evidence.notes}</p>}
      {evidence.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {evidence.photos.map((key, index) => (
            <div className="relative size-24" key={key}>
              <ReturnPhoto
                alt={`${title} photo ${index + 1}`}
                photoKey={key}
                reservationId={reservationId}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
