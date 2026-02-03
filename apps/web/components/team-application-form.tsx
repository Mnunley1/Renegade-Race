"use client"

import type { Id } from "@renegade/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"

type TeamApplicationFormProps = {
  teamId: Id<"teams">
}

export function TeamApplicationForm({ teamId }: TeamApplicationFormProps) {
  const apply = useMutation(api.teamApplications.apply)
  const driverProfile = useQuery(api.driverProfiles.getByUser)
  const existingApplications = useQuery(api.teamApplications.getByDriver)

  const [message, setMessage] = useState("")
  const [driverExperience, setDriverExperience] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if user has already applied to this team
  const hasApplied = Boolean(
    existingApplications?.some((app: any) => app.teamId === teamId && app.status === "pending")
  )

  // Check if user has a driver profile
  const hasDriverProfile = Boolean(driverProfile?.length)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasDriverProfile) {
      toast.error("Please create a driver profile first")
      return
    }

    if (hasApplied) {
      toast.error("You have already applied to this team")
      return
    }

    const trimmedMessage = message.trim()
    const trimmedExperience = driverExperience.trim()
    if (trimmedMessage.length === 0 || trimmedExperience.length === 0) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      await apply({
        teamId,
        message: trimmedMessage,
        driverExperience: trimmedExperience,
        preferredDates: [],
      })

      toast.success("Application submitted successfully!")
      setMessage("")
      setDriverExperience("")
    } catch {
      toast.error("Failed to submit application. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!hasDriverProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Process</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You need to create a driver profile before you can apply to teams.
          </p>
          <Button asChild className="w-full" size="lg">
            <Link href="/motorsports/profile/driver">Create Driver Profile</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (hasApplied) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Process</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You have already submitted an application to this team. The team will review your
            application and get back to you.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply to This Team</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="message">Cover Letter / Message *</Label>
            <Textarea
              className="min-h-32 resize-none"
              id="message"
              name="message"
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the team why you're interested in joining and what you can bring to the team..."
              required
              value={message}
            />
            <p className="text-muted-foreground text-xs">
              Introduce yourself and explain why you're a good fit for this team
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverExperience">Racing Experience *</Label>
            <Textarea
              className="min-h-24 resize-none"
              id="driverExperience"
              name="driverExperience"
              onChange={(e) => setDriverExperience(e.target.value)}
              placeholder="Describe your racing experience, licenses, achievements, and relevant background..."
              required
              value={driverExperience}
            />
            <p className="text-muted-foreground text-xs">
              Detail your racing history, licenses, and accomplishments
            </p>
          </div>

          <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Application"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
