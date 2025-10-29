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
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { ArrowLeft, Check, Plus, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const COMMON_SPECIALTIES = [
  "GT3",
  "GT4",
  "Formula",
  "Open Wheel",
  "Endurance",
  "Time Attack",
  "Drifting",
  "Club Racing",
  "Vintage Racing",
  "Cup Series",
  "Track Days",
]

export default function CreateTeamProfilePage() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logoUrl: "",
    location: "",
    specialties: [] as string[],
    availableSeats: 1,
    requirements: [] as string[],
    contactInfo: {
      phone: "",
      email: "",
      website: "",
    },
    socialLinks: {
      instagram: "",
      twitter: "",
      facebook: "",
      linkedin: "",
    },
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newRequirement, setNewRequirement] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // TODO: Connect to Convex mutation to create team profile
      // await api.teams.create({ ...formData })

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
    } else if (name === "availableSeats") {
      setFormData({ ...formData, [name]: Number.parseInt(value, 10) || 0 })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const toggleSpecialty = (specialty: string) => {
    if (formData.specialties.includes(specialty)) {
      setFormData({
        ...formData,
        specialties: formData.specialties.filter((s) => s !== specialty),
      })
    } else {
      setFormData({
        ...formData,
        specialties: [...formData.specialties, specialty],
      })
    }
  }

  const addRequirement = () => {
    if (newRequirement.trim() && !formData.requirements.includes(newRequirement.trim())) {
      setFormData({
        ...formData,
        requirements: [...formData.requirements, newRequirement.trim()],
      })
      setNewRequirement("")
    }
  }

  const removeRequirement = (requirement: string) => {
    setFormData({
      ...formData,
      requirements: formData.requirements.filter((r) => r !== requirement),
    })
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
        <h1 className="mb-2 font-bold text-3xl">Create Team Profile</h1>
        <p className="text-muted-foreground">Create your racing team profile to find drivers</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Tell drivers about your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  name="name"
                  onChange={handleChange}
                  placeholder="Precision Racing Team"
                  required
                  value={formData.name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  className="min-h-32 resize-none"
                  id="description"
                  name="description"
                  onChange={handleChange}
                  placeholder="Describe your team, racing history, achievements, and what makes your team unique..."
                  required
                  value={formData.description}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
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

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Team Logo URL (Optional)</Label>
                  <Input
                    id="logoUrl"
                    name="logoUrl"
                    onChange={handleChange}
                    placeholder="https://example.com/logo.png"
                    type="url"
                    value={formData.logoUrl}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="availableSeats">Available Seats *</Label>
                <Input
                  id="availableSeats"
                  max={100}
                  min={1}
                  name="availableSeats"
                  onChange={handleChange}
                  required
                  type="number"
                  value={formData.availableSeats}
                />
                <p className="text-muted-foreground text-xs">
                  Number of driver positions you're looking to fill
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Racing Details */}
          <Card>
            <CardHeader>
              <CardTitle>Racing Details</CardTitle>
              <CardDescription>
                Specify your team's specialties and requirements for drivers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Specialties *</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SPECIALTIES.map((specialty) => (
                    <button
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                      key={specialty}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleSpecialty(specialty)
                      }}
                      type="button"
                    >
                      {formData.specialties.includes(specialty) && (
                        <Check className="size-3 text-primary" />
                      )}
                      {specialty}
                    </button>
                  ))}
                </div>
                {formData.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.specialties.map((specialty) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary text-xs"
                        key={specialty}
                      >
                        {specialty}
                        <button
                          className="hover:text-primary/80"
                          onClick={(e) => {
                            e.preventDefault()
                            toggleSpecialty(specialty)
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
                <Label>Requirements for Drivers *</Label>
                <p className="text-muted-foreground text-xs">
                  List the qualifications and requirements drivers must meet
                </p>
                <div className="flex gap-2">
                  <Input
                    onChange={(e) => setNewRequirement(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addRequirement()
                      }
                    }}
                    placeholder="e.g., FIA License, 5+ years experience"
                    value={newRequirement}
                  />
                  <Button onClick={addRequirement} type="button" variant="outline">
                    <Plus className="size-4" />
                  </Button>
                </div>
                {formData.requirements.length > 0 && (
                  <div className="space-y-2">
                    {formData.requirements.map((requirement) => (
                      <div
                        className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
                        key={requirement}
                      >
                        <span className="text-sm">{requirement}</span>
                        <Button
                          onClick={() => removeRequirement(requirement)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                How drivers can reach out to you (optional, but recommended)
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
                    placeholder="contact@team.com"
                    type="email"
                    value={formData.contactInfo.email}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="contactInfo.website">Website</Label>
                  <Input
                    id="contactInfo.website"
                    name="contactInfo.website"
                    onChange={handleChange}
                    placeholder="https://www.teamwebsite.com"
                    type="url"
                    value={formData.contactInfo.website}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle>Social Links (Optional)</CardTitle>
              <CardDescription>Connect your team's social media</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="socialLinks.instagram">Instagram</Label>
                  <Input
                    id="socialLinks.instagram"
                    name="socialLinks.instagram"
                    onChange={handleChange}
                    placeholder="@teamname"
                    value={formData.socialLinks.instagram}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialLinks.twitter">Twitter/X</Label>
                  <Input
                    id="socialLinks.twitter"
                    name="socialLinks.twitter"
                    onChange={handleChange}
                    placeholder="@teamname"
                    value={formData.socialLinks.twitter}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialLinks.facebook">Facebook</Label>
                  <Input
                    id="socialLinks.facebook"
                    name="socialLinks.facebook"
                    onChange={handleChange}
                    placeholder="facebook.com/teamname"
                    value={formData.socialLinks.facebook}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialLinks.linkedin">LinkedIn</Label>
                  <Input
                    id="socialLinks.linkedin"
                    name="socialLinks.linkedin"
                    onChange={handleChange}
                    placeholder="linkedin.com/company/teamname"
                    value={formData.socialLinks.linkedin}
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
              {isSubmitting ? "Creating Team..." : "Create Team Profile"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
