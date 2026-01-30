"use client"

import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  Award,
  Calendar,
  Edit,
  Eye,
  EyeOff,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Star,
  Trash2,
  Twitter,
  User,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { use, useEffect, useState } from "react"
import { toast } from "sonner"
import { DriverCard } from "@/components/driver-card"
import { DriverEndorsements } from "@/components/driver-endorsements"
import { DriverPortfolio } from "@/components/driver-portfolio"
import { ProfileAnalytics } from "@/components/profile-analytics"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import type { Id } from "@/lib/convex"

type DriverDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

const experienceColors: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-600 dark:text-green-400",
  intermediate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  advanced: "bg-purple-500/10 text-purple-600 dark:text-purple-600",
  professional: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
}

const experienceLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  professional: "Professional",
}

const racingTypeLabels: Record<string, string> = {
  "real-world": "🏎️ Real-World",
  "sim-racing": "🎮 Sim Racing",
  both: "🏎️🎮 Both",
}

function getInstagramUrl(instagram: string): string {
  if (instagram.startsWith("@")) {
    return `https://instagram.com/${instagram.slice(1)}`
  }
  if (instagram.startsWith("http")) {
    return instagram
  }
  return `https://instagram.com/${instagram}`
}

function getTwitterUrl(twitter: string): string {
  if (twitter.startsWith("@")) {
    return `https://twitter.com/${twitter.slice(1)}`
  }
  if (twitter.startsWith("http")) {
    return twitter
  }
  return `https://twitter.com/${twitter}`
}

function getLinkedInUrl(linkedin: string): string {
  if (linkedin.startsWith("http")) {
    return linkedin
  }
  return `https://linkedin.com/in/${linkedin}`
}

function getWebsiteUrl(website: string): string {
  if (website.startsWith("http")) {
    return website
  }
  return `https://${website}`
}

