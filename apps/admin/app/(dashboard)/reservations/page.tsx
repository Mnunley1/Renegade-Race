"use client"

import { useQuery, useMutation } from "convex/react"
import { useState, useMemo } from "react"
import Link from "next/link"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
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
import { Calendar, Search, XCircle, Loader2, Eye } from "lucide-react"
import { toast } from "sonner"
import { Pagination } from "@/components/pagination"
import { handleErrorWithContext } from "@/lib/error-handler"
import { DateRangeFilter } from "@/components/date-range-filter"
import type { Id } from "@/lib/convex"

export default function ReservationsPage() {
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "confirmed" | "cancelled" | "completed" | "declined" | undefined
  >(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<Id<"reservations">>>(new Set())
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined
  const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined

  const result = useQuery(api.admin.getAllReservations, {
    status: statusFilter,
    limit: 50,
    search: searchQuery || undefined,
    startDate,
    endDate,
    cursor,
  })

  const reservations = result?.reservations || []
  const hasMore = result?.hasMore

  const cancelReservation = useMutation(api.admin.cancelReservationAsAdmin)
  const [processingId, setProcessingId] = useState<Id<"reservations"> | null>(null)

  // Reset to page 1 when filters change
  useMemo(() => {
    if (statusFilter !== undefined || searchQuery || dateRange) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [statusFilter, searchQuery, dateRange])

  const handleCancel = async (reservationId: Id<"reservations">) => {
    if (
      !confirm("Are you sure you want to cancel this reservation? This action cannot be undone.")
    ) {
      return
    }

    setProcessingId(reservationId)
    try {
      await cancelReservation({ reservationId })
      toast.success("Reservation cancelled successfully")
      setSelectedIds(new Set())
    } catch (error) {
      handleErrorWithContext(error, { action: "cancel reservation" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === reservations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(reservations.map((r: any) => r._id)))
    }
  }

  const handleSelectOne = (id: Id<"reservations">) => {
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
    // For cursor-based pagination, we'd need to track cursors per page
    // For simplicity, we'll use offset-based approach
    setCursor(undefined)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="default">Pending</Badge>
      case "confirmed":
        return (
          <Badge variant="default" className="bg-green-600">
            Confirmed
          </Badge>
        )
      case "completed":
        return <Badge variant="secondary">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      case "declined":
        return <Badge variant="destructive">Declined</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  const totalPages = Math.ceil((reservations.length || 0) / 50) || 1

  if (result === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading reservations...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Reservations Management</h1>
        <p className="mt-2 text-muted-foreground">View and manage all platform reservations</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Reservations</CardTitle>
              <CardDescription>
                {reservations.length} reservation(s) found
                {hasMore && " (showing first page)"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <div className="relative">
                <Search className="-translate-y-1/2 absolute top-1/2 left-2 size-4 text-muted-foreground" />
                <Input
                  className="w-64 pl-8"
                  placeholder="Search reservations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) =>
                  setStatusFilter(
                    value === "all"
                      ? undefined
                      : (value as
                          | "pending"
                          | "confirmed"
                          | "cancelled"
                          | "completed"
                          | "declined")
                  )
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted p-3">
              <span className="font-medium text-sm">{selectedIds.size} item(s) selected</span>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Are you sure you want to cancel ${selectedIds.size} reservation(s)?`
                      )
                    ) {
                      return
                    }
                    try {
                      await Promise.all(
                        Array.from(selectedIds).map((id) =>
                          cancelReservation({ reservationId: id })
                        )
                      )
                      toast.success(`${selectedIds.size} reservation(s) cancelled`)
                      setSelectedIds(new Set())
                    } catch (error) {
                      handleErrorWithContext(error, { action: "cancel reservations" })
                    }
                  }}
                >
                  Cancel Selected
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {reservations && reservations.length > 0 ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Checkbox
                    checked={selectedIds.size === reservations.length && reservations.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-muted-foreground text-sm">Select all</span>
                </div>
                {reservations.map((reservation: any) => {
                  const isProcessing = processingId === reservation._id
                  const isSelected = selectedIds.has(reservation._id)
                  const primaryImage =
                    reservation.vehicle?.images?.find((img: any) => img.isPrimary) ||
                    reservation.vehicle?.images?.[0]
                  const canCancel =
                    reservation.status !== "cancelled" && reservation.status !== "completed"

                  return (
                    <Card key={reservation._id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div className="flex items-start pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectOne(reservation._id)}
                            />
                          </div>
                          <div className="flex flex-1 gap-6">
                            {primaryImage && (
                              <div className="flex-shrink-0">
                                <img
                                  src={primaryImage.cardUrl || primaryImage.imageUrl}
                                  alt={`${reservation.vehicle?.make} ${reservation.vehicle?.model}`}
                                  className="h-32 w-48 rounded-lg object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 space-y-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(reservation.status)}
                                    <h3 className="font-bold text-lg">
                                      {reservation.vehicle?.year} {reservation.vehicle?.make}{" "}
                                      {reservation.vehicle?.model}
                                    </h3>
                                  </div>
                                  <p className="mt-1 text-muted-foreground">
                                    Reservation ID: {reservation._id}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  {canCancel && (
                                    <Button
                                      onClick={() => handleCancel(reservation._id)}
                                      disabled={isProcessing}
                                      variant="destructive"
                                      size="sm"
                                    >
                                      {isProcessing ? (
                                        <>
                                          <Loader2 className="mr-2 size-4 animate-spin" />
                                          Cancelling...
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="mr-2 size-4" />
                                          Cancel
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  <Link href={`/reservations/${reservation._id}`}>
                                    <Button variant="outline" size="sm">
                                      <Eye className="mr-2 size-4" />
                                      View Details
                                    </Button>
                                  </Link>
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-muted-foreground text-sm">
                                      <strong>Renter:</strong>{" "}
                                      {reservation.renter?.name || "Unknown"}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                      {reservation.renter?.email || "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-sm">
                                      <strong>Owner:</strong> {reservation.owner?.name || "Unknown"}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                      {reservation.owner?.email || "N/A"}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="size-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-muted-foreground text-sm">
                                        <strong>Dates:</strong> {formatDate(reservation.startDate)}{" "}
                                        - {formatDate(reservation.endDate)}
                                      </p>
                                      <p className="text-muted-foreground text-sm">
                                        {reservation.totalDays} day(s)
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-sm">
                                      <strong>Total Amount:</strong>{" "}
                                      <span className="font-semibold text-foreground">
                                        {formatCurrency(reservation.totalAmount)}
                                      </span>
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                      Daily Rate: {formatCurrency(reservation.dailyRate)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {reservation.addOns && reservation.addOns.length > 0 && (
                                <div>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Add-ons:</strong>{" "}
                                    {reservation.addOns
                                      .map(
                                        (addon: any) =>
                                          `${addon.name} (${formatCurrency(addon.price)})`
                                      )
                                      .join(", ")}
                                  </p>
                                </div>
                              )}

                              <div className="flex gap-4 text-muted-foreground text-xs">
                                <span>
                                  <strong>Created:</strong>{" "}
                                  {new Date(reservation.createdAt).toLocaleString()}
                                </span>
                                {reservation.updatedAt && (
                                  <span>
                                    <strong>Updated:</strong>{" "}
                                    {new Date(reservation.updatedAt).toLocaleString()}
                                  </span>
                                )}
                              </div>
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
              <Calendar className="mx-auto mb-4 size-12 opacity-50" />
              <p>No reservations found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
