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
import { format } from "date-fns"
import { Eye, Loader2, XCircle } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { DataTableBulkActions } from "@/components/data-table/data-table-bulk-actions"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar, type FilterConfig } from "@/components/data-table/data-table-toolbar"
import { DateRangeFilter } from "@/components/date-range-filter"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { StatusBadge } from "@/components/status-badge"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

type ReservationStatus =
  | "pending"
  | "approved"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "declined"

export default function ReservationsPage() {
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
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

  useMemo(() => {
    if (statusFilter !== undefined || searchQuery || dateRange) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [statusFilter, searchQuery, dateRange])

  const handleCancel = async (reservationId: Id<"reservations">) => {
    if (!confirm("Are you sure you want to cancel this reservation? This action cannot be undone."))
      return

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

  const handleBulkCancel = async () => {
    if (!confirm(`Are you sure you want to cancel ${selectedIds.size} reservation(s)?`)) return
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          cancelReservation({ reservationId: id as Id<"reservations"> })
        )
      )
      toast.success(`${selectedIds.size} reservation(s) cancelled`)
      setSelectedIds(new Set())
    } catch (error) {
      handleErrorWithContext(error, { action: "cancel reservations" })
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setCursor(undefined)
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

  const columns: Column<any>[] = [
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <span className="font-medium">
          {row.vehicle?.year} {row.vehicle?.make} {row.vehicle?.model}
        </span>
      ),
      sortable: true,
      sortValue: (row) =>
        `${row.vehicle?.year ?? ""} ${row.vehicle?.make ?? ""} ${row.vehicle?.model ?? ""}`,
    },
    {
      key: "renter",
      header: "Renter",
      cell: (row) => row.renter?.name || "Unknown",
      sortable: true,
      sortValue: (row) => row.renter?.name ?? "",
    },
    {
      key: "owner",
      header: "Owner",
      cell: (row) => row.owner?.name || "Unknown",
      sortable: true,
      sortValue: (row) => row.owner?.name ?? "",
    },
    {
      key: "dates",
      header: "Dates",
      cell: (row) => (
        <span className="whitespace-nowrap text-sm">
          {formatDate(row.startDate)} – {formatDate(row.endDate)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => new Date(row.startDate).getTime(),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => <span className="font-semibold">{formatCurrency(row.totalAmount)}</span>,
      sortable: true,
      sortValue: (row) => row.totalAmount || 0,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        const isProcessing = processingId === row._id
        const canCancel = row.status !== "cancelled" && row.status !== "completed"
        return (
          <div className="flex gap-2">
            {canCancel && (
              <Button
                disabled={isProcessing}
                onClick={() => handleCancel(row._id)}
                size="sm"
                variant="destructive"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 size-4" />
                )}
                {isProcessing ? "Cancelling..." : "Cancel"}
              </Button>
            )}
            <Link href={`/reservations/${row._id}`}>
              <Button size="sm" variant="outline">
                <Eye className="mr-2 size-4" />
                View
              </Button>
            </Link>
          </div>
        )
      },
    },
  ]

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Declined", value: "declined" },
      ],
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as ReservationStatus | undefined),
    },
  ]

  const totalPages = Math.ceil((reservations.length || 0) / 50) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        description="View and manage all platform reservations"
        title="Reservations Management"
      />

      <Card>
        <CardHeader>
          <CardTitle>All Reservations</CardTitle>
          <CardDescription>
            {reservations.length} reservation(s) found
            {hasMore && " (showing first page)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            bulkActions={
              <DataTableBulkActions
                actions={[
                  {
                    label: "Cancel Selected",
                    icon: XCircle,
                    variant: "destructive",
                    onClick: handleBulkCancel,
                  },
                ]}
              />
            }
            columns={columns}
            data={reservations}
            emptyMessage="No reservations found"
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
                actions={<DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />}
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    reservations,
                    [
                      { key: "status", header: "Status", value: (r) => r.status },
                      {
                        key: "vehicle",
                        header: "Vehicle",
                        value: (r) =>
                          `${r.vehicle?.year ?? ""} ${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""}`.trim(),
                      },
                      {
                        key: "renter",
                        header: "Renter",
                        value: (r) => r.renter?.name ?? "Unknown",
                      },
                      {
                        key: "owner",
                        header: "Owner",
                        value: (r) => r.owner?.name ?? "Unknown",
                      },
                      { key: "startDate", header: "Start Date", value: (r) => r.startDate },
                      { key: "endDate", header: "End Date", value: (r) => r.endDate },
                      {
                        key: "amount",
                        header: "Amount",
                        value: (r) => ((r.totalAmount || 0) / 100).toFixed(2),
                      },
                    ],
                    "reservations"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search reservations..."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
