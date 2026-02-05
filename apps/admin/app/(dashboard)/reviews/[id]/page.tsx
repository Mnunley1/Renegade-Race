"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import type { Id } from "@renegade/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useMutation, useQuery } from "convex/react"
import { format, formatDistanceToNow } from "date-fns"
import {
  Calendar,
  Car,
  CheckCircle,
  Eye,
  EyeOff,
  MessageSquare,
  Star,
  Trash2,
  User,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DetailPageLayout } from "@/components/detail-page-layout"
import { LoadingState } from "@/components/loading-state"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"

export default function ReviewDetailPage() {
  const router = useRouter()
  const params = useParams()
  const reviewId = params.id as Id<"rentalReviews">

  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const review = useQuery(api.admin.getReviewDetail, { reviewId })
  const toggleVisibility = useMutation(api.admin.toggleReviewVisibility)
  const markModerated = useMutation(api.admin.markReviewAsModerated)
  const deleteReview = useMutation(api.admin.deleteReviewAsAdmin)

  const handleToggleVisibility = async () => {
    if (!review) return
    try {
      await toggleVisibility({ reviewId, isPublic: !review.isPublic })
      toast.success(review.isPublic ? "Review hidden" : "Review published")
    } catch (_err) {
      toast.error("Failed to update visibility")
    }
  }

  const handleMarkModerated = async () => {
    try {
      await markModerated({ reviewId })
      toast.success("Review marked as moderated")
    } catch (_err) {
      toast.error("Failed to mark as moderated")
    }
  }

  const handleDelete = async () => {
    try {
      await deleteReview({ reviewId })
      toast.success("Review deleted")
      router.push("/reviews")
    } catch (_err) {
      toast.error("Failed to delete review")
    }
  }

  if (review === undefined) return <LoadingState message="Loading review..." />
  if (!review) {
    return (
      <div>
        <DetailPageLayout title="Review Not Found">
          <p className="text-muted-foreground">This review could not be found.</p>
        </DetailPageLayout>
      </div>
    )
  }

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          className={`h-5 w-5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          key={i}
        />
      ))}
      <span className="ml-2 font-semibold text-lg">{rating}/5</span>
    </div>
  )

  return (
    <DetailPageLayout
      actions={
        <div className="flex items-center gap-2">
          <Button onClick={handleToggleVisibility} variant="outline">
            {review.isPublic ? (
              <EyeOff className="mr-2 h-4 w-4" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {review.isPublic ? "Hide" : "Publish"}
          </Button>
          {!review.isModerated && (
            <Button onClick={handleMarkModerated} variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Moderated
            </Button>
          )}
          <Button onClick={() => setDeleteConfirm(true)} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      }
      badges={
        <div className="flex items-center gap-2">
          <StatusBadge status={review.isPublic ? "published" : "hidden"} />
          <StatusBadge status={review.isModerated ? "moderated" : "unmoderated"} />
        </div>
      }
      title={review.title}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 font-medium text-muted-foreground text-sm">Overall Rating</h3>
                {renderStars(review.rating)}
              </div>
              <Separator />
              <div>
                <h3 className="mb-2 font-medium text-muted-foreground text-sm">Review Text</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{review.review}</p>
              </div>
              {review.communication !== undefined && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="mb-1 font-medium text-muted-foreground text-xs">
                        Communication
                      </h4>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-sm">{review.communication}</span>
                      </div>
                    </div>
                    {review.vehicleCondition !== undefined && (
                      <div>
                        <h4 className="mb-1 font-medium text-muted-foreground text-xs">
                          Vehicle Condition
                        </h4>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-sm">{review.vehicleCondition}</span>
                        </div>
                      </div>
                    )}
                    {review.professionalism !== undefined && (
                      <div>
                        <h4 className="mb-1 font-medium text-muted-foreground text-xs">
                          Professionalism
                        </h4>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-sm">{review.professionalism}</span>
                        </div>
                      </div>
                    )}
                    {review.overallExperience !== undefined && (
                      <div>
                        <h4 className="mb-1 font-medium text-muted-foreground text-xs">
                          Overall Experience
                        </h4>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-sm">{review.overallExperience}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              <Separator />
              <div>
                <h3 className="mb-2 font-medium text-muted-foreground text-sm">Posted</h3>
                <p className="text-sm">
                  {formatDistanceToNow(review.createdAt, { addSuffix: true })}
                </p>
                <p className="text-muted-foreground text-xs">{format(review.createdAt, "PPpp")}</p>
              </div>
            </CardContent>
          </Card>

          {review.response && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  Response
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {review.response.text}
                </p>
                {review.response.respondedAt && (
                  <p className="mt-3 text-muted-foreground text-xs">
                    {formatDistanceToNow(review.response.respondedAt, { addSuffix: true })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Reviewer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {review.reviewer && (
                <div className="flex items-center justify-between">
                  <UserAvatar email={review.reviewer.email || ""} name={review.reviewer.name} />
                  <Button
                    onClick={() => router.push(`/users/${review.reviewer?.externalId}`)}
                    size="sm"
                    variant="outline"
                  >
                    View Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Reviewed User
              </CardTitle>
            </CardHeader>
            <CardContent>
              {review.reviewed && (
                <div className="flex items-center justify-between">
                  <UserAvatar email={review.reviewed.email || ""} name={review.reviewed.name} />
                  <Button
                    onClick={() => router.push(`/users/${review.reviewed?.externalId}`)}
                    size="sm"
                    variant="outline"
                  >
                    View Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {review.vehicle && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Car className="h-4 w-4" />
                  Vehicle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">
                    {review.vehicle.year} {review.vehicle.make} {review.vehicle.model}
                  </p>
                  <Button
                    className="mt-2"
                    onClick={() => router.push(`/vehicles/${review.vehicle?._id}`)}
                    size="sm"
                    variant="outline"
                  >
                    View Vehicle
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {review.reservation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Reservation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">{review.reservation.startDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Date</span>
                  <span className="font-medium">{review.reservation.endDate}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-semibold">
                    ${review.reservation.totalAmount.toFixed(2)}
                  </span>
                </div>
                <Button
                  className="mt-2 w-full"
                  onClick={() => router.push(`/reservations/${review.reservation?._id}`)}
                  size="sm"
                  variant="outline"
                >
                  View Reservation
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Delete"
        description="Are you sure you want to delete this review? This action cannot be undone."
        onConfirm={handleDelete}
        onOpenChange={setDeleteConfirm}
        open={deleteConfirm}
        title="Delete Review"
      />
    </DetailPageLayout>
  )
}
