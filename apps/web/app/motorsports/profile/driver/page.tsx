"use client"

import { useMutation } from "convex/react"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@clerk/nextjs"
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
import { ArrowLeft, Check, Loader2 } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
]

const COMMON_LICENSES = ["FIA", "NASA", "SCCA", "IMSA", "HPDE", "Other"]

const COMMON_CATEGORIES = [
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
  // Sim Racing Categories
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
  const { isSignedIn, isLoaded: userLoaded } = useUser()
  const [formData, setFormData] = useState({
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

  const createDriverProfile = useMutation(api.driverProfiles.create)

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (userLoaded && !isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname || "/motorsports/profile/driver")}`)
    }
  }, [isSignedIn, userLoaded, router, pathname])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Map experience to match Convex schema
      const experienceMap: Record<string, "beginner" | "intermediate" | "advanced" | "professional"> = {
        Beginner: "beginner",
        Intermediate: "intermediate",
        Advanced: "advanced",
        Professional: "professional",
      }

      await createDriverProfile({
        bio: formData.bio,
        experience: experienceMap[formData.experience] || "beginner",
        racingType: formData.racingType ? (formData.racingType as "real-world" | "sim-racing" | "both") : undefined,
        simRacingPlatforms: formData.simRacingPlatforms.length > 0 ? formData.simRacingPlatforms : undefined,
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

      // Redirect to drivers page after successful creation
      router.push("/motorsports/drivers")
    } catch (error) {
      console.error("Error creating driver profile:", error)
      alert("Failed to create driver profile. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name.startsWith("contactInfo.")) {
      const field = name.split(".")[1]
      setFormData({
        ...formData,
        contactInfo: { ...formData.contactInfo, [field]: value },
      })
    } else if (name.startsWith("socialLinks.")) {
      const field = name.split(".")[1]
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

  // Show loading state while checking authentication
  if (!userLoaded) {
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

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link href="/motorsports/drivers">
        <Button className="mb-6" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back to Drivers
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">Create Driver Profile</h1>
        <p className="text-muted-foreground">
          Create your driver profile to connect with racing teams
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

          {/* Racing Type */}
          <Card>
            <CardHeader>
              <CardTitle>Racing Type</CardTitle>
              <CardDescription>
                Select whether you participate in real-world racing, sim racing, or both
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              {(formData.racingType === "sim-racing" || formData.racingType === "both") && (
                <>
                  <Separator />
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Racing Details */}
          <Card>
            <CardHeader>
              <CardTitle>Racing Details</CardTitle>
              <CardDescription>
                Specify your licenses, preferred categories, and availability
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
                  {COMMON_CATEGORIES.map((category) => (
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
                {formData.preferredCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.preferredCategories.map((category) => (
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
              {isSubmitting ? "Creating Profile..." : "Create Driver Profile"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
