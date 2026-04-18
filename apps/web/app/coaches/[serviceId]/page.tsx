"use client"

import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useMutation, useQuery } from "convex/react"
import { GraduationCap, Loader2, MapPin, Share2 } from "lucide-react"
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function unitLabel(unit: string) {
  switch (unit) {
    case "hour":
      return "per hour"
    case "half_day":
      return "per half day"
    case "full_day":
      return "per day"
    default:
      return "per session"
  }
}

export default function CoachServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isSignedIn } = useUser()
  const serviceId = params.serviceId as string
  const [viewTracked, setViewTracked] = useState(false)

  const service = useQuery(
    api.coachServices.getPublicById,
    serviceId ? { coachServiceId: serviceId as Id<"coachServices"> } : "skip"
  )

  const trackView = useMutation(api.coachAnalytics.trackView)
  const trackShare = useMutation(api.coachAnalytics.trackShare)

  useEffect(() => {
    if (!service || viewTracked) return
    setViewTracked(true)
    trackView({ coachServiceId: service._id }).catch(() => {
      /* ignore analytics failures */
    })
  }, [service, viewTracked, trackView])

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/coaches/${serviceId}`
  }, [serviceId])

  const handleShare = async () => {
    if (!service) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: service.title,
          text: service.description.slice(0, 140),
          url: shareUrl,
        })
        await trackShare({ coachServiceId: service._id, platform: "web_share" })
        toast.success("Thanks for sharing")
      } else {
        await navigator.clipboard.writeText(shareUrl)
        await trackShare({ coachServiceId: service._id, platform: "copy_link" })
        toast.success("Link copied")
      }
    } catch {
      toast.error("Could not share")
    }
  }

  if (service === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (service === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-bold text-2xl">Listing unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          This coach program may be pending approval or no longer active.
        </p>
        <Button asChild className="mt-6">
          <Link href="/coaches">Browse coaches</Link>
        </Button>
      </div>
    )
  }

  const hero =
    service.images?.find((i: { isPrimary?: boolean }) => i.isPrimary) || service.images?.[0]
  const ogImage = hero?.detailUrl || hero?.cardUrl || ""

  return (
    <>
      <Head>
        <title>{service.title} — Renegade Coaches</title>
        <meta content={service.description.slice(0, 160)} name="description" />
        <meta content={service.title} property="og:title" />
        <meta content={service.description.slice(0, 200)} property="og:description" />
        <meta content="website" property="og:type" />
        {ogImage ? <meta content={ogImage} property="og:image" /> : null}
        <meta content={shareUrl} property="og:url" />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="relative aspect-[21/9] max-h-[420px] w-full bg-muted">
          {hero?.heroUrl || hero?.detailUrl ? (
            <Image
              alt={service.title}
              className="object-cover"
              fill
              priority
              sizes="100vw"
              src={(hero.heroUrl || hero.detailUrl) as string}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <GraduationCap className="size-20 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Coach</Badge>
                {service.track?.name && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                    <MapPin className="size-3.5" />
                    {service.track.name}
                  </span>
                )}
              </div>
              <h1 className="font-bold text-3xl tracking-tight md:text-4xl">{service.title}</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{service.description}</p>

              {service.specialties?.length ? (
                <div className="flex flex-wrap gap-2">
                  {service.specialties.map((s: string) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <Separator />

              <div>
                <h2 className="font-semibold text-lg">Add-ons</h2>
                {service.addOns?.length ? (
                  <ul className="mt-2 space-y-2">
                    {service.addOns.map(
                      (a: {
                        name: string
                        price: number
                        isRequired?: boolean
                        priceType?: string
                      }) => (
                        <li
                          className="flex justify-between gap-4 text-sm"
                          key={`${a.name}-${a.price}`}
                        >
                          <span>
                            {a.name}
                            {a.isRequired ? (
                              <Badge className="ml-2" variant="secondary">
                                Required
                              </Badge>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-medium">
                            {formatMoney(a.price)}
                            {a.priceType === "daily" ? "/day" : ""}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground text-sm">No add-ons listed.</p>
                )}
              </div>

              {service.travelSurcharges && service.travelSurcharges.length > 0 ? (
                <div>
                  <h2 className="font-semibold text-lg">Travel surcharges</h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    One-time fee when your session is at these tracks:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {service.travelSurcharges.map(
                      (row: { trackId: string; amount: number; label?: string }) => (
                        <li className="flex justify-between gap-4" key={row.trackId}>
                          <span>{row.label || "Track fee"}</span>
                          <span className="font-medium">{formatMoney(row.amount)}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ) : null}
            </div>

            <Card className="w-full shrink-0 lg:max-w-sm">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="text-muted-foreground text-sm">From</p>
                  <p className="font-bold text-3xl">
                    {formatMoney(service.baseRate)}{" "}
                    <span className="font-normal text-base text-muted-foreground">
                      {unitLabel(service.pricingUnit)}
                    </span>
                  </p>
                </div>

                {service.coach && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                    <Avatar className="size-12">
                      <AvatarImage src={service.coach.profileImage} />
                      <AvatarFallback>{service.coach.name?.slice(0, 2) ?? "CO"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{service.coach.name ?? "Coach"}</p>
                      <p className="text-muted-foreground text-xs">Verified Stripe payouts</p>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => {
                    if (!isSignedIn) {
                      router.push(
                        `/sign-in?redirect_url=${encodeURIComponent(`/coaches/${serviceId}/book`)}`
                      )
                      return
                    }
                    router.push(`/coaches/${serviceId}/book`)
                  }}
                  size="lg"
                >
                  Request booking
                </Button>

                <Button className="w-full" onClick={handleShare} variant="outline">
                  <Share2 className="mr-2 size-4" />
                  Share listing
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
