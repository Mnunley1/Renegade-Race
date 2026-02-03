"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { AlertCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"

type ReportDialogProps = {
  type: "user" | "vehicle" | "review"
  targetId: string
  trigger?: React.ReactNode
}

const REPORT_REASONS = [
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "fraud", label: "Fraud" },
  { value: "safety_concern", label: "Safety Concern" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
]

export function ReportDialog({ type, targetId, trigger }: ReportDialogProps) {
  const { user, isSignedIn } = useUser()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createReport = useMutation(api.reports.createReport)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!(isSignedIn && user?.id)) {
      toast.error("You must be signed in to report content")
      return
    }

    if (!reason) {
      toast.error("Please select a reason for reporting")
      return
    }

    if (!description.trim()) {
      toast.error("Please provide a description")
      return
    }

    setIsSubmitting(true)

    try {
      type ReasonType =
        | "inappropriate_content"
        | "fraud"
        | "safety_concern"
        | "harassment"
        | "spam"
        | "other"

      if (type === "user") {
        await createReport({
          reason: reason as ReasonType,
          description: description.trim(),
          reportedUserId: targetId,
        })
      } else if (type === "vehicle") {
        await createReport({
          reason: reason as ReasonType,
          description: description.trim(),
          reportedVehicleId: targetId as Id<"vehicles">,
        })
      } else {
        await createReport({
          reason: reason as ReasonType,
          description: description.trim(),
          reportedReviewId: targetId as Id<"rentalReviews">,
        })
      }

      toast.success("Report submitted successfully", {
        description: "Our team will review your report shortly.",
      })

      setOpen(false)
      setReason("")
      setDescription("")
    } catch (_error) {
      toast.error("Failed to submit report", {
        description: "Please try again later.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <AlertCircle className="mr-2 size-4" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report {type}</DialogTitle>
          <DialogDescription>
            Help us keep Renegade Rentals safe by reporting inappropriate content or behavior.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <Label>Reason for reporting</Label>
            <RadioGroup onValueChange={setReason} value={reason}>
              {REPORT_REASONS.map((option) => (
                <div className="flex items-center space-x-2" key={option.value}>
                  <RadioGroupItem id={option.value} value={option.value} />
                  <Label className="font-normal text-sm" htmlFor={option.value}>
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details about why you're reporting this..."
              rows={4}
              value={description}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
