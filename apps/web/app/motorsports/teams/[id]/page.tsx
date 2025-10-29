import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Globe, Instagram, Mail, MapPin, Phone, Twitter, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

type TeamDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  await params

  // Mock team data - in production, fetch from Convex
  const team = {
    id: "1",
    name: "Precision Racing Team",
    logoUrl: "https://images.unsplash.com/photo-1593998066526-65fcab3021a2?w=800",
    location: "Daytona Beach, FL",
    specialties: ["GT3", "Endurance", "Time Attack"],
    availableSeats: 2,
    requirements: [
      "FIA License",
      "5+ years experience",
      "Clean racing record",
      "Physical fitness test",
    ],
    description:
      "Professional endurance racing team with championship wins in multiple GT3 series. We compete in prestigious events including the IMSA WeatherTech SportsCar Championship and the World Endurance Championship. Our team is backed by factory support and state-of-the-art facilities.",
    contactInfo: {
      phone: "+1 (555) 123-4567",
      email: "contact@precisionracing.com",
      website: "www.precisionracing.com",
    },
    socialLinks: {
      instagram: "@precisionracing",
      twitter: "@precisionracing",
      linkedin: "precision-racing-team",
    },
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/motorsports">
        <Button className="mb-6" variant="outline">
          ← Back to Motorsports
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="relative h-64 w-full overflow-hidden rounded-t-lg">
              {team.logoUrl ? (
                <Image alt={team.name} className="object-cover" fill src={team.logoUrl} />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <span className="text-8xl">🏎️</span>
                </div>
              )}
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">{team.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-lg">About</h3>
                <p className="text-muted-foreground leading-relaxed">{team.description}</p>
              </div>

              <Separator />

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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Process</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Interested in joining our team? Click the button below to start your application.
              </p>
              <Button className="w-full" size="lg">
                Apply to This Team
              </Button>
              <p className="text-muted-foreground text-sm">* Application form coming soon</p>
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
                      <p className="text-muted-foreground text-sm">{team.contactInfo.website}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {team.socialLinks && (team.socialLinks.instagram || team.socialLinks.twitter) && (
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
