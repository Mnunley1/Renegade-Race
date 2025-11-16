"use client"

import { useQuery } from "convex/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import {
  Award,
  Calendar,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Star,
  Twitter,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { use } from "react"
import { api } from "@/lib/convex"

type DriverDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

const experienceColors = {
  beginner: "bg-green-500/10 text-green-600 dark:text-green-400",
  intermediate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  advanced: "bg-purple-500/10 text-purple-600 dark:text-purple-600",
  professional: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
}

const experienceLabels = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  professional: "Professional",
}

export default function DriverDetailPage({ params }: DriverDetailPageProps) {
  const { id } = use(params)
  const driverProfile = useQuery(api.driverProfiles.getById, {
    profileId: id as any,
  })

  if (driverProfile === undefined) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading driver profile...</p>
        </div>
      </div>
    )
  }

  if (driverProfile === null || !driverProfile.isActive) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/motorsports/drivers">
          <Button className="mb-6" variant="outline">
            ← Back to Drivers
          </Button>
        </Link>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="mb-2 font-semibold text-lg">Driver Profile Not Found</p>
            <p className="text-muted-foreground text-sm">
              This driver profile may have been removed or is not available.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const driverName = driverProfile.user?.name || "Unknown Driver"
  const avatarUrl = driverProfile.user?.avatarUrl

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/motorsports/drivers">
        <Button className="mb-6" variant="outline">
          ← Back to Drivers
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="relative h-64 w-full overflow-hidden rounded-t-lg">
              {avatarUrl ? (
                <Image
                  alt={driverName}
                  className="object-cover"
                  fill
                  src={avatarUrl}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <div className="relative size-32 overflow-hidden rounded-full border-4 border-primary/20">
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-6xl">👤</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{driverName}</CardTitle>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={experienceColors[driverProfile.experience]}>
                      <Award className="mr-1 size-3" />
                      {experienceLabels[driverProfile.experience]}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-lg">About</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {driverProfile.bio}
                </p>
              </div>

              {driverProfile.achievements && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">Achievements</h3>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                      {driverProfile.achievements}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h3 className="mb-3 font-semibold text-lg">Licenses</h3>
                <div className="flex flex-wrap gap-2">
                  {driverProfile.licenses.length > 0 ? (
                    driverProfile.licenses.map((license) => (
                      <Badge key={license} variant="outline" className="px-3 py-1 text-sm">
                        {license}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No licenses listed</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="mb-3 font-semibold text-lg">Preferred Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {driverProfile.preferredCategories.length > 0 ? (
                    driverProfile.preferredCategories.map((category) => (
                      <Badge key={category} variant="secondary" className="px-3 py-1 text-sm">
                        <Star className="mr-1 size-3" />
                        {category}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No categories listed</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="mb-3 font-semibold text-lg">Availability</h3>
                <div className="flex flex-wrap gap-2">
                  {driverProfile.availability.length > 0 ? (
                    driverProfile.availability.map((availability) => {
                      const availabilityLabels: Record<string, string> = {
                        "single-race": "Single Race",
                        "multi-race": "Multi-Race",
                        "season-commitment": "Season Commitment",
                        // Legacy support for old values
                        "weekends": "Weekends",
                        "weekdays": "Weekdays",
                        "evenings": "Evenings",
                        "flexible": "Flexible",
                      }
                      const label = availabilityLabels[availability] || availability.charAt(0).toUpperCase() + availability.slice(1).replace(/-/g, " ")
                      return (
                        <Badge key={availability} variant="outline" className="px-3 py-1 text-sm">
                          <Calendar className="mr-1 size-3" />
                          {label}
                        </Badge>
                      )
                    })
                  ) : (
                    <p className="text-muted-foreground text-sm">No availability listed</p>
                  )}
                </div>
              </div>

              {(driverProfile.racingType === "sim-racing" || driverProfile.racingType === "both") && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">Sim Racing</h3>
                    <div className="space-y-3">
                      {driverProfile.simRacingPlatforms && driverProfile.simRacingPlatforms.length > 0 && (
                        <div>
                          <p className="mb-2 text-muted-foreground text-sm font-medium">Platforms</p>
                          <div className="flex flex-wrap gap-2">
                            {driverProfile.simRacingPlatforms.map((platform) => (
                              <Badge key={platform} variant="secondary" className="px-3 py-1 text-sm">
                                🎮 {platform}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {driverProfile.simRacingRating && (
                        <div>
                          <p className="mb-2 text-muted-foreground text-sm font-medium">Rating</p>
                          <p className="text-muted-foreground">{driverProfile.simRacingRating}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="size-5 text-primary" />
                  <div>
                    <p className="font-semibold">Location</p>
                    <p className="text-muted-foreground text-sm">{driverProfile.location}</p>
                  </div>
                </div>

                {driverProfile.contactInfo?.phone && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Phone className="size-5 text-primary" />
                      <div>
                        <p className="font-semibold">Phone</p>
                        <p className="text-muted-foreground text-sm">
                          {driverProfile.contactInfo.phone}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {driverProfile.contactInfo?.email && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Mail className="size-5 text-primary" />
                      <div>
                        <p className="font-semibold">Email</p>
                        <p className="break-all text-muted-foreground text-sm">
                          {driverProfile.contactInfo.email}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {driverProfile.socialLinks &&
            (driverProfile.socialLinks.instagram ||
              driverProfile.socialLinks.twitter ||
              driverProfile.socialLinks.linkedin ||
              driverProfile.socialLinks.website) && (
              <Card>
                <CardHeader>
                  <CardTitle>Connect</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {driverProfile.socialLinks.instagram && (
                      <Button
                        asChild
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <a
                          href={
                            driverProfile.socialLinks.instagram.startsWith("@")
                              ? `https://instagram.com/${driverProfile.socialLinks.instagram.slice(1)}`
                              : driverProfile.socialLinks.instagram.startsWith("http")
                                ? driverProfile.socialLinks.instagram
                                : `https://instagram.com/${driverProfile.socialLinks.instagram}`
                          }
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Instagram className="mr-2 size-4" />
                          Instagram
                        </a>
                      </Button>
                    )}
                    {driverProfile.socialLinks.twitter && (
                      <Button
                        asChild
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <a
                          href={
                            driverProfile.socialLinks.twitter.startsWith("@")
                              ? `https://twitter.com/${driverProfile.socialLinks.twitter.slice(1)}`
                              : driverProfile.socialLinks.twitter.startsWith("http")
                                ? driverProfile.socialLinks.twitter
                                : `https://twitter.com/${driverProfile.socialLinks.twitter}`
                          }
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Twitter className="mr-2 size-4" />
                          Twitter
                        </a>
                      </Button>
                    )}
                    {driverProfile.socialLinks.linkedin && (
                      <Button
                        asChild
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <a
                          href={
                            driverProfile.socialLinks.linkedin.startsWith("http")
                              ? driverProfile.socialLinks.linkedin
                              : `https://linkedin.com/in/${driverProfile.socialLinks.linkedin}`
                          }
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Linkedin className="mr-2 size-4" />
                          LinkedIn
                        </a>
                      </Button>
                    )}
                    {driverProfile.socialLinks.website && (
                      <Button
                        asChild
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <a
                          href={
                            driverProfile.socialLinks.website.startsWith("http")
                              ? driverProfile.socialLinks.website
                              : `https://${driverProfile.socialLinks.website}`
                          }
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Globe className="mr-2 size-4" />
                          Website
                        </a>
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

