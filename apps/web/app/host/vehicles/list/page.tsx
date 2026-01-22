"use client"

import { useUser } from "@clerk/nextjs"
import { Image, ImageKitProvider } from "@imagekit/next"
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
import { api } from "@/lib/convex"

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
      <div className="mb-8">
        <Link href="/host/dashboard">
          <Button className="mb-4" variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl">Your Vehicles</h1>
            <p className="mt-2 text-muted-foreground">
              Manage all your listed vehicles in one place
            </p>
          </div>
          <Link href="/host/vehicles/new">
            <Button size="lg">
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
        <div className="space-y-4">
          {vehicles.map((vehicle) => {
            // Get the primary image r2Key for ImageKit
            const primaryImageKey =
              vehicle.images?.find((img) => img.isPrimary)?.r2Key ||
              vehicle.images?.[0]?.r2Key ||
              null

            const hasValidImage = primaryImageKey && primaryImageKey.trim() !== ""

            return (
              <Card className="overflow-hidden" key={vehicle._id}>
                <div className="flex flex-col md:flex-row">
                  {/* Vehicle Image */}
                  <div className="relative flex h-48 w-full shrink-0 items-center justify-center overflow-hidden bg-muted md:h-auto md:w-64">
                    {hasValidImage ? (
                      <ImageKitProvider urlEndpoint={process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/renegaderace"}>
                        <Image
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="size-full object-cover"
                          fill
                          src={`/${primaryImageKey}`}
                          transformation={[{ width: 400, height: 300, quality: 80 }]}
                        />
                      </ImageKitProvider>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Car className="size-12 text-muted-foreground/40" />
                        <p className="text-muted-foreground text-xs">No image</p>
                      </div>
                    )}
                  </div>

                  {/* Vehicle Details */}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <h2 className="font-bold text-xl">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </h2>
                          {getStatusBadge(vehicle)}
                        </div>
                        <p className="mb-2 line-clamp-2 text-muted-foreground">
                          {vehicle.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="size-4" />
                            Listed {formatDate(vehicle.createdAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Car className="size-4" />
                            {vehicle.track?.name || "Track TBD"}
                          </span>
                          <span className="font-semibold text-primary">
                            ${vehicle.dailyRate}/day
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link href={`/vehicles/${vehicle._id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 size-4" />
                          View Listing
                        </Button>
                      </Link>
                      <Link href={`/host/vehicles/${vehicle._id}/edit`}>
                        <Button size="sm" variant="outline">
                          <Edit className="mr-2 size-4" />
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