export default function DriverDetailPage({ params }: DriverDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useUser()
  const profileId = id as Id<"driverProfiles">
  const driverProfile = useQuery(api.driverProfiles.getById, {
    profileId,
  })
  const similarDrivers = useQuery(api.driverProfiles.getSimilar, { profileId })
  const toggleVisibility = useMutation(api.driverProfiles.toggleVisibility)
  const deleteProfile = useMutation(api.driverProfiles.deleteProfile)

  // Get user's teams to check if they can request connection
  const userTeams = useQuery(api.teams.getByOwner, user?.id ? {} : "skip")
  const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | null>(null)
  const [connectionMessage, setConnectionMessage] = useState("")
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [isRequestingConnection, setIsRequestingConnection] = useState(false)
  const requestConnection = useMutation(api.teamDriverConnections.requestConnection)

  // Check if any of user's teams has an accepted connection with this driver
  // We'll check connections for the first team (can be expanded to check all teams)
  const firstTeamConnection = useQuery(
    api.teamDriverConnections.checkConnection,
    userTeams && userTeams.length > 0 && profileId
      ? { teamId: userTeams[0]!._id, driverProfileId: profileId }
      : "skip"
  )
  const hasAcceptedConnection = (firstTeamConnection as any)?.status === "accepted"

  const createConversation = useMutation(api.conversations.createMotorsportsConversation)
  const recordView = useMutation(api.profileViews.recordView)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  // Record profile view for non-owners
  useEffect(() => {
    if (driverProfile && user && !driverProfile.isOwner) {
      recordView({ profileId: profileId, profileType: "driver" })
    }
  }, [driverProfile, user, profileId, recordView])

  if (driverProfile === undefined) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-10 w-40" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Skeleton className="size-32 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-9 w-64" />
                    <Skeleton className="h-6 w-40" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Skeleton className="mb-3 h-6 w-24" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Separator />
                <div>
                  <Skeleton className="mb-3 h-6 w-32" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-7 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Separator />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (driverProfile === null) {
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

  // Allow owners to see their profile even if it's hidden
  const isOwner = driverProfile.isOwner
  const isHidden = !driverProfile.isActive
  if (isHidden && !isOwner) {
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
  const avatarUrl = driverProfile.avatarUrl || driverProfile.user?.avatarUrl

  const handleToggleVisibility = async () => {
    setIsToggling(true)
    try {
      await toggleVisibility({ profileId })
      toast.success(
        driverProfile.isActive ? "Profile hidden successfully" : "Profile made visible successfully"
      )
    } catch (error) {
      handleErrorWithContext(error, {
        action: "update profile visibility",
        customMessages: {
          generic: "Failed to update profile visibility. Please try again.",
        },
      })
    } finally {
      setIsToggling(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteProfile({ profileId })
      toast.success("Profile deleted successfully")
      router.push("/motorsports/drivers")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "delete profile",
        customMessages: {
          generic: "Failed to delete profile. Please try again.",
        },
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-20 lg:pb-8">
      <Link href="/motorsports/drivers">
        <Button className="mb-6" variant="outline">
          <ArrowLeft className="mr-2 size-4" />
          Back to Drivers
        </Button>
      </Link>

      {isHidden && isOwner && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <EyeOff className="size-5 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">Your profile is currently hidden</p>
            <p className="text-amber-700 text-sm dark:text-amber-300">Other users cannot see this profile.</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleToggleVisibility} disabled={isToggling}>
            {isToggling ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Eye className="mr-1 size-3" />}
            Make Visible
          </Button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar className="size-32">
                  {avatarUrl ? <AvatarImage alt={driverName} src={avatarUrl} /> : null}
                  <AvatarFallback className="bg-primary text-white">
                    <User className="size-16" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-3xl">{driverName}</CardTitle>
                  {driverProfile.headline && (
                    <p className="mt-1 text-muted-foreground text-lg">{driverProfile.headline}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className={experienceColors[driverProfile.experience]}>
                      <Award className="mr-1 size-3" />
                      {experienceLabels[driverProfile.experience]}
                    </Badge>
                    {driverProfile.racingType && (
                      <Badge variant="secondary">
                        {racingTypeLabels[driverProfile.racingType]}
                      </Badge>
                    )}
                  </div>
                  {driverProfile.location && (
                    <div className="mt-2 flex items-center gap-1 text-muted-foreground text-sm">
                      <MapPin className="size-4" />
                      <span>{driverProfile.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-lg">About</h3>
                <p className="text-muted-foreground leading-relaxed">{driverProfile.bio}</p>
              </div>

              {driverProfile.achievements && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">Achievements</h3>
                    <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                      {driverProfile.achievements}
                    </p>
                  </div>
                </>
              )}

              {(driverProfile.licenses.length > 0 ||
                driverProfile.preferredCategories.length > 0 ||
                driverProfile.availability.length > 0) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-4 font-semibold text-lg">Details</h3>
                    <div className="grid gap-6 sm:grid-cols-2">
                      {driverProfile.licenses.length > 0 && (
                        <div>
                          <p className="mb-2 font-medium text-muted-foreground text-sm">Licenses</p>
                          <div className="flex flex-wrap gap-2">
                            {driverProfile.licenses.map((license: string) => (
                              <Badge className="px-3 py-1 text-sm" key={license} variant="outline">
                                {license}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {driverProfile.preferredCategories.length > 0 && (
                        <div>
                          <p className="mb-2 font-medium text-muted-foreground text-sm">Preferred Categories</p>
                          <div className="flex flex-wrap gap-2">
                            {driverProfile.preferredCategories.map((category: string) => (
                              <Badge className="px-3 py-1 text-sm" key={category} variant="secondary">
                                <Star className="mr-1 size-3" />
                                {category}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {driverProfile.availability.length > 0 && (
                        <div>
                          <p className="mb-2 font-medium text-muted-foreground text-sm">Availability</p>
                          <div className="flex flex-wrap gap-2">
                            {driverProfile.availability.map((availability: string) => {
                              const availabilityLabels: Record<string, string> = {
                                "single-race": "Single Race",
                                "multi-race": "Multi-Race",
                                "season-commitment": "Season Commitment",
                                // Legacy support for old values
                                weekends: "Weekends",
                                weekdays: "Weekdays",
                                evenings: "Evenings",
                                flexible: "Flexible",
                              }
                              const label =
                                availabilityLabels[availability] ||
                                availability.charAt(0).toUpperCase() +
                                  availability.slice(1).replace(/-/g, " ")
                              return (
                                <Badge className="px-3 py-1 text-sm" key={availability} variant="outline">
                                  <Calendar className="mr-1 size-3" />
                                  {label}
                                </Badge>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {(driverProfile.racingType === "sim-racing" ||
                driverProfile.racingType === "both") && (
                <>
                  <Separator />
                  <div>
                    <h3 className="mb-3 font-semibold text-lg">Sim Racing</h3>
                    <div className="space-y-3">
                      {driverProfile.simRacingPlatforms &&
                        driverProfile.simRacingPlatforms.length > 0 && (
                          <div>
                            <p className="mb-2 font-medium text-muted-foreground text-sm">
                              Platforms
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {driverProfile.simRacingPlatforms.map((platform: string) => (
                                <Badge
                                  className="px-3 py-1 text-sm"
                                  key={platform}
                                  variant="secondary"
                                >
                                  🎮 {platform}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      {driverProfile.simRacingRating && (
                        <div>
                          <p className="mb-2 font-medium text-muted-foreground text-sm">Rating</p>
                          <p className="text-muted-foreground">{driverProfile.simRacingRating}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <DriverPortfolio driverProfileId={profileId} isOwner={isOwner} />

          <DriverEndorsements driverProfileId={profileId} isOwner={isOwner} />

          {similarDrivers && similarDrivers.length > 0 && (
            <div>
              <h2 className="mb-4 font-semibold text-xl">Similar Drivers</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {similarDrivers.map((driver: any) => (
                  <DriverCard
                    key={driver._id}
                    id={driver._id}
                    name={driver.user?.name || "Unknown"}
                    avatarUrl={driver.avatarUrl || driver.user?.avatarUrl}
                    location={driver.location}
                    experience={driver.experience}
                    racingType={driver.racingType}
                    licenses={driver.licenses}
                    preferredCategories={driver.preferredCategories}
                    headline={driver.headline}
                    bio={driver.bio}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {isOwner && (
            <ProfileAnalytics profileId={profileId} profileType="driver" />
          )}

          {!isOwner && (
            <>
              {hasAcceptedConnection && driverProfile && (
                <Card>
                  <CardContent className="p-6">
                    <Button
                      className="w-full"
                      onClick={async () => {
                        try {
                          const conversationId = await createConversation({
                            participantId: driverProfile.userId,
                            conversationType: "driver",
                            driverProfileId: profileId,
                          })
                          router.push(`/messages/${conversationId}`)
                        } catch {
                          toast.error("Failed to start conversation")
                        }
                      }}
                    >
                      <MessageSquare className="mr-2 size-4" />
                      Message Driver
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!hasAcceptedConnection && userTeams && userTeams.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <p className="mb-3 text-muted-foreground text-sm">
                      Connect with this driver to access their contact information
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (userTeams.length === 1) {
                          setSelectedTeamId(userTeams[0]!._id)
                        }
                        setShowConnectionDialog(true)
                      }}
                    >
                      <UserPlus className="mr-2 size-4" />
                      Request to Connect
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

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

                {(hasAcceptedConnection || isOwner) && (
                  <>
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
                      <Button asChild size="sm" type="button" variant="outline">
                        <a
                          href={getInstagramUrl(driverProfile.socialLinks.instagram)}
                          rel="noopener noreferrer"
                          target="_blank"
                          aria-label="Visit Instagram profile"
                        >
                          <Instagram className="mr-2 size-4" />
                          Instagram
                        </a>
                      </Button>
                    )}
                    {driverProfile.socialLinks.twitter && (
                      <Button asChild size="sm" type="button" variant="outline">
                        <a
                          href={getTwitterUrl(driverProfile.socialLinks.twitter)}
                          rel="noopener noreferrer"
                          target="_blank"
                          aria-label="Visit Twitter profile"
                        >
                          <Twitter className="mr-2 size-4" />
                          Twitter
                        </a>
                      </Button>
                    )}
                    {driverProfile.socialLinks.linkedin && (
                      <Button asChild size="sm" type="button" variant="outline">
                        <a
                          href={getLinkedInUrl(driverProfile.socialLinks.linkedin)}
                          rel="noopener noreferrer"
                          target="_blank"
                          aria-label="Visit LinkedIn profile"
                        >
                          <Linkedin className="mr-2 size-4" />
                          LinkedIn
                        </a>
                      </Button>
                    )}
                    {driverProfile.socialLinks.website && (
                      <Button asChild size="sm" type="button" variant="outline">
                        <a
                          href={getWebsiteUrl(driverProfile.socialLinks.website)}
                          rel="noopener noreferrer"
                          target="_blank"
                          aria-label="Visit website"
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

          {isOwner && (
            <Card>
              <CardHeader>
                <CardTitle>Manage Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  You own this driver profile. You can edit it, hide it from public view, or delete
                  it permanently.
                </p>
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/motorsports/profile/driver?edit=${profileId}`}>
                      <Edit className="mr-2 size-4" />
                      Edit Profile
                    </Link>
                  </Button>
                  <Button disabled={isToggling} onClick={handleToggleVisibility} variant="outline">
                    {(() => {
                      if (isToggling) {
                        return <Loader2 className="mr-2 size-4 animate-spin" />
                      }
                      return driverProfile.isActive ? (
                        <EyeOff className="mr-2 size-4" />
                      ) : (
                        <Eye className="mr-2 size-4" />
                      )
                    })()}
                    {driverProfile.isActive ? "Hide Profile" : "Show Profile"}
                  </Button>
                  <Button disabled={isDeleting} onClick={() => setShowDeleteDialog(true)} variant="destructive">
                    <Trash2 className="mr-2 size-4" />
                    Delete Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile sticky CTA */}
      {!isOwner && (
        <div className="fixed right-0 bottom-0 left-0 border-t bg-background p-4 lg:hidden">
          {hasAcceptedConnection ? (
            <Button className="w-full" onClick={async () => {
              try {
                const conversationId = await createConversation({
                  participantId: driverProfile.userId,
                  conversationType: "driver",
                  driverProfileId: profileId,
                })
                router.push(`/messages/${conversationId}`)
              } catch {
                toast.error("Failed to start conversation")
              }
            }}>
              <MessageSquare className="mr-2 size-4" />
              Message Driver
            </Button>
          ) : userTeams && userTeams.length > 0 ? (
            <Button className="w-full" onClick={() => { if (userTeams.length === 1) setSelectedTeamId(userTeams[0]!._id); setShowConnectionDialog(true) }}>
              <UserPlus className="mr-2 size-4" />
              Request to Connect
            </Button>
          ) : null}
        </div>
      )}

      <Dialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Driver Profile</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this driver profile? This action cannot be undone.
              Your profile will be permanently removed from the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={isDeleting}
              onClick={() => setShowDeleteDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isDeleting} onClick={handleDelete} variant="destructive">
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 size-4" />
                  Delete Profile
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setShowConnectionDialog} open={showConnectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Connect</DialogTitle>
            <DialogDescription>
              Send a connection request to this driver. Once accepted, you'll be able to see their
              contact information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {userTeams && userTeams.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="team-select">Select Team</Label>
                <Select
                  onValueChange={(value) => setSelectedTeamId(value as Id<"teams">)}
                  value={selectedTeamId || ""}
                >
                  <SelectTrigger id="team-select">
                    <SelectValue placeholder="Select a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userTeams.map((team: { _id: string; name: string }) => (
                      <SelectItem key={team._id} value={team._id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="connection-message">Message (Optional)</Label>
              <Textarea
                id="connection-message"
                onChange={(e) => setConnectionMessage(e.target.value)}
                placeholder="Introduce your team and why you're interested in connecting..."
                rows={4}
                value={connectionMessage}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={isRequestingConnection}
              onClick={() => {
                setShowConnectionDialog(false)
                setConnectionMessage("")
                setSelectedTeamId(null)
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                isRequestingConnection ||
                (userTeams && userTeams.length > 1 && !selectedTeamId) ||
                (userTeams && userTeams.length === 0)
              }
              onClick={async () => {
                if (!userTeams || userTeams.length === 0) {
                  toast.error("You need to create a team profile first")
                  return
                }

                const teamId = selectedTeamId || userTeams[0]!._id
                setIsRequestingConnection(true)

                try {
                  await requestConnection({
                    driverProfileId: profileId,
                    teamId,
                    message: connectionMessage || undefined,
                  })
                  toast.success("Connection request sent!")
                  setShowConnectionDialog(false)
                  setConnectionMessage("")
                  setSelectedTeamId(null)
                } catch (error) {
                  handleErrorWithContext(error, {
                    action: "send connection request",
                    customMessages: {
                      generic: "Failed to send connection request. Please try again.",
                    },
                  })
                } finally {
                  setIsRequestingConnection(false)
                }
              }}
            >
              {isRequestingConnection ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 size-4" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
