"use client"

import { useQuery, useMutation } from "convex/react"
import { useState, useMemo } from "react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Star,
  Search,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { handleErrorWithContext } from "@/lib/error-handler"
import { Pagination } from "@/components/pagination"
import type { Id } from "@/lib/convex"

export default function ReviewsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isPublicFilter, setIsPublicFilter] = useState<boolean | undefined>(undefined)
  const [isModeratedFilter, setIsModeratedFilter] = useState<boolean | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<Id<"rentalReviews">>>(new Set())
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const result = useQuery(api.admin.getAllReviews, {
    limit: 50,
    search: searchQuery || undefined,
    isPublic: isPublicFilter,
    isModerated: isModeratedFilter,
    cursor,
  })

  const reviews = result?.reviews || []
  const hasMore = result?.hasMore || false

  const deleteReview = useMutation(api.admin.deleteReviewAsAdmin)
  const toggleVisibility = useMutation(api.admin.toggleReviewVisibility)
  const markModerated = useMutation(api.admin.markReviewAsModerated)
  const bulkDeleteReviews = useMutation(api.admin.bulkDeleteReviews)
  const bulkToggleVisibility = useMutation(api.admin.bulkToggleReviewVisibility)
  const bulkMarkModerated = useMutation(api.admin.bulkMarkReviewsAsModerated)

  const [processingId, setProcessingId] = useState<Id<"rentalReviews"> | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // Reset to page 1 when filters change
  useMemo(() => {
    if (isPublicFilter !== undefined || isModeratedFilter !== undefined || searchQuery) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [isPublicFilter, isModeratedFilter, searchQuery])

  const handleDelete = async (reviewId: Id<"rentalReviews">) => {
    if (!confirm("Are you sure you want to delete this review? This action cannot be undone.")) {
      return
    }

    setProcessingId(reviewId)
    try {
      await deleteReview({ reviewId })
      toast.success("Review deleted successfully")
      setSelectedIds(new Set())
    } catch (error) {
      handleErrorWithContext(error, { action: "delete review", entity: "review" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleToggleVisibility = async (reviewId: Id<"rentalReviews">, currentVisibility: boolean) => {
    setProcessingId(reviewId)
    try {
      await toggleVisibility({ reviewId, isPublic: !currentVisibility })
      toast.success(`Review ${!currentVisibility ? "published" : "hidden"} successfully`)
    } catch (error) {
      handleErrorWithContext(error, { action: "toggle visibility", entity: "review" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkModerated = async (reviewId: Id<"rentalReviews">) => {
    setProcessingId(reviewId)
    try {
      await markModerated({ reviewId })
      toast.success("Review marked as moderated")
    } catch (error) {
      handleErrorWithContext(error, { action: "mark as moderated", entity: "review" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} review(s)? This action cannot be undone.`
      )
    ) {
      return
    }

    setIsBulkProcessing(true)
    try {
      await bulkDeleteReviews({ reviewIds: Array.from(selectedIds) })
      toast.success(`${selectedIds.size} review(s) deleted successfully`)
      setSelectedIds(new Set())
    } catch (error) {
      handleErrorWithContext(error, { action: "delete reviews", entity: "reviews" })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleBulkToggleVisibility = async (isPublic: boolean) => {
    if (selectedIds.size === 0) return

    setIsBulkProcessing(true)
    try {
      await bulkToggleVisibility({
        reviewIds: Array.from(selectedIds),
        isPublic,
      })
      toast.success(
        `${selectedIds.size} review(s) ${isPublic ? "published" : "hidden"} successfully`
      )
      setSelectedIds(new Set())
    } catch (error) {
      handleErrorWithContext(error, { action: "toggle visibility", entity: "reviews" })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleBulkMarkModerated = async () => {
    if (selectedIds.size === 0) return

    setIsBulkProcessing(true)
    try {
      await bulkMarkModerated({ reviewIds: Array.from(selectedIds) })
      toast.success(`${selectedIds.size} review(s) marked as moderated`)
      setSelectedIds(new Set())
    } catch (error) {
      handleErrorWithContext(error, { action: "mark as moderated", entity: "reviews" })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === reviews.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(reviews.map((r) => r._id)))
    }
  }

  const handleSelectOne = (id: Id<"rentalReviews">) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setCursor(undefined)
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{rating}</span>
      </div>
    )
  }

  const totalPages = Math.ceil((reviews.length || 0) / 50) || 1

  if (result === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading reviews...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Reviews Management</h1>
        <p className="text-muted-foreground mt-2">
          Moderate and manage platform reviews
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Reviews</CardTitle>
              <CardDescription>
                {reviews.length} review(s) found
                {hasMore && " (showing first page)"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-64 pl-8"
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={isPublicFilter === undefined ? "all" : isPublicFilter ? "public" : "hidden"}
                onValueChange={(value) => {
                  setIsPublicFilter(value === "all" ? undefined : value === "public")
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visibility</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={isModeratedFilter === undefined ? "all" : isModeratedFilter ? "moderated" : "unmoderated"}
                onValueChange={(value) => {
                  setIsModeratedFilter(value === "all" ? undefined : value === "moderated")
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="moderated">Moderated</SelectItem>
                  <SelectItem value="unmoderated">Unmoderated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted p-3">
              <span className="text-sm font-medium">
                {selectedIds.size} review(s) selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkMarkModerated}
                  disabled={isBulkProcessing}
                >
                  {isBulkProcessing ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 size-4" />
                  )}
                  Mark Moderated
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggleVisibility(true)}
                  disabled={isBulkProcessing}
                >
                  <Eye className="mr-2 size-4" />
                  Show Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggleVisibility(false)}
                  disabled={isBulkProcessing}
                >
                  <EyeOff className="mr-2 size-4" />
                  Hide Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkProcessing}
                >
                  {isBulkProcessing ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 size-4" />
                  )}
                  Delete Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {reviews && reviews.length > 0 ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Checkbox
                    checked={selectedIds.size === reviews.length && reviews.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-muted-foreground text-sm">Select all</span>
                </div>
                {reviews.map((review) => {
                  const isProcessing = processingId === review._id
                  const isSelected = selectedIds.has(review._id)

                  return (
                    <Card key={review._id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div className="flex items-start pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectOne(review._id)}
                            />
                          </div>
                          <div className="flex items-start justify-between flex-1">
                            <div className="flex-1 space-y-4">
                              <div className="flex items-start gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(review)}
                                    <h3 className="font-bold text-lg">{review.title}</h3>
                                  </div>
                                  <p className="text-muted-foreground mt-1 line-clamp-2">
                                    {review.review}
                                  </p>
                                  <div className="mt-2">{renderStars(review.rating)}</div>
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Reviewer:</strong> {review.reviewer?.name || "Unknown"}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Reviewed:</strong> {review.reviewed?.name || "Unknown"}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Type:</strong>{" "}
                                    {review.reviewType === "renter_to_owner"
                                      ? "Renter → Owner"
                                      : "Owner → Renter"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Vehicle:</strong> {review.vehicle?.year}{" "}
                                    {review.vehicle?.make} {review.vehicle?.model}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Created:</strong>{" "}
                                    {new Date(review.createdAt).toLocaleDateString()}
                                  </p>
                                  {review.response && (
                                    <p className="text-muted-foreground text-sm">
                                      <strong>Has Response:</strong> Yes
                                    </p>
                                  )}
                                </div>
                              </div>

                              {review.photos && review.photos.length > 0 && (
                                <div>
                                  <p className="text-muted-foreground text-sm mb-2">
                                    <strong>Photos:</strong> {review.photos.length}
                                  </p>
                                  <div className="flex gap-2">
                                    {review.photos.slice(0, 3).map((photo, idx) => (
                                      <img
                                        key={idx}
                                        src={photo}
                                        alt={`Review photo ${idx + 1}`}
                                        className="h-20 w-20 rounded-lg object-cover"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              {!review.isModerated && (
                                <Button
                                  onClick={() => handleMarkModerated(review._id)}
                                  disabled={isProcessing}
                                  variant="outline"
                                  size="sm"
                                >
                                  {isProcessing ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="mr-2 size-4" />
                                      Mark Moderated
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                onClick={() => handleToggleVisibility(review._id, review.isPublic)}
                                disabled={isProcessing}
                                variant={review.isPublic ? "outline" : "default"}
                                size="sm"
                              >
                                {isProcessing ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : review.isPublic ? (
                                  <>
                                    <EyeOff className="mr-2 size-4" />
                                    Hide
                                  </>
                                ) : (
                                  <>
                                    <Eye className="mr-2 size-4" />
                                    Show
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => handleDelete(review._id)}
                                disabled={isProcessing}
                                variant="destructive"
                                size="sm"
                              >
                                {isProcessing ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="mr-2 size-4" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {hasMore && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    hasMore={hasMore}
                    onLoadMore={() => {
                      if (result?.nextCursor) {
                        setCursor(result.nextCursor)
                        setCurrentPage(currentPage + 1)
                      }
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Star className="mx-auto mb-4 size-12 opacity-50" />
              <p>No reviews found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  function getStatusBadge(review: any) {
    if (!review.isPublic) {
      return <Badge variant="secondary">Hidden</Badge>
    }
    if (!review.isModerated) {
      return <Badge variant="default" className="bg-yellow-600">Unmoderated</Badge>
    }
    return <Badge variant="default" className="bg-green-600">Public</Badge>
  }
}
