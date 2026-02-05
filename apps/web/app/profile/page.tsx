"use client"

import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
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
  Calendar,
  Camera,
  Car,
  CheckCircle2,
  Heart,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trophy,
  User,
  X,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { imagePresets } from "@/lib/imagekit"

const DEFAULT_MEMBER_YEAR = 2024
const MAX_IMAGE_SIZE_MB = 5
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

// --- Helper Components ---

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - (star - 1)))
        return (
          <div className="relative" key={star} style={{ width: size, height: size }}>
            <Star className="absolute text-muted-foreground/25" size={size} />
            <div className="absolute overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-yellow-500 text-yellow-500" size={size} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryBar({ label, value }: { label: string; value: number }) {
  const percentage = (value / 5) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value > 0 ? value.toFixed(1) : "--"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: value > 0 ? `${percentage}%` : "0%" }}
        />
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-6">
        {/* Hero skeleton */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <Skeleton className="size-28 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </CardContent>
        </Card>

        {/* Completion skeleton */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats skeleton */}
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-16" />
                <Skeleton className="mb-1 h-8 w-12" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* About skeleton */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-20 w-full" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --- Main Component ---

export default function ProfilePage() {
  const { user } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [experience, setExperience] = useState("")
  const [interests, setInterests] = useState<string[]>([])
  const [interestInput, setInterestInput] = useState("")
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch user data, review stats, reservations, and favorites from Convex
  const convexUser = useQuery(api.users.current, {})
  const reviewStats = useQuery(api.reviews.getUserStats, user?.id ? { userId: user.id } : "skip")
  const reservations = useQuery(
    api.reservations.getByUser,
    user?.id ? { userId: user.id, role: "renter" as const } : "skip"
  )
  const favorites = useQuery(api.favorites.getUserFavorites, user?.id ? {} : "skip")

  // Mutations
  const updateProfile = useMutation(api.users.updateProfile)
  const updateProfileImage = useMutation(api.users.updateProfileImage)
  const generateProfileImageUploadUrl = useMutation(api.r2.generateProfileImageUploadUrl)

  // Calculate stats
  const stats = useMemo(() => {
    const tripsCount = reservations?.filter((res: any) => res.status === "completed").length || 0
    const averageRating = reviewStats?.averageRating || 0
    const totalReviews = reviewStats?.totalReviews || 0
    const favoritesCount = favorites?.length || 0

    return { tripsCount, averageRating, totalReviews, favoritesCount }
  }, [reservations, reviewStats, favorites])

  // Profile completion
  const profileCompletion = useMemo(() => {
    if (!(convexUser || user)) {
      return { percentage: 0, missing: [] }
    }
    const checks = [
      {
        key: "avatar",
        label: "Profile photo",
        done: !!(convexUser?.profileImageR2Key || convexUser?.profileImage),
      },
      { key: "bio", label: "Bio", done: !!convexUser?.bio },
      { key: "location", label: "Location", done: !!convexUser?.location },
      {
        key: "experience",
        label: "Experience level",
        done: !!convexUser?.experience,
      },
      {
        key: "interests",
        label: "Interests",
        done: !!(convexUser?.interests && convexUser.interests.length > 0),
      },
    ]
    const done = checks.filter((c) => c.done).length
    const missing = checks.filter((c) => !c.done).map((c) => c.label)
    return { percentage: Math.round((done / checks.length) * 100), missing }
  }, [convexUser, user])

  // Initialize form data from user profile
  useEffect(() => {
    if (convexUser) {
      setBio(convexUser.bio || "")
      setLocation(convexUser.location || "")
      setExperience(convexUser.experience || "Advanced")
      setInterests(convexUser.interests || [])
    }
  }, [convexUser])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      await updateProfile({
        name: user?.fullName || "",
        email: user?.emailAddresses?.[0]?.emailAddress || undefined,
        bio: bio || undefined,
        location: location || undefined,
        experience: experience || undefined,
        interests: interests.length > 0 ? interests : undefined,
      })
      setIsEditing(false)
      toast.success("Profile updated successfully")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "update profile",
        customMessages: {
          generic: "Failed to update profile. Please try again.",
        },
      })
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    if (convexUser) {
      setBio(convexUser.bio || "")
      setLocation(convexUser.location || "")
      setExperience(convexUser.experience || "Advanced")
      setInterests(convexUser.interests || [])
    }
  }

  const handleEditProfilePicture = () => {
    fileInputRef.current?.click()
  }

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(`Image size must be less than ${MAX_IMAGE_SIZE_MB}MB`)
      return
    }

    setIsUploadingImage(true)
    try {
      const result = await generateProfileImageUploadUrl({})
      if (!result || typeof result !== "object" || !result.url || !result.key) {
        throw new Error(`Failed to generate upload URL: ${JSON.stringify(result)}`)
      }

      const { url: uploadUrl, key } = result

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`)
      }

      await updateProfileImage({ r2Key: key })
      toast.success("Profile picture updated successfully")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "upload profile picture",
        customMessages: {
          file_upload: "Image is too large. Please use an image smaller than 10MB.",
          generic: "Failed to upload profile picture. Please try again.",
        },
      })
    } finally {
      setIsUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const addInterest = useCallback(() => {
    const trimmed = interestInput.trim()
    if (trimmed && !interests.includes(trimmed)) {
      setInterests((prev) => [...prev, trimmed])
    }
    setInterestInput("")
  }, [interestInput, interests])

  const removeInterest = (interest: string) => {
    setInterests((prev) => prev.filter((i) => i !== interest))
  }

  const handleInterestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addInterest()
    }
  }

  // Compute profile image URL with ImageKit sizing
  const profileImageUrl = useMemo(() => {
    if (convexUser?.profileImageR2Key) {
      return imagePresets.avatar(convexUser.profileImageR2Key)
    }
    if (convexUser?.profileImage) {
      return convexUser.profileImage
    }
    return user?.imageUrl
  }, [convexUser?.profileImageR2Key, convexUser?.profileImage, user?.imageUrl])

  const userInitials = user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U"
  const memberSince = user?.createdAt ? new Date(user.createdAt).getFullYear() : DEFAULT_MEMBER_YEAR

  const isEmailVerified = convexUser
    ? !!convexUser.email
    : !!user?.emailAddresses?.[0]?.emailAddress
  const isPhoneVerified = convexUser ? !!convexUser.phone : false

  // Loading state with skeleton
  if (
    convexUser === undefined ||
    reviewStats === undefined ||
    reservations === undefined ||
    favorites === undefined
  ) {
    return <ProfileSkeleton />
  }

  const hasReviewCategories =
    reviewStats && reviewStats.totalReviews > 0 && reviewStats.categoryAverages

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-6">
        {/* Hero Section */}
        <Card className="relative overflow-hidden border-0 shadow-lg">
          {/* Background pattern + gradient */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="absolute -top-24 -right-24 size-64 rounded-full bg-primary/5 blur-3xl" />

          <CardContent className="relative p-8">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="size-28 shadow-xl ring-4 ring-background">
                    <AvatarImage alt={user?.fullName || "User"} src={profileImageUrl} />
                    <AvatarFallback className="bg-primary/10 font-semibold text-2xl text-primary">
                      {userInitials.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isEditing && (
                    <button
                      aria-label="Edit profile picture"
                      className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
                      onClick={handleEditProfilePicture}
                      type="button"
                    >
                      <Camera className="size-4" />
                    </button>
                  )}
                </div>
                {isEditing && (
                  <Button
                    disabled={isUploadingImage}
                    onClick={handleEditProfilePicture}
                    size="sm"
                    variant="default"
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 size-4" />
                        Change Photo
                      </>
                    )}
                  </Button>
                )}
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePictureChange}
                  ref={fileInputRef}
                  type="file"
                />
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-bold text-3xl tracking-tight">
                      {user?.fullName || "Guest User"}
                    </h1>
                    <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-4" />
                      Member since {memberSince}
                    </p>
                  </div>
                  {isEditing ? (
                    <div className="flex shrink-0 gap-2">
                      <Button onClick={handleSave} size="sm">
                        Save
                      </Button>
                      <Button onClick={handleCancel} size="sm" variant="ghost">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button className="shrink-0" onClick={handleEdit} size="sm" variant="outline">
                      <Pencil className="mr-2 size-3.5" />
                      Edit Profile
                    </Button>
                  )}
                </div>

                {/* Verification badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge className="gap-1.5" variant={isEmailVerified ? "default" : "outline"}>
                    <Mail className="size-3.5" />
                    {isEmailVerified ? "Email Verified" : "Email Unverified"}
                  </Badge>
                  <Badge className="gap-1.5" variant={isPhoneVerified ? "default" : "outline"}>
                    <Phone className="size-3.5" />
                    {isPhoneVerified ? "Phone Verified" : "Phone Unverified"}
                  </Badge>
                  {stats.tripsCount >= 10 && (
                    <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-600" variant="outline">
                      <Trophy className="size-3.5" />
                      Experienced Driver
                    </Badge>
                  )}
                  {stats.averageRating >= 4.5 && stats.totalReviews >= 3 && (
                    <Badge className="gap-1.5 bg-amber-500/10 text-amber-600" variant="outline">
                      <Star className="size-3.5 fill-amber-500" />
                      Top Rated
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Completion */}
        {profileCompletion.percentage < 100 && (
          <Card className="border-dashed">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="size-6 text-primary" />
                  <svg
                    aria-hidden="true"
                    className="absolute inset-0 -rotate-90"
                    viewBox="0 0 56 56"
                  >
                    <title>Profile completion</title>
                    <circle
                      className="text-muted"
                      cx="28"
                      cy="28"
                      fill="none"
                      r="24"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <circle
                      className="text-primary transition-all duration-700"
                      cx="28"
                      cy="28"
                      fill="none"
                      r="24"
                      stroke="currentColor"
                      strokeDasharray={`${(profileCompletion.percentage / 100) * 150.8} 150.8`}
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="font-semibold">Complete your profile</p>
                    <span className="font-medium text-muted-foreground text-sm">
                      {profileCompletion.percentage}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground text-sm">
                    Add your {profileCompletion.missing.slice(0, 3).join(", ")}
                    {profileCompletion.missing.length > 3
                      ? ` and ${profileCompletion.missing.length - 3} more`
                      : ""}{" "}
                    to stand out to vehicle owners.
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${profileCompletion.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="group transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10">
                  <Calendar className="size-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-2xl tabular-nums">{stats.tripsCount}</p>
                  <p className="text-muted-foreground text-sm">Trips completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-yellow-500/10">
                  <Star className="size-6 text-yellow-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-2xl tabular-nums">
                      {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "--"}
                    </p>
                    {stats.averageRating > 0 && (
                      <StarRating rating={stats.averageRating} size={14} />
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {stats.totalReviews > 0
                      ? `${stats.totalReviews} review${stats.totalReviews !== 1 ? "s" : ""}`
                      : "No reviews yet"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-rose-500/10">
                  <Heart className="size-6 text-rose-600" />
                </div>
                <div>
                  <p className="font-bold text-2xl tabular-nums">{stats.favoritesCount}</p>
                  <p className="text-muted-foreground text-sm">Saved vehicles</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Review Category Breakdown */}
        {hasReviewCategories && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="size-5" />
                Review Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <CategoryBar
                  label="Communication"
                  value={reviewStats.categoryAverages.communication}
                />
                <CategoryBar
                  label="Vehicle Condition"
                  value={reviewStats.categoryAverages.vehicleCondition}
                />
                <CategoryBar
                  label="Professionalism"
                  value={reviewStats.categoryAverages.professionalism}
                />
                <CategoryBar
                  label="Overall Experience"
                  value={reviewStats.categoryAverages.overallExperience}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* About Me Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="size-5" />
              About Me
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm" htmlFor="bio">
                    Bio
                  </Label>
                  <Textarea
                    className="min-h-24 resize-none"
                    id="bio"
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself and your track day experience..."
                    value={bio}
                  />
                  <p className="text-muted-foreground text-xs">{bio.length}/500 characters</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm" htmlFor="location">
                      Location
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        id="location"
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City, State or Country"
                        value={location}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm" htmlFor="experience">
                      Experience Level
                    </Label>
                    <Select onValueChange={setExperience} value={experience}>
                      <SelectTrigger id="experience">
                        <SelectValue placeholder="Select experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner</SelectItem>
                        <SelectItem value="Intermediate">Intermediate</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                        <SelectItem value="Professional">Professional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Interests editor */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Interests</Label>
                  <div className="flex gap-2">
                    <Input
                      onChange={(e) => setInterestInput(e.target.value)}
                      onKeyDown={handleInterestKeyDown}
                      placeholder="e.g. GT3 cars, drifting, time attack..."
                      value={interestInput}
                    />
                    <Button
                      disabled={!interestInput.trim()}
                      onClick={addInterest}
                      size="default"
                      type="button"
                      variant="outline"
                    >
                      Add
                    </Button>
                  </div>
                  {interests.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {interests.map((interest) => (
                        <Badge className="gap-1 pr-1" key={interest} variant="secondary">
                          {interest}
                          <button
                            aria-label={`Remove ${interest}`}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                            onClick={() => removeInterest(interest)}
                            type="button"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Bio display */}
                <div>
                  {bio ? (
                    <p className="text-foreground/80 leading-relaxed">{bio}</p>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No bio added yet. Click Edit Profile to tell others about yourself.
                    </p>
                  )}
                </div>

                <Separator />

                {/* Info grid */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <MapPin className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Location</p>
                      <p className="font-medium text-sm">{location || "Not set"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Shield className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Experience</p>
                      <p className="font-medium text-sm">{experience || "Not set"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <CheckCircle2 className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Verified</p>
                      <p className="font-medium text-sm">
                        {[isEmailVerified && "Email", isPhoneVerified && "Phone"]
                          .filter(Boolean)
                          .join(", ") || "None"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interests display */}
                {interests.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                        Interests
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {interests.map((interest) => (
                          <Badge key={interest} variant="secondary">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Link href="/settings">
            <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Settings className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Settings</p>
                  <p className="text-muted-foreground text-xs">Account preferences</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/vehicles">
            <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Car className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">My Vehicles</p>
                  <p className="text-muted-foreground text-xs">Manage listings</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/trips">
            <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Trips</p>
                  <p className="text-muted-foreground text-xs">Booking history</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/favorites">
            <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Heart className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Favorites</p>
                  <p className="text-muted-foreground text-xs">Saved vehicles</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
