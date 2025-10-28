import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Calendar, Settings, Star } from "lucide-react"
import Link from "next/link"
import { VehicleCard } from "@/components/vehicle-card"

export default function ProfilePage() {
  const upcomingTrips: Array<{
    id: string
    image: string
    name: string
    year: number
    make: string
    model: string
    pricePerDay: number
    location: string
  }> = []
  const pastTrips = [
    {
      id: "1",
      image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800",
      name: "Porsche 911 GT3",
      year: 2023,
      make: "Porsche",
      model: "911 GT3",
      pricePerDay: 899,
      location: "Daytona Beach, FL",
      date: "Jan 15-17, 2024",
    },
  ]
  const favorites = [
    {
      id: "2",
      image: "https://images.unsplash.com/photo-1593941707882-a5bac6861d0d?w=800",
      name: "Lamborghini Huracán",
      year: 2024,
      make: "Lamborghini",
      model: "Huracán",
      pricePerDay: 1299,
      location: "Miami, FL",
      rating: 5.0,
      reviews: 45,
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="size-20">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="font-semibold text-lg">John Doe</h2>
                <p className="text-muted-foreground text-sm">Member since 2022</p>
              </div>
              <Link className="w-full" href="/profile/settings">
                <Button className="w-full" variant="outline">
                  <Settings className="mr-2 size-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Account Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="font-bold text-3xl">12</p>
                <p className="text-muted-foreground text-sm">Trips</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-3xl">4.8</p>
                <p className="text-muted-foreground text-sm">Avg Rating</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-3xl">5</p>
                <p className="text-muted-foreground text-sm">Favorites</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs className="w-full" defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">My Trips</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="trips">
          <div>
            <h3 className="mb-4 font-semibold text-lg">Upcoming Trips</h3>
            {upcomingTrips.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No upcoming trips</p>
                  <Link href="/vehicles">
                    <Button className="mt-4">Browse Vehicles</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingTrips.map((trip) => (
                  <VehicleCard key={trip.id} {...trip} />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="mb-4 font-semibold text-lg">Past Trips</h3>
            {pastTrips.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No past trips</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pastTrips.map((trip) => (
                  <VehicleCard key={trip.id} {...trip} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Star className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">No favorite vehicles yet</p>
                <Link href="/vehicles">
                  <Button className="mt-4">Browse Vehicles</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {favorites.map((vehicle) => (
                <VehicleCard key={vehicle.id} {...vehicle} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No reviews yet</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
