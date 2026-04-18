"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { api } from "@/lib/convex"

function statusBadge(service: {
  isActive: boolean
  isApproved?: boolean
  isSuspended?: boolean
}) {
  if (service.isSuspended) {
    return (
      <Badge className="gap-1.5 bg-amber-500/10 text-amber-800 dark:text-amber-200">
        <XCircle className="size-3" />
        Suspended
      </Badge>
    )
  }
  if (!service.isActive) {
    return (
      <Badge className="gap-1.5 bg-gray-500/10 text-gray-700 dark:text-gray-400">
        <XCircle className="size-3" />
        Inactive
      </Badge>
    )
  }
  if (service.isApproved === undefined) {
    return (
      <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
        <Clock className="size-3" />
        Pending approval
      </Badge>
    )
  }
  if (service.isApproved === false) {
    return (
      <Badge className="gap-1.5 bg-red-500/10 text-red-700 dark:text-red-300">
        <XCircle className="size-3" />
        Not approved
      </Badge>
    )
  }
  return (
    <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
      <CheckCircle2 className="size-3" />
      Live
    </Badge>
  )
}

export default function HostCoachingListPage() {
  const { user } = useUser()
  const services = useQuery(
    api.coachServices.listByCoach,
    user?.id ? { coachId: user.id, includeDeleted: false } : "skip"
  )

  if (services === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Link href="/host/dashboard">
        <Button className="mb-4" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back to Dashboard
        </Button>
      </Link>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl">Coaching programs</h1>
          <p className="mt-2 text-muted-foreground">
            Manage listings, pricing, and availability
          </p>
        </div>
        <Button asChild>
          <Link href="/host/coaching/new">
            <Plus className="mr-2 size-4" />
            New program
          </Link>
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <GraduationCap className="mb-4 size-12 text-muted-foreground" />
            <p className="font-medium text-lg">No coaching programs yet</p>
            <Button asChild className="mt-6">
              <Link href="/host/coaching/new">Create your first program</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((s: (typeof services)[number]) => {
            const img = s.images?.[0]
            return (
              <Link href={`/host/coaching/${s._id}/edit`} key={s._id}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="relative aspect-[16/9] bg-muted">
                    {img?.cardUrl ? (
                      <Image
                        alt={s.title}
                        className="object-cover"
                        fill
                        src={img.cardUrl}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <GraduationCap className="size-12 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {statusBadge(s)}
                    </div>
                    <h2 className="font-semibold text-lg">{s.title}</h2>
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                      {s.description}
                    </p>
                    <p className="mt-3 font-medium">
                      ${(s.baseRate / 100).toFixed(0)} / {s.pricingUnit.replace("_", " ")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
