"use client"

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
import { ArrowLeft, Check } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

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
]

const AVAILABILITY_OPTIONS = ["weekends", "weekdays", "evenings", "flexible"]

export default function CreateDriverProfilePage() {
  const [formData, setFormData] = useState({
    bio: "",
    achievements: "",
    experience: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // TODO: Connect to Convex mutation to create driver profile
      // await api.driverProfiles.create({ ...formData })

      // Simulate API call
      const API_DELAY_MS = 1000
      await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS))

      // Redirect to motorsports page after successful creation
      // router.push('/motorsports')
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

  const addCustomLicense = () => {
    if (customLicense.trim() && !formData.licenses.includes(customLicense.trim())) {
      setFormData({
        ...formData,
        licenses: [...formData.licenses, customLicense.trim()],
      })
      setCustomLicense("")
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link href="/motorsports">
        <Button className="mb-6" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back to Motorsports
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
                      key={option}
                      onClick={(e) => {
                        e.preventDefault()
                        handleAvailabilityToggle(option)
                      }}
                      type="button"
                    >
                      {formData.availability.includes(option) && (
                        <Check className="size-3 text-primary" />
                      )}
                      {option.charAt(0).toUpperCase() + option.slice(1)}
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
            <Link href="/motorsports">
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
