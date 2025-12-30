"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useQuery } from "convex/react"
import { ArrowLeft, Globe, Instagram, Mail, MapPin, Phone, Twitter, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { use } from "react"
import { TeamApplicationForm } from "@/components/team-application-form"
import { api } from "@/lib/convex"
import type { Id } from "../../../../packages/backend/convex/_generated/dataModel"

type TeamDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { id } = use(params)
  const teamId = id as Id<"teams">
  const team = useQuery(api.teams.getById, { teamId })

  if (team === undefined) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading team...</p>
        </div>
      </div>
    )
  }

  if (team === null) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/motorsports/teams">
          <Button className="mb-6" variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            Back to Teams
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 font-semibold text-lg">Team not found</p>
            <p className="mb-6 text-muted-foreground text-sm">
              The team you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link href="/motorsports/teams">Browse Teams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/motorsports/teams">
        <Button className="mb-6" variant="outline">
          <ArrowLeft className="mr-2 size-4" />
          Back to Teams
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="relative h-64 w-full overflow-hidden rounded-t-lg">
              {team.logoUrl ? (
                <Image alt={team.name} className="object-cover" fill src={team.logoUrl} />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary">
                  <h3 className="font-bold text-4xl text-white">{team.name}</h3>
                </div>
              )}
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">{team.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {team.description && (
                <>
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">About</h3>
                    <p className="text-muted-foreground leading-relaxed">{team.description}</p>
                  </div>
                  <Separator />
                </>
              )}

              {team.specialties && team.specialties.length > 0 && (
                <>
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">Specialties</h3>
                    <div className="flex flex-wrap gap-2">
                      {team.specialties.map((specialty) => (
                        <Badge className="px-3 py-1 text-sm" key={specialty}>
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {team.requirements && team.requirements.length > 0 && (
                <div>
                  <h3 className="mb-3 font-semibold text-lg">Requirements</h3>
                  <ul className="space-y-2">
                    {team.requirements.map((requirement) => (
                      <li
                        className="flex items-start gap-2 text-muted-foreground"
                        key={`requirement-${requirement}`}
                      >
                        <span className="text-primary">•</span>
                        <span>{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <TeamApplicationForm teamId={teamId} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="size-5 text-primary" />
                  <div>
                    <p className="font-semibold">Location</p>
                    <p className="text-muted-foreground text-sm">{team.location}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Users className="size-5 text-primary" />
                  <div>
                    <p className="font-semibold">Available Seats</p>
                    <p className="text-muted-foreground text-sm">
                      {team.availableSeats} positions open
                    </p>
                  </div>
                </div>

                {team.contactInfo && (
                  <>
                    <Separator />
                    {team.contactInfo.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="size-5 text-primary" />
                        <div>
                          <p className="font-semibold">Phone</p>
                          <p className="text-muted-foreground text-sm">{team.contactInfo.phone}</p>
                        </div>
                      </div>
                    )}

                    {team.contactInfo.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="size-5 text-primary" />
                        <div>
                          <p className="font-semibold">Email</p>
                          <p className="break-all text-muted-foreground text-sm">
                            {team.contactInfo.email}
                          </p>
                        </div>
                      </div>
                    )}

                    {team.contactInfo.website && (
                      <div className="flex items-center gap-3">
                        <Globe className="size-5 text-primary" />
                        <div>
                          <p className="font-semibold">Website</p>
                          <p className="text-muted-foreground text-sm">
                            {team.contactInfo.website}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {team.socialLinks &&
            (team.socialLinks.instagram ||
              team.socialLinks.twitter ||
              team.socialLinks.facebook ||
              team.socialLinks.linkedin) && (
              <Card>
                <CardHeader>
                  <CardTitle>Connect</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    {team.socialLinks.instagram && (
                      <Button size="icon" type="button" variant="outline">
                        <Instagram className="size-5" />
                      </Button>
                    )}
                    {team.socialLinks.twitter && (
                      <Button size="icon" type="button" variant="outline">
                        <Twitter className="size-5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  )
}
