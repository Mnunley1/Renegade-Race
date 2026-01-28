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
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { Calendar, Camera, Heart, Loader2, Pencil, Shield, Star } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { imagePresets } from "@/lib/imagekit"
import { handleErrorWithContext } from "@/lib/error-handler"

const DEFAULT_MEMBER_YEAR = 2024
const MAX_IMAGE_SIZE_MB = 5
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

export default function ProfilePage() {
  const { user } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [experience, setExperience] = useState("")
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
    const favoritesCount = favorites?.length || 0

    return {
      tripsCount,
      averageRating,
      favoritesCount,
    }
  }, [reservations, reviewStats, favorites])

  // Initialize form data from user profile
  useEffect(() => {
    if (convexUser) {
      setBio(convexUser.bio || "")
      setLocation(convexUser.location || "")
      setExperience(convexUser.experience || "Advanced")
    }
  }, [convexUser])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      // Update user profile (name, email, phone, bio, location, experience)
      await updateProfile({
        name: user?.fullName || "",
        email: user?.emailAddresses?.[0]?.emailAddress || undefined,
        bio: bio || undefined,
        location: location || undefined,
        experience: experience || undefined,
      })
      setIsEditing(false)
    } catch (error) {
      // Error updating profile - user will see the error state
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Reset form to original values
    if (convexUser) {
      setBio(convexUser.bio || "")
      setLocation(convexUser.location || "")
      setExperience(convexUser.experience || "Advanced")
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

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(`Image size must be less than ${MAX_IMAGE_SIZE_MB}MB`)
      return
    }

    setIsUploadingImage(true)
    try {
      // Generate upload URL and key
      const result = await generateProfileImageUploadUrl({})
      if (!result || typeof result !== "object" || !result.url || !result.key) {
        throw new Error(`Failed to generate upload URL: ${JSON.stringify(result)}`)
      }

      const { url: uploadUrl, key } = result

      // Upload to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`)
      }

      // Update profile image in Convex
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Compute profile image URL with ImageKit sizing
  const profileImageUrl = useMemo(() => {
    if (convexUser?.profileImageR2Key) {
      // Use R2 key with ImageKit avatar preset for optimal sizing
      return imagePresets.avatar(convexUser.profileImageR2Key)
    }
    if (convexUser?.profileImage) {
      // Fallback to stored ImageKit URL (already optimized)
      return convexUser.profileImage
    }
    // Fallback to Clerk's image URL
    return user?.imageUrl
  }, [convexUser?.profileImageR2Key, convexUser?.profileImage, user?.imageUrl])

  const userInitials = user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U"
  const memberSince = user?.createdAt ? new Date(user.createdAt).getFullYear() : DEFAULT_MEMBER_YEAR

  // Show loading state
  if (
    convexUser === undefined ||
    reviewStats === undefined ||
    reservations === undefined ||
    favorites === undefined
  ) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-6">
        {/* Hero Section */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <div className="flex flex-col items-center gap-3">
                <Avatar className="size-28 shadow-lg ring-4 ring-background">
                  <AvatarImage alt={user?.fullName || "User"} src={profileImageUrl} />
                  <AvatarFallback className="text-2xl">{userInitials.toUpperCase()}</AvatarFallback>
                </Avatar>
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
                        Edit Profile Picture
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
                    <h1 className="font-bold text-3xl">{user?.fullName || "Guest User"}</h1>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-4" />
                      Member since {memberSince}
                    </p>
                  </div>
                  <Badge className="gap-1.5" variant="secondary">
                    <Shield className="size-3.5" />
                    Verified
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="gap-1.5" variant="outline">
                    <Star className="size-3.5 fill-yellow-500 text-yellow-500" />
                    Super Host
                  </Badge>
                  <Badge className="gap-1.5" variant="outline">
                    <Calendar className="size-3.5" />
                    {stats.tripsCount} Trips Completed
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">Trips</CardTitle>
              <Calendar className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stats.tripsCount}</div>
              <p className="text-muted-foreground text-xs">Total completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">Rating</CardTitle>
              <Star className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "N/A"}
              </div>
              <p className="text-muted-foreground text-xs">Average from reviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">Favorites</CardTitle>
              <Heart className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stats.favoritesCount}</div>
              <p className="text-muted-foreground text-xs">Saved vehicles</p>
            </CardContent>
          </Card>
        </div>

        {/* About Me Section */}
        <Card>
          <CardHeader>
            <CardTitle>About Me</CardTitle>
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
                    placeholder="Tell us about yourself..."
                    value={bio}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm" htmlFor="location">
                      Location
                    </Label>
                    <Input
                      id="location"
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City, State or Country"
                      value={location}
                    />
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
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Bio</Label>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-muted-foreground leading-relaxed">
                      {bio || "No bio added yet. Click Edit Profile to add one!"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Location</Label>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-muted-foreground">{location || "No location set"}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Experience Level</Label>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="font-semibold">{experience}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {isEditing ? (
          <div className="flex gap-3">
            <Button onClick={handleSave} size="lg">
              Save Profile
            </Button>
            <Button onClick={handleCancel} size="lg" variant="outline">
              Cancel
            </Button>
          </div>
        ) : (
          <div>
            <Button onClick={handleEdit} size="lg" variant="default">
              <Pencil className="mr-2 size-4" />
              Edit Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
