"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { FileText, Flag, User, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { RecommendationCard } from "@/components/recommendation-card"
import { api } from "@/lib/convex"

export default function MotorsportsPage() {
  const { user } = useUser()

  const userDriverProfile = useQuery(api.driverProfiles.getByUser)
  const recommendedTeams = useQuery(
    api.motorsportsMatching.getRecommendedTeams,
    userDriverProfile && userDriverProfile.length > 0 ? {} : "skip"
  )

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <Card className="group relative mb-10 overflow-hidden border-2 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <CardContent className="relative p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Badge className="px-4 py-1.5 font-semibold text-sm shadow-sm">
                  <Flag className="mr-1.5 inline size-4" />
                  Motorsports Network
                </Badge>
              </div>
              <div className="space-y-3">
                <h1 className="font-bold text-3xl leading-tight tracking-tight md:text-4xl">
                  Connect Drivers with
                  <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Racing Teams
                  </span>
                </h1>
                <p className="text-base text-muted-foreground leading-relaxed md:text-lg">
                  Find your perfect match and accelerate your racing career in real-world racing or
                  sim racing.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="shadow-md" size="lg">
                  <Link href="/motorsports/profile/driver">
                    <User className="mr-2 size-4" />
                    Join as Driver
                  </Link>
                </Button>
                <Button asChild className="shadow-md" size="lg" variant="outline">
                  <Link href="/motorsports/profile/team">
                    <Users className="mr-2 size-4" />
                    Join as Team
                  </Link>
                </Button>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl ring-2 ring-primary/20 transition-transform duration-500 group-hover:scale-[1.02]">
                <Image
                  alt="Motorsports racing"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  fill
                  priority
                  src="/images/christian-palazzolo-UF0QX-zaNXc-unsplash.jpg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Cards */}
      <div className="mb-10 grid gap-6 md:grid-cols-2">
        <Link className="group/card" href="/motorsports/teams">
          <Card className="h-full transition-shadow hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
                <Users className="size-7 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-xl group-hover/card:text-primary">
                  Browse Teams
                </h2>
                <p className="text-muted-foreground text-sm">
                  Find racing teams looking for drivers
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link className="group/card" href="/motorsports/drivers">
          <Card className="h-full transition-shadow hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
                <User className="size-7 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-xl group-hover/card:text-primary">
                  Browse Drivers
                </h2>
                <p className="text-muted-foreground text-sm">
                  Discover talented drivers seeking opportunities
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* My Applications link */}
      {user && (
        <div className="mb-10 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/motorsports/applications">
              <FileText className="mr-2 size-4" />
              My Applications
            </Link>
          </Button>
        </div>
      )}

      {/* Recommendations Section */}
      {recommendedTeams && recommendedTeams.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 font-semibold text-xl">Recommended for You</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendedTeams.map((team: any) => (
              <RecommendationCard
                availableSeats={team.availableSeats}
                id={team._id}
                key={team._id}
                location={team.location}
                matchScore={team.matchScore}
                name={team.name}
                specialties={team.specialties}
                type="team"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
