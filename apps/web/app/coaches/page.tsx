"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useQuery } from "convex/react"
import { GraduationCap, Loader2, MapPin } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo } from "react"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

function formatRate(cents: number, unit: string) {
  const u =
    unit === "hour"
      ? "/hr"
      : unit === "half_day"
        ? "/half day"
        : unit === "full_day"
          ? "/day"
          : "/session"
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${u}`
}

function CoachesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const trackParam = searchParams.get("track") as Id<"tracks"> | null

  const tracks = useQuery(api.tracks.getAll, {})
  const services = useQuery(
    api.coachServices.listPublic,
    trackParam ? { trackId: trackParam, limit: 60 } : { limit: 60 }
  )

  const sorted = useMemo(() => {
    if (!services) return []
    return [...services].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }, [services])

  return (
    <div className="min-h-screen bg-background">
      <div className="border-border border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <GraduationCap className="size-8" />
                <span className="font-semibold text-sm uppercase tracking-wide">Coaching</span>
              </div>
              <h1 className="font-bold text-3xl tracking-tight md:text-4xl">Find a coach</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Browse approved coaches with Stripe-verified payouts. Filter by track to match your
                event.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <label className="mb-1.5 block font-medium text-muted-foreground text-xs" htmlFor="track">
                Track
              </label>
              <Select
                onValueChange={(v) => {
                  if (v === "all") {
                    router.push("/coaches")
                  } else {
                    router.push(`/coaches?track=${v}`)
                  }
                }}
                value={trackParam ?? "all"}
              >
                <SelectTrigger className="w-full" id="track">
                  <SelectValue placeholder="All tracks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tracks</SelectItem>
                  {(tracks ?? []).map((t: { _id: string; name: string }) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {services === undefined ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Loading coaches…
          </div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <GraduationCap className="mx-auto mb-4 size-12 text-muted-foreground" />
              <p className="font-medium text-lg">No coaches match this filter yet</p>
              <p className="mt-2 text-muted-foreground text-sm">
                Try another track or check back soon.
              </p>
              <Button asChild className="mt-6" variant="outline">
                <Link href="/coaches">Clear filter</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((s) => {
              const img = s.images?.[0]
              const href = `/coaches/${s._id}`
              return (
                <Link href={href} key={s._id}>
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="relative aspect-[4/3] bg-muted">
                      {img?.cardUrl ? (
                        <Image
                          alt={s.title}
                          className="object-cover"
                          fill
                          sizes="(max-width:768px) 100vw, 33vw"
                          src={img.cardUrl}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <GraduationCap className="size-12 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h2 className="line-clamp-2 font-semibold text-lg">{s.title}</h2>
                      <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                        {s.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                        {s.track?.name && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {s.track.name}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 font-semibold text-foreground">
                        {formatRate(s.baseRate, s.pricingUnit)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CoachesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <CoachesContent />
    </Suspense>
  )
}
