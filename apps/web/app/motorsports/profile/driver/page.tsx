"use client"

import { useUser } from "@clerk/nextjs"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, Check, Loader2, Upload, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { imagePresets } from "@/lib/imagekit"

// Force dynamic rendering - this page requires authentication
export const dynamic = "force-dynamic"

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
]

const COMMON_LICENSES = ["FIA", "NASA", "SCCA", "IMSA", "HPDE", "Other"]

const REAL_WORLD_CATEGORIES = [
  "GT3",
  "GT4",
  "Formula",
  "Open Wheel",
  "Endurance",
  "Time Attack",
  "Drifting",
  "Club Racing",
  "Vintage Racing",
  "Track Days",
]

const SIM_RACING_CATEGORIES = [
  "iRacing",
  "Assetto Corsa Competizione",
  "Gran Turismo",
  "F1 Esports",
  "Sim Racing - GT",
  "Sim Racing - Formula",
  "Sim Racing - Endurance",
  "Sim Racing - Oval",
]

const SIM_RACING_PLATFORMS = [
  "iRacing",
  "Assetto Corsa Competizione",
  "Gran Turismo 7",
  "F1 24",
  "rFactor 2",
  "RaceRoom",
  "Automobilista 2",
  "Other",
]

const RACING_TYPES = [
  { value: "real-world", label: "Real-World Racing" },
  { value: "sim-racing", label: "Sim Racing" },
  { value: "both", label: "Both" },
]

const AVAILABILITY_OPTIONS = [
  { value: "single-race", label: "Single Race" },
  { value: "multi-race", label: "Multi-Race" },
  { value: "season-commitment", label: "Season Commitment" },
]

