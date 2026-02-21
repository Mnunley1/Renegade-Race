"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useMutation, useQuery } from "convex/react"
import { CheckCircle, Eye, EyeOff, Loader2, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { DataTableBulkActions } from "@/components/data-table/data-table-bulk-actions"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar, type FilterConfig } from "@/components/data-table/data-table-toolbar"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { StatusBadge } from "@/components/status-badge"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

function getReviewStatus(review: any) {
  if (!review.isPublic) return "hidden"
  if (!review.isModerated) return "unmoderated"
  return "published"
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          className={`size-3.5 ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
          key={star}
        />
      ))}
      <span className="ml-1 text-sm">{rating}</span>
    </div>
  )
}

export default function ReviewsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isPublicFilter, setIsPublicFilter] = useState<boolean | undefined>(undefined)
  const [isModeratedFilter, setIsModeratedFilter] = useState<boolean | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const result = useQuery(api.admin.getAllReviews, {
    limit: 50,
    search: searchQuery || undefined,
    isPublic: isPublicFilter,
    isModerated: isModeratedFilter,
    cursor,
  })

  const reviews = result?.reviews || []
  const hasMore = result?.hasMore

  const deleteReview = useMutation(api.admin.deleteReviewAsAdmin)
  const toggleVisibility = useMutation(api.admin.toggleReviewVisibility)
  const markModerated = useMutation(api.admin.markReviewAsModerated)
  const bulkDeleteReviews = useMutation(api.admin.bulkDeleteReviews)
  const bulkToggleVisibility = useMutation(api.admin.bulkToggleReviewVisibility)
  const bulkMarkModerated = useMutation(api.admin.bulkMarkReviewsAsModerated)

  const [processingId, setProcessingId] = useState<Id<"rentalReviews"> | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  useMemo(() => {
    if (isPublicFilter !== undefined || isModeratedFilter !== undefined || searchQuery) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [isPublicFilter, isModeratedFilter, searchQuery])

  const handleDelete = async (reviewId: Id<"rentalReviews">) => {
    if (!confirm("Are you sure you want to delete this review? This action cannot be undone."))
      return

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

  const handleToggleVisibility = async (
    reviewId: Id<"rentalReviews">,
    currentVisibility: boolean
  ) => {
    setProcessingId(reviewId)
    try {
      await toggleVisibility({ reviewId, isPublic: !currentVisibility })
      toast.success(`Review ${currentVisibility ? "hidden" : "published"} successfully`)
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
    )
      return

    setIsBulkProcessing(true)
    try {
      await bulkDeleteReviews({ reviewIds: Array.from(selectedIds) as Id<"rentalReviews">[] })
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
        reviewIds: Array.from(selectedIds) as Id<"rentalReviews">[],
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
      await bulkMarkModerated({ reviewIds: Array.from(selectedIds) as Id<"rentalReviews">[] })
      toast.success(`${selectedIds.size} review(s) marked as moderated`)
      setSelectedIds(new Set())
    } catch (error) {
      handleErrorWithContext(error, { action: "mark as moderated", entity: "reviews" })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setCursor(undefined)
  }

  const columns: Column<any>[] = [
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={getReviewStatus(row)} />,
    },
    {
      key: "rating",
      header: "Rating",
      cell: (row) => <RatingStars rating={row.rating} />,
      sortable: true,
      sortValue: (row) => row.rating,
    },
    {
      key: "title",
      header: "Title",
      cell: (row) => (
        <span className="inline-block max-w-[200px] truncate font-medium" title={row.title}>
          {row.title}
        </span>
      ),
    },
    {
      key: "reviewer",
      header: "Reviewer",
      cell: (row) => row.reviewer?.name || "Unknown",
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <span>
          {row.vehicle?.year} {row.vehicle?.make} {row.vehicle?.model}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        const isProcessing = processingId === row._id
        const VisibilityIcon = row.isPublic ? EyeOff : Eye
        return (
          <div className="flex gap-1">
            {!row.isModerated && (
              <Button
                disabled={isProcessing}
                onClick={() => handleMarkModerated(row._id)}
                size="sm"
                title="Mark Moderated"
                variant="outline"
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle className="size-4" />
                )}
              </Button>
            )}
            <Button
              disabled={isProcessing}
              onClick={() => handleToggleVisibility(row._id, row.isPublic)}
              size="sm"
              title={row.isPublic ? "Hide" : "Show"}
              variant="outline"
            >
              {isProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <VisibilityIcon className="size-4" />
              )}
            </Button>
            <Button
              disabled={isProcessing}
              onClick={() => handleDelete(row._id)}
              size="sm"
              title="Delete"
              variant="destructive"
            >
              {isProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </div>
        )
      },
    },
  ]

  let visibilityFilterValue: string | undefined
  if (isPublicFilter === undefined) visibilityFilterValue = undefined
  else visibilityFilterValue = isPublicFilter ? "public" : "hidden"

  let moderationFilterValue: string | undefined
  if (isModeratedFilter === undefined) moderationFilterValue = undefined
  else moderationFilterValue = isModeratedFilter ? "moderated" : "unmoderated"

  const filters: FilterConfig[] = [
    {
      key: "visibility",
      label: "Visibility",
      options: [
        { label: "Public", value: "public" },
        { label: "Hidden", value: "hidden" },
      ],
      value: visibilityFilterValue,
      onChange: (value) => setIsPublicFilter(value === undefined ? undefined : value === "public"),
    },
    {
      key: "moderation",
      label: "Moderation",
      options: [
        { label: "Moderated", value: "moderated" },
        { label: "Unmoderated", value: "unmoderated" },
      ],
      value: moderationFilterValue,
      onChange: (value) =>
        setIsModeratedFilter(value === undefined ? undefined : value === "moderated"),
    },
  ]

  const totalPages = Math.ceil((reviews.length || 0) / 50) || 1

  return (
    <div className="space-y-6">
      <PageHeader description="Moderate and manage platform reviews" title="Reviews Management" />

      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
          <CardDescription>
            {reviews.length} review(s) found
            {hasMore && " (showing first page)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            bulkActions={
              <DataTableBulkActions
                actions={[
                  {
                    label: isBulkProcessing ? "Processing..." : "Mark Moderated",
                    icon: isBulkProcessing ? Loader2 : CheckCircle,
                    onClick: handleBulkMarkModerated,
                  },
                  {
                    label: "Show",
                    icon: Eye,
                    onClick: () => handleBulkToggleVisibility(true),
                  },
                  {
                    label: "Hide",
                    icon: EyeOff,
                    onClick: () => handleBulkToggleVisibility(false),
                  },
                  {
                    label: "Delete",
                    icon: Trash2,
                    variant: "destructive",
                    onClick: handleBulkDelete,
                  },
                ]}
              />
            }
            columns={columns}
            data={reviews}
            emptyMessage="No reviews found"
            getRowId={(row) => row._id}
            isLoading={result === undefined}
            onSelectionChange={setSelectedIds}
            pagination={
              hasMore ? (
                <Pagination
                  currentPage={currentPage}
                  hasMore={hasMore}
                  onLoadMore={() => {
                    if (result?.nextCursor) {
                      setCursor(result.nextCursor)
                      setCurrentPage(currentPage + 1)
                    }
                  }}
                  onPageChange={handlePageChange}
                  totalPages={totalPages}
                />
              ) : undefined
            }
            selectedIds={selectedIds}
            toolbar={
              <DataTableToolbar
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    reviews,
                    [
                      {
                        key: "status",
                        header: "Status",
                        value: (r) => getReviewStatus(r),
                      },
                      { key: "rating", header: "Rating", value: (r) => r.rating },
                      { key: "title", header: "Title", value: (r) => r.title ?? "" },
                      {
                        key: "reviewer",
                        header: "Reviewer",
                        value: (r) => r.reviewer?.name ?? "Unknown",
                      },
                      {
                        key: "vehicle",
                        header: "Vehicle",
                        value: (r) =>
                          `${r.vehicle?.year ?? ""} ${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""}`.trim(),
                      },
                      {
                        key: "date",
                        header: "Date",
                        value: (r) => new Date(r.createdAt).toLocaleDateString(),
                      },
                    ],
                    "reviews"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search reviews..."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
