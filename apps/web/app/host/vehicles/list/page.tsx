"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import {
  ArrowLeft,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import Image from "@/components/public-image"
import { api } from "@/lib/convex"
import { r2Url } from "@/lib/r2-url"
import { formatRentalUsd } from "@/lib/rental-checkout"

export default function HostVehiclesListPage() {
  const { user } = useUser()

  // Fetch vehicles from Convex
  const vehicles = useQuery(api.vehicles.getByOwner, user?.id ? { ownerId: user.id } : "skip")

  // Show loading state
  if (vehicles === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading vehicles...</p>
          </div>
        </div>
      </div>
    )
  }

  const getStatusBadge = (
    vehicle:
      | (typeof vehicles)[0]
      | {
          isActive: boolean
          isApproved: boolean
        }
  ) => {
    if (!vehicle.isActive) {
      return (
        <Badge className="gap-1.5 bg-gray-500/10 text-gray-700 dark:text-gray-400">
          <XCircle className="size-3" />
          Inactive
        </Badge>
      )
    }
    if (!vehicle.isApproved) {
      return (
        <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <Clock className="size-3" />
          Pending Approval
        </Badge>
      )
    }
    return (
      <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
        <CheckCircle2 className="size-3" />
        Active
      </Badge>
    )
  }

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Unknown"
    const date = new Date(timestamp)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link href="/host/dashboard">
          <Button className="mb-4 -ml-2 text-muted-foreground" size="sm" variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to dashboard
          </Button>
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Your vehicles</h1>
            <p className="mt-1.5 text-muted-foreground">
              Manage all your listed vehicles in one place
            </p>
          </div>
          <Link href="/host/vehicles/new">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              List New Vehicle
            </Button>
          </Link>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="mb-2 font-semibold text-lg">No vehicles listed yet</p>
            <p className="mb-6 text-muted-foreground">
              List your first vehicle to start earning rental income
            </p>
            <Link href="/host/vehicles/new">
              <Button size="lg">
                <Plus className="mr-2 size-4" />
                List Your First Vehicle
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vehicles.map((vehicle: any) => {
            // Get the primary image r2Key for ImageKit
            const primaryImageKey =
              vehicle.images?.find((img: any) => img.isPrimary)?.r2Key ||
              vehicle.images?.[0]?.r2Key ||
              null

            const hasValidImage = primaryImageKey && primaryImageKey.trim() !== ""

            return (
              <Card key={vehicle._id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Vehicle Image */}
                    <div className="relative flex h-32 w-48 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {hasValidImage ? (
                        <Image
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="object-cover"
                          fill
                          quality={80}
                          sizes="192px"
                          src={r2Url(primaryImageKey)}
                        />
                      ) : (
                        <Car className="size-10 text-muted-foreground/40" />
                      )}
                    </div>

                    {/* Vehicle Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h2>
                        {getStatusBadge(vehicle)}
                      </div>
                      <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
                        {vehicle.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="size-3.5" />
                          Listed {formatDate(vehicle.createdAt)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Car className="size-3.5" />
                          {vehicle.track?.name || "Track TBD"}
                        </span>
                        <span className="font-semibold text-primary">
                          {formatRentalUsd(vehicle.dailyRate)}/day
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Link href={`/vehicles/${vehicle._id}`}>
                      <Button size="sm" variant="ghost">
                        <Eye className="mr-2 size-4" />
                        View listing
                      </Button>
                    </Link>
                    <Link href={`/host/vehicles/${vehicle._id}/edit`}>
                      <Button size="sm" variant="outline">
                        <Edit className="mr-2 size-4" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