export default function CreateDriverProfilePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isSignedIn, isLoaded: userLoaded } = useUser()
  const editProfileId = searchParams.get("edit") as Id<"driverProfiles"> | null
  const [formData, setFormData] = useState({
    headline: "",
    bio: "",
    achievements: "",
    experience: "",
    racingType: "",
    simRacingPlatforms: [] as string[],
    simRacingRating: "",
    location: "",
    licenses: [] as string[],
    preferredCategories: [] as string[],
    availability: [] as string[],
    contactInfo: {
      phone: "",
      email: "",
    },
    socialLinks: {
      instagram: "",
      twitter: "",
      linkedin: "",
      website: "",
    },
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customLicense, setCustomLicense] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createDriverProfile = useMutation(api.driverProfiles.create)
  const updateDriverProfile = useMutation(api.driverProfiles.update)
  const generateDriverImageUploadUrl = useMutation(api.r2.generateDriverProfileImageUploadUrl)
  const existingProfile = useQuery(api.driverProfiles.getByUser, isSignedIn ? {} : "skip")
  const profileToEdit = useQuery(
    api.driverProfiles.getById,
    editProfileId && isSignedIn ? { profileId: editProfileId } : "skip"
  )

  const MAX_IMAGE_SIZE_MB = 5
  const BYTES_PER_KB = 1024
  const KB_PER_MB = 1024
  const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * KB_PER_MB * BYTES_PER_KB

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (userLoaded && !isSignedIn) {
      router.push(
        `/sign-in?redirect_url=${encodeURIComponent(pathname || "/motorsports/profile/driver")}`
      )
    }
  }, [isSignedIn, userLoaded, router, pathname])

  // Redirect to existing profile if user already has one (unless editing)
  useEffect(() => {
    if (existingProfile && existingProfile.length > 0 && !editProfileId) {
      router.push(`/motorsports/drivers/${existingProfile[0]._id}`)
    }
  }, [existingProfile, router, editProfileId])

  // Load existing profile data when editing
  useEffect(() => {
    if (profileToEdit?.isOwner) {
      setFormData({
        headline: profileToEdit.headline || "",
        bio: profileToEdit.bio,
        achievements: profileToEdit.achievements || "",
        experience:
          profileToEdit.experience.charAt(0).toUpperCase() + profileToEdit.experience.slice(1),
        racingType: profileToEdit.racingType || "",
        simRacingPlatforms: profileToEdit.simRacingPlatforms || [],
        simRacingRating: profileToEdit.simRacingRating || "",
        location: profileToEdit.location,
        licenses: profileToEdit.licenses,
        preferredCategories: profileToEdit.preferredCategories,
        availability: profileToEdit.availability,
        contactInfo: {
          phone: profileToEdit.contactInfo?.phone || "",
          email: profileToEdit.contactInfo?.email || "",
        },
        socialLinks: {
          instagram: profileToEdit.socialLinks?.instagram || "",
          twitter: profileToEdit.socialLinks?.twitter || "",
          linkedin: profileToEdit.socialLinks?.linkedin || "",
          website: profileToEdit.socialLinks?.website || "",
        },
      })
      if (profileToEdit.avatarUrl) {
        setAvatarUrl(profileToEdit.avatarUrl)
      }
    }
  }, [profileToEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Map experience to match Convex schema
      const experienceMap: Record<
        string,
        "beginner" | "intermediate" | "advanced" | "professional"
      > = {
        Beginner: "beginner",
        Intermediate: "intermediate",
        Advanced: "advanced",
        Professional: "professional",
      }

      if (editProfileId && profileToEdit?.isOwner) {
        // Update existing profile
        await updateDriverProfile({
          profileId: editProfileId,
          avatarUrl: avatarUrl || undefined,
          headline: formData.headline || undefined,
          bio: formData.bio,
          experience: experienceMap[formData.experience] || undefined,
          racingType: formData.racingType
            ? (formData.racingType as "real-world" | "sim-racing" | "both")
            : undefined,
          simRacingPlatforms:
            formData.simRacingPlatforms.length > 0 ? formData.simRacingPlatforms : undefined,
          simRacingRating: formData.simRacingRating || undefined,
          licenses: formData.licenses,
          preferredCategories: formData.preferredCategories,
          availability: formData.availability,
          location: formData.location,
          contactInfo: {
            phone: formData.contactInfo.phone || undefined,
            email: formData.contactInfo.email || undefined,
          },
          socialLinks: {
            instagram: formData.socialLinks.instagram || undefined,
            twitter: formData.socialLinks.twitter || undefined,
            linkedin: formData.socialLinks.linkedin || undefined,
            website: formData.socialLinks.website || undefined,
          },
        })
        toast.success("Profile updated successfully!")
        router.push(`/motorsports/drivers/${editProfileId}`)
      } else {
        // Create new profile
        await createDriverProfile({
          avatarUrl: avatarUrl || undefined,
          headline: formData.headline || undefined,
          bio: formData.bio,
          experience: experienceMap[formData.experience] || "beginner",
          racingType: formData.racingType
            ? (formData.racingType as "real-world" | "sim-racing" | "both")
            : undefined,
          simRacingPlatforms:
            formData.simRacingPlatforms.length > 0 ? formData.simRacingPlatforms : undefined,
          simRacingRating: formData.simRacingRating || undefined,
          licenses: formData.licenses,
          preferredCategories: formData.preferredCategories,
          availability: formData.availability,
          location: formData.location,
          contactInfo: {
            phone: formData.contactInfo.phone || undefined,
            email: formData.contactInfo.email || undefined,
          },
        })
        toast.success("Profile created successfully!")
        router.push("/motorsports/drivers")
      }
    } catch (error) {
      console.error("Failed to create driver profile:", error)
      toast.error("An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name.startsWith("contactInfo.")) {
      const field = name.split(".")[1] as keyof typeof formData.contactInfo
      setFormData({
        ...formData,
        contactInfo: { ...formData.contactInfo, [field]: value },
      })
    } else if (name.startsWith("socialLinks.")) {
      const field = name.split(".")[1] as keyof typeof formData.socialLinks
      setFormData({
        ...formData,
        socialLinks: { ...formData.socialLinks, [field]: value },
      })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const toggleArrayValue = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter((item) => item !== value)
    }
    return [...array, value]
  }

  const handleLicenseToggle = (license: string) => {
    setFormData({
      ...formData,
      licenses: toggleArrayValue(formData.licenses, license),
    })
  }

  const handleCategoryToggle = (category: string) => {
    setFormData({
      ...formData,
      preferredCategories: toggleArrayValue(formData.preferredCategories, category),
    })
  }

  const handleAvailabilityToggle = (availability: string) => {
    setFormData({
      ...formData,
      availability: toggleArrayValue(formData.availability, availability),
    })
  }

  const handleSimPlatformToggle = (platform: string) => {
    setFormData({
      ...formData,
      simRacingPlatforms: toggleArrayValue(formData.simRacingPlatforms, platform),
    })
  }

  const addCustomLicense = () => {
    if (customLicense.trim() && !formData.licenses.includes(customLicense.trim())) {
      setFormData({
        ...formData,
        licenses: [...formData.licenses, customLicense.trim()],
      })
      setCustomLicense("")
    }
  }

  const validateImageFile = (file: File): boolean => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return false
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(`Image size must be less than ${MAX_IMAGE_SIZE_MB}MB`)
      return false
    }
    return true
  }

  const uploadImageToR2 = async (file: File, uploadUrl: string): Promise<void> => {
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
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    if (!validateImageFile(file)) {
      return
    }

    setIsUploadingAvatar(true)
    try {
      const result = await generateDriverImageUploadUrl({})
      if (!result || typeof result !== "object" || !result.url || !result.key) {
        throw new Error(`Failed to generate upload URL: ${JSON.stringify(result)}`)
      }

      const { url: uploadUrl, key } = result
      await uploadImageToR2(file, uploadUrl)

      const imageKitUrl = imagePresets.avatar(key)
      setAvatarUrl(imageKitUrl)
      toast.success("Driver image uploaded successfully")
    } catch (error) {
      console.error("Failed to upload driver image:", error)
      toast.error("An error occurred")
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl("")
  }

  // Show loading state while checking authentication and existing profile
  if (!userLoaded || (isSignedIn && existingProfile === undefined)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Don't render form if not authenticated (will redirect)
  if (!isSignedIn) {
    return null
  }

  // Don't render form if user already has a profile (will redirect) - unless editing
  if (existingProfile && existingProfile.length > 0 && !editProfileId) {
    return null
  }

  // Show loading state when fetching profile to edit
  if (editProfileId && profileToEdit === undefined) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if trying to edit a profile that doesn't exist or user doesn't own
  if (editProfileId && profileToEdit && !profileToEdit.isOwner) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="mb-2 font-semibold text-lg">Not Authorized</p>
            <p className="mb-6 text-muted-foreground text-sm">
              You don't have permission to edit this profile.
            </p>
            <Button asChild>
              <Link href="/motorsports/drivers">Back to Drivers</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link href={editProfileId ? `/motorsports/drivers/${editProfileId}` : "/motorsports/drivers"}>
        <Button className="mb-6" variant="outline">
          <ArrowLeft className="mr-2 size-4" />
          Back to Drivers
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">
          {editProfileId ? "Edit Driver Profile" : "Create Driver Profile"}
        </h1>
        <p className="text-muted-foreground">
          {editProfileId
            ? "Update your driver profile information"
            : "Create your driver profile to connect with racing teams"}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Tell teams about yourself and your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Driver Image */}
              <div className="space-y-2">
                <Label>Driver Image (Optional)</Label>
                {avatarUrl ? (
                  <div className="relative inline-block">
                    <div className="relative size-32 overflow-hidden rounded-full border-2 border-primary/20">
                      <Image alt="Driver avatar" className="object-cover" fill src={avatarUrl} />
                    </div>
                    <Button
                      className="-right-2 -top-2 absolute size-8 rounded-full p-0"
                      onClick={handleRemoveAvatar}
                      type="button"
                      variant="destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="relative flex size-32 items-center justify-center overflow-hidden rounded-full border-2 border-muted-foreground/25 border-dashed bg-muted">
                      {isUploadingAvatar ? (
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="size-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <Label className="cursor-pointer" htmlFor="avatar-upload">
                        <Button
                          disabled={isUploadingAvatar}
                          onClick={() => fileInputRef.current?.click()}
                          type="button"
                          variant="outline"
                        >
                          {isUploadingAvatar ? "Uploading..." : "Upload Image"}
                        </Button>
                      </Label>
                      <input
                        accept="image/*"
                        className="hidden"
                        id="avatar-upload"
                        onChange={handleAvatarChange}
                        ref={fileInputRef}
                        type="file"
                      />
                      <p className="mt-2 text-muted-foreground text-xs">
                        JPG, PNG or GIF. Max size: {MAX_IMAGE_SIZE_MB}MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />
              <div className="space-y-2">
                <Label htmlFor="headline">Headline (Optional)</Label>
                <Input
                  id="headline"
                  name="headline"
                  onChange={handleChange}
                  placeholder="e.g., Professional GT3 Driver | 5+ Years Experience"
                  value={formData.headline}
                />
                <p className="text-muted-foreground text-xs">
                  A short, attention-grabbing headline that summarizes your racing profile
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio *</Label>
                <Textarea
                  className="min-h-32 resize-none"
                  id="bio"
                  name="bio"
                  onChange={handleChange}
                  placeholder="Tell teams about your racing background, achievements, and what you're looking for..."
                  required
                  value={formData.bio}
                />
                <p className="text-muted-foreground text-xs">
                  Describe your racing experience, achievements, and goals
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="achievements">Achievements (Optional)</Label>
                <Textarea
                  className="min-h-24 resize-none"
                  id="achievements"
                  name="achievements"
                  onChange={handleChange}
                  placeholder="List your racing achievements, championships, podium finishes..."
                  value={formData.achievements}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="experience">Experience Level *</Label>
                  <Select
                    onValueChange={(value) => setFormData({ ...formData, experience: value })}
                    required
                    value={formData.experience}
                  >
                    <SelectTrigger id="experience">
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    name="location"
                    onChange={handleChange}
                    placeholder="City, State or Country"
                    required
                    value={formData.location}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Racing Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Racing Type</CardTitle>
              <CardDescription>
                Select whether you participate in real-world racing, sim racing, or both
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="racingType">Racing Type *</Label>
                <Select
                  onValueChange={(value) => setFormData({ ...formData, racingType: value })}
                  required
                  value={formData.racingType}
                >
                  <SelectTrigger id="racingType">
                    <SelectValue placeholder="Select racing type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RACING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Real-World Racing Card */}
          {(formData.racingType === "real-world" || formData.racingType === "both") && (
            <Card>
              <CardHeader>
                <CardTitle>Real-World Racing</CardTitle>
                <CardDescription>
                  Specify your licenses, preferred categories, and availability for real-world
                  racing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Licenses *</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_LICENSES.map((license) => (
                      <button
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                        key={license}
                        onClick={(e) => {
                          e.preventDefault()
                          handleLicenseToggle(license)
                        }}
                        type="button"
                      >
                        {formData.licenses.includes(license) && (
                          <Check className="size-3 text-primary" />
                        )}
                        {license}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      onChange={(e) => setCustomLicense(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCustomLicense()
                        }
                      }}
                      placeholder="Add custom license"
                      value={customLicense}
                    />
                    <Button onClick={addCustomLicense} type="button" variant="outline">
                      Add
                    </Button>
                  </div>
                  {formData.licenses.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.licenses.map((license) => (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary text-xs"
                          key={license}
                        >
                          {license}
                          <button
                            className="hover:text-primary/80"
                            onClick={(e) => {
                              e.preventDefault()
                              handleLicenseToggle(license)
                            }}
                            type="button"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Preferred Categories *</Label>
                  <div className="flex flex-wrap gap-2">
                    {REAL_WORLD_CATEGORIES.map((category) => (
                      <button
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                        key={category}
                        onClick={(e) => {
                          e.preventDefault()
                          handleCategoryToggle(category)
                        }}
                        type="button"
                      >
                        {formData.preferredCategories.includes(category) && (
                          <Check className="size-3 text-primary" />
                        )}
                        {category}
                      </button>
                    ))}
                  </div>
                  {formData.preferredCategories.filter((cat) => REAL_WORLD_CATEGORIES.includes(cat))
                    .length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.preferredCategories
                        .filter((cat) => REAL_WORLD_CATEGORIES.includes(cat))
                        .map((category) => (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary text-xs"
                            key={category}
                          >
                            {category}
                            <button
                              className="hover:text-primary/80"
                              onClick={(e) => {
                                e.preventDefault()
                                handleCategoryToggle(category)
                              }}
                              type="button"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Availability *</Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <button
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                        key={option.value}
                        onClick={(e) => {
                          e.preventDefault()
                          handleAvailabilityToggle(option.value)
                        }}
                        type="button"
                      >
                        {formData.availability.includes(option.value) && (
                          <Check className="size-3 text-primary" />
                        )}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sim Racing Card */}
          {(formData.racingType === "sim-racing" || formData.racingType === "both") && (
            <Card>
              <CardHeader>
                <CardTitle>Sim Racing</CardTitle>
                <CardDescription>
                  Specify your sim racing platforms, rating, preferred categories, and availability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Sim Racing Platforms</Label>
                  <div className="flex flex-wrap gap-2">
                    {SIM_RACING_PLATFORMS.map((platform) => (
                      <button
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                        key={platform}
                        onClick={(e) => {
                          e.preventDefault()
                          handleSimPlatformToggle(platform)
                        }}
                        type="button"
                      >
                        {formData.simRacingPlatforms.includes(platform) && (
                          <Check className="size-3 text-primary" />
                        )}
                        {platform}
                      </button>
                    ))}
                  </div>
                  {formData.simRacingPlatforms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.simRacingPlatforms.map((platform) => (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary text-xs"
                          key={platform}
                        >
                          {platform}
                          <button
                            className="hover:text-primary/80"
                            onClick={(e) => {
                              e.preventDefault()
                              handleSimPlatformToggle(platform)
                            }}
                            type="button"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simRacingRating">Sim Racing Rating (Optional)</Label>
                  <Input
                    id="simRacingRating"
                    name="simRacingRating"
                    onChange={handleChange}
                    placeholder="e.g., A License, iRating: 3500, S Rating"
                    value={formData.simRacingRating}
                  />
                  <p className="text-muted-foreground text-xs">
                    Your rating or license level on your primary sim racing platform
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Preferred Categories *</Label>
                  <div className="flex flex-wrap gap-2">
                    {SIM_RACING_CATEGORIES.map((category) => (
                      <button
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                        key={category}
                        onClick={(e) => {
                          e.preventDefault()
                          handleCategoryToggle(category)
                        }}
                        type="button"
                      >
                        {formData.preferredCategories.includes(category) && (
                          <Check className="size-3 text-primary" />
                        )}
                        {category}
                      </button>
                    ))}
                  </div>
                  {formData.preferredCategories.filter((cat) => SIM_RACING_CATEGORIES.includes(cat))
                    .length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.preferredCategories
                        .filter((cat) => SIM_RACING_CATEGORIES.includes(cat))
                        .map((category) => (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary text-xs"
                            key={category}
                          >
                            {category}
                            <button
                              className="hover:text-primary/80"
                              onClick={(e) => {
                                e.preventDefault()
                                handleCategoryToggle(category)
                              }}
                              type="button"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {formData.racingType === "sim-racing" && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label>Availability *</Label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABILITY_OPTIONS.map((option) => (
                          <button
                            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                            key={option.value}
                            onClick={(e) => {
                              e.preventDefault()
                              handleAvailabilityToggle(option.value)
                            }}
                            type="button"
                          >
                            {formData.availability.includes(option.value) && (
                              <Check className="size-3 text-primary" />
                            )}
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                How teams can reach out to you (optional, but recommended)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactInfo.phone">Phone</Label>
                  <Input
                    id="contactInfo.phone"
                    name="contactInfo.phone"
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                    type="tel"
                    value={formData.contactInfo.phone}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactInfo.email">Email</Label>
                  <Input
                    id="contactInfo.email"
                    name="contactInfo.email"
                    onChange={handleChange}
                    placeholder="your@email.com"
                    type="email"
                    value={formData.contactInfo.email}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle>Social Links (Optional)</CardTitle>
              <CardDescription>Connect your social media and website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="socialLinks.instagram">Instagram</Label>
                  <Input
                    id="socialLinks.instagram"
                    name="socialLinks.instagram"
                    onChange={handleChange}
                    placeholder="@username"
                    value={formData.socialLinks.instagram}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialLinks.twitter">Twitter/X</Label>
                  <Input
                    id="socialLinks.twitter"
                    name="socialLinks.twitter"
                    onChange={handleChange}
                    placeholder="@username"
                    value={formData.socialLinks.twitter}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialLinks.linkedin">LinkedIn</Label>
                  <Input
                    id="socialLinks.linkedin"
                    name="socialLinks.linkedin"
                    onChange={handleChange}
                    placeholder="linkedin.com/in/username"
                    value={formData.socialLinks.linkedin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialLinks.website">Website</Label>
                  <Input
                    id="socialLinks.website"
                    name="socialLinks.website"
                    onChange={handleChange}
                    placeholder="https://yourwebsite.com"
                    type="url"
                    value={formData.socialLinks.website}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Link href="/motorsports/drivers">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button disabled={isSubmitting} size="lg" type="submit">
              {(() => {
                if (isSubmitting) {
                  return editProfileId ? "Updating Profile..." : "Creating Profile..."
                }
                return editProfileId ? "Update Profile" : "Create Profile"
              })()}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
