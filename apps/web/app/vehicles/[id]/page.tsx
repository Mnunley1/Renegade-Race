import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Calendar, DollarSign, MapPin, Shield, Star, Users } from "lucide-react"
import Image from "next/image"

type VehicleDetailsPageProps = {
  params: Promise<{ id: string }>
}

export default async function VehicleDetailsPage({ params }: VehicleDetailsPageProps) {
  const { id } = await params

  // Mock data - replace with actual API call
  const vehicle = {
    id,
    images: [
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200",
      "https://images.unsplash.com/photo-1605170088216-9058e29c8e9f?w=1200",
      "https://images.unsplash.com/photo-1549952891-fcf406dd2aa9?w=1200",
    ],
    name: "Porsche 911 GT3",
    year: 2023,
    make: "Porsche",
    model: "911 GT3",
    pricePerDay: 899,
    location: "Daytona Beach, FL",
    rating: 4.9,
    reviews: 23,
    specs: {
      horsepower: "502 hp",
      torque: "346 lb-ft",
      topSpeed: "197 mph",
      zeroTo60: "3.2s",
    },
    description:
      "Experience the thrill of driving a track-ready Porsche 911 GT3. This exceptional sports car delivers uncompromising performance on both the road and track. With its naturally aspirated 4.0-liter flat-six engine producing 502 horsepower, the GT3 offers an exhilarating driving experience.",
    host: {
      name: "Mike Johnson",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
      verified: true,
      memberSince: "2019",
      tripsCompleted: 127,
    },
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
              <span>{vehicle.location}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex items-center">
                <Star className="size-5 fill-yellow-400 text-yellow-400" />
                <span className="ml-1 font-bold">{vehicle.rating}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">{vehicle.reviews} reviews</p>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Image
            alt={vehicle.name}
            className="h-96 w-full rounded-lg object-cover"
            height={600}
            src={vehicle.images[0]}
            width={800}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          {vehicle.images.slice(1).map((image) => (
            <Image
              alt={`${vehicle.name}`}
              className="h-48 w-full rounded-lg object-cover"
              height={300}
              key={image}
              src={image}
              width={400}
            />
          ))}
        </div>
      </div>

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
                <div>
                  <Badge className="mb-2 w-full justify-start" variant="outline">
                    Horsepower
                  </Badge>
                  <p className="font-semibold text-lg">{vehicle.specs.horsepower}</p>
                </div>
                <div>
                  <Badge className="mb-2 w-full justify-start" variant="outline">
                    Torque
                  </Badge>
                  <p className="font-semibold text-lg">{vehicle.specs.torque}</p>
                </div>
                <div>
                  <Badge className="mb-2 w-full justify-start" variant="outline">
                    Top Speed
                  </Badge>
                  <p className="font-semibold text-lg">{vehicle.specs.topSpeed}</p>
                </div>
                <div>
                  <Badge className="mb-2 w-full justify-start" variant="outline">
                    0-60 mph
                  </Badge>
                  <p className="font-semibold text-lg">{vehicle.specs.zeroTo60}</p>
                </div>
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
            <CardContent className="space-y-6">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-3xl">${vehicle.pricePerDay}</span>
                <span className="text-muted-foreground text-sm">/day</span>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label htmlFor="check-in">Check in</Label>
                  <Input id="check-in" type="date" />
                </div>
                <div>
                  <Label htmlFor="check-out">Check out</Label>
                  <Input id="check-out" type="date" />
                </div>
              </div>

              <Separator />

              <Button className="w-full" size="lg">
                Reserve Now
              </Button>

              <p className="text-center text-muted-foreground text-xs">You won't be charged yet</p>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Free cancellation</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Pay at pickup</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Instant booking</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
