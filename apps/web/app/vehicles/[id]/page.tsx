"use client"

import { useQuery } from "convex/react"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { MapPin, Shield, Star } from "lucide-react"
import { VehicleGallery } from "@/components/vehicle-gallery"
import { BookingForm } from "@/components/booking-form"
import { api } from "@/lib/convex"
import { useParams } from "next/navigation"
import Image from "next/image"

export default function VehicleDetailsPage() {
  const params = useParams()
  const id = params.id as string

  const vehicle = useQuery(api.vehicles.getById, { id: id as any })

  // Show loading state
  if (!vehicle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading vehicle details...</p>
          </div>
        </div>
      </div>
    )
  }

  // Extract image URLs
  const images = vehicle.images?.map((img) => img.cardUrl || img.imageUrl || "") || []

  // Host information from owner
  const host = {
    name: vehicle.owner?.name || "Unknown",
    avatar: vehicle.owner?.profileImage || "",
    verified: false, // Would need to check owner verification status
    memberSince: vehicle.owner?.memberSince || "",
    tripsCompleted: vehicle.owner?.totalRentals || 0,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button className="mb-4" variant="ghost">
          ← Back to search
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="mb-2 font-bold text-4xl">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" />
              <span>{vehicle.track?.location || vehicle.track?.name || "Location TBD"}</span>
            </div>
          </div>
          {/* Rating and reviews would come from reviews query */}
          <div className="text-right">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex items-center">
                <Star className="size-5 fill-yellow-400 text-yellow-400" />
                <span className="ml-1 font-bold">0.0</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">0 reviews</p>
          </div>
        </div>
      </div>

      <VehicleGallery images={images} vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-muted-foreground">{vehicle.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {vehicle.horsepower && (
                  <div>
                    <Badge className="mb-2 w-full justify-start" variant="outline">
                      Horsepower
                    </Badge>
                    <p className="font-semibold text-lg">{vehicle.horsepower} hp</p>
                  </div>
                )}
                {vehicle.transmission && (
                  <div>
                    <Badge className="mb-2 w-full justify-start" variant="outline">
                      Transmission
                    </Badge>
                    <p className="font-semibold text-lg">{vehicle.transmission}</p>
                  </div>
                )}
                {vehicle.drivetrain && (
                  <div>
                    <Badge className="mb-2 w-full justify-start" variant="outline">
                      Drivetrain
                    </Badge>
                    <p className="font-semibold text-lg">{vehicle.drivetrain}</p>
                  </div>
                )}
                {vehicle.engineType && (
                  <div>
                    <Badge className="mb-2 w-full justify-start" variant="outline">
                      Engine
                    </Badge>
                    <p className="font-semibold text-lg">{vehicle.engineType}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Host Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={vehicle.host.avatar} />
                  <AvatarFallback>{vehicle.host.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{vehicle.host.name}</h3>
                    {vehicle.host.verified && (
                      <Badge className="bg-green-500" variant="default">
                        <Shield className="mr-1 size-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Member since {vehicle.host.memberSince} • {vehicle.host.tripsCompleted} trips
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="py-8 text-center text-muted-foreground">
                No reviews yet. Be the first to review!
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Book this vehicle</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingForm pricePerDay={vehicle.dailyRate} vehicleId={vehicle._id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
