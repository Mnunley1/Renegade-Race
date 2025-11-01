"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import {
  Car,
  Edit,
  Calendar,
  Settings,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
} from "lucide-react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"

export default function HostVehiclesListPage() {
  const { user } = useUser()

  // TODO: Replace with Convex query
  // const vehicles = useQuery(api.vehicles.getByOwner, { ownerId: user?.id || "" })

  // Mock data - will be replaced with Convex query
  const vehicles = [
    {
      _id: "1",
      make: "Porsche",
      model: "911 GT3",
      year: 2023,
      dailyRate: 899,
      description: "Track-ready Porsche 911 GT3 with full racing package",
      isActive: true,
      isApproved: true,
      track: { name: "Daytona International Speedway", location: "Daytona Beach, FL" },
      images: [
        {
          cardUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400",
          isPrimary: true,
        },
      ],
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
    {
      _id: "2",
      make: "Ferrari",
      model: "F8 Tributo",
      year: 2022,
      dailyRate: 1199,
      description: "Stunning Ferrari F8 Tributo ready for the track",
      isActive: true,
      isApproved: false,
      track: { name: "Sebring International Raceway", location: "Sebring, FL" },
      images: [
        {
          cardUrl: "https://images.unsplash.com/photo-1549952891-fcf406dd2aa9?w=400",
          isPrimary: true,
        },
      ],
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    },
    {
      _id: "3",
      make: "Lamborghini",
      model: "Huracán",
      year: 2024,
      dailyRate: 1299,
      description: "Brand new Lamborghini Huracán track edition",
      isActive: false,
      isApproved: true,
      track: { name: "Circuit of the Americas", location: "Austin, TX" },
      images: [
        {
          cardUrl: "https://images.unsplash.com/photo-1593941707882-a5bac6861d0d?w=400",
          isPrimary: true,
        },
      ],
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    },
  ]

  const getStatusBadge = (vehicle: (typeof vehicles)[0]) => {
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

  const formatDate = (timestamp: number) => {
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
            const primaryImage =
              vehicle.images?.find((img) => img.isPrimary)?.cardUrl ||
              vehicle.images?.[0]?.cardUrl ||
              "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

            return (
              <Card key={vehicle._id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Vehicle Image */}
                  <div className="relative h-48 w-full md:h-auto md:w-64 shrink-0 overflow-hidden">
                    <img
                      alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                      className="size-full object-cover"
                      src={primaryImage}
                    />
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
                        <p className="mb-2 text-muted-foreground line-clamp-2">
                          {vehicle.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="size-4" />
                            Listed {formatDate(vehicle.createdAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Car className="size-4" />
                            {vehicle.track.name}
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
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 size-4" />
                          View Listing
                        </Button>
                      </Link>
                      <Link href={`/host/vehicles/${vehicle._id}`}>
                        <Button variant="outline" size="sm">
                          <Settings className="mr-2 size-4" />
                          Manage
                        </Button>
                      </Link>
                      <Link href={`/host/vehicles/${vehicle._id}/edit`}>
                        <Button variant="outline" size="sm">
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
