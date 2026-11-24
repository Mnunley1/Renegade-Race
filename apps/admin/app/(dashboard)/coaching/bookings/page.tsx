"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction, useMutation, useQuery } from "convex/react"
import { CheckCircle, Loader2, RotateCcw, XCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar, type FilterConfig } from "@/components/data-table/data-table-toolbar"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatBookingDate } from "@/lib/booking-date"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

type DialogType = "refund" | "resolve" | "dismiss"

function formatAmount(cents?: number) {
  if (cents === undefined || cents === null) return "N/A"
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function CoachingBookingsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [disputedOnly, setDisputedOnly] = useState(false)

  const bookings = useQuery(api.coachingBookings.getCoachingBookingsForAdmin, {
    status: statusFilter as
      | "pending"
      | "confirmed"
      | "completed"
      | "cancelled"
      | "declined"
      | undefined,
    disputeStatus: disputedOnly ? "open" : undefined,
    limit: 100,
  })

  const resolveDispute = useMutation(api.coachingBookings.resolveCoachingDispute)
  const refundBooking = useAction(api.coachingPayments.adminRefundCoachingBooking)

  const [dialogType, setDialogType] = useState<DialogType | null>(null)
  const [activeBooking, setActiveBooking] = useState<any | null>(null)
  const [reason, setReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const openDialog = (type: DialogType, booking: any) => {
    setDialogType(type)
    setActiveBooking(booking)
    setReason("")
  }

  const closeDialog = () => {
    setDialogType(null)
    setActiveBooking(null)
  }

  const handleConfirm = async () => {
    if (!(dialogType && activeBooking)) return

    if (dialogType === "refund" && !reason.trim()) {
      toast.error("Please provide a refund reason")
      return
    }

    setIsProcessing(true)
    try {
      if (dialogType === "refund") {
        await refundBooking({ bookingId: activeBooking._id, reason: reason.trim() })
        toast.success("Booking refunded successfully")
      } else if (dialogType === "resolve") {
        await resolveDispute({
          bookingId: activeBooking._id,
          resolution: "resolved",
          notes: reason.trim() || undefined,
        })
        toast.success("Dispute marked as resolved")
      } else {
        await resolveDispute({
          bookingId: activeBooking._id,
          resolution: "dismissed",
          notes: reason.trim() || undefined,
        })
        toast.success("Dispute dismissed")
      }
      closeDialog()
    } catch (error) {
      handleErrorWithContext(error, { action: dialogType, entity: "coaching booking" })
    } finally {
      setIsProcessing(false)
    }
  }

  const columns: Column<any>[] = [
    {
      key: "coach",
      header: "Coach",
      cell: (row) => row.coach?.name || "Unknown",
    },
    {
      key: "renter",
      header: "Renter",
      cell: (row) => row.renter?.name || "Unknown",
    },
    {
      key: "dates",
      header: "Dates",
      cell: (row) => (
        <span>
          {formatBookingDate(row.startDate)}
          {row.endDate ? ` - ${formatBookingDate(row.endDate)}` : ""}
        </span>
      ),
      sortable: true,
      sortValue: (row) => new Date(row.startDate).getTime(),
    },
    {
      key: "sessionType",
      header: "Session",
      cell: (row) => <span className="capitalize">{row.sessionType?.replace(/_/g, " ")}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => formatAmount(row.totalAmount),
      sortable: true,
      sortValue: (row) => row.totalAmount ?? 0,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      cell: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    {
      key: "disputeStatus",
      header: "Dispute",
      cell: (row) =>
        row.disputeStatus ? <StatusBadge status={row.disputeStatus} /> : <span>-</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        if (row.disputeStatus !== "open") return null
        return (
          <div className="flex flex-col items-end gap-2">
            {row.issueReason && (
              <span
                className="inline-block max-w-[220px] truncate text-muted-foreground text-xs"
                title={row.issueReason}
              >
                {row.issueReason}
              </span>
            )}
            <div className="flex gap-1">
              <Button
                disabled={row.paymentStatus !== "paid"}
                onClick={() => openDialog("refund", row)}
                size="sm"
                title={
                  row.paymentStatus === "paid" ? "Refund" : "Only paid bookings can be refunded"
                }
                variant="outline"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                onClick={() => openDialog("resolve", row)}
                size="sm"
                title="Mark resolved"
                variant="outline"
              >
                <CheckCircle className="size-4" />
              </Button>
              <Button
                onClick={() => openDialog("dismiss", row)}
                size="sm"
                title="Dismiss"
                variant="destructive"
              >
                <XCircle className="size-4" />
              </Button>
            </div>
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
        { label: "Confirmed", value: "confirmed" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      value: statusFilter,
      onChange: (value) => setStatusFilter(value),
    },
    {
      key: "disputed",
      label: "Disputed only",
      options: [{ label: "Disputed only", value: "open" }],
      value: disputedOnly ? "open" : undefined,
      onChange: (value) => setDisputedOnly(value === "open"),
    },
  ]

  const dialogTitle =
    dialogType === "refund"
      ? "Refund Booking"
      : dialogType === "resolve"
        ? "Mark Dispute Resolved"
        : "Dismiss Dispute"

  return (
    <div className="space-y-6">
      <PageHeader description="Manage coaching bookings and disputes" title="Coaching Bookings" />

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>{bookings?.length || 0} booking(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={bookings ?? []}
            emptyMessage="No bookings found"
            getRowId={(row) => row._id}
            isLoading={bookings === undefined}
            toolbar={
              <DataTableToolbar
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    bookings ?? [],
                    [
                      { key: "coach", header: "Coach", value: (r) => r.coach?.name ?? "Unknown" },
                      {
                        key: "renter",
                        header: "Renter",
                        value: (r) => r.renter?.name ?? "Unknown",
                      },
                      {
                        key: "start",
                        header: "Start",
                        value: (r) => formatBookingDate(r.startDate),
                      },
                      { key: "sessionType", header: "Session", value: (r) => r.sessionType ?? "" },
                      {
                        key: "amount",
                        header: "Amount",
                        value: (r) => formatAmount(r.totalAmount),
                      },
                      { key: "status", header: "Status", value: (r) => r.status },
                      {
                        key: "payment",
                        header: "Payment",
                        value: (r) => r.paymentStatus ?? "Unknown",
                      },
                      { key: "dispute", header: "Dispute", value: (r) => r.disputeStatus ?? "" },
                    ],
                    "coaching-bookings"
                  )
                }
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog onOpenChange={(open) => !open && closeDialog()} open={dialogType !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === "refund"
                ? "Refund this paid coaching booking. A reason is required."
                : dialogType === "resolve"
                  ? "Mark the dispute on this booking as resolved."
                  : "Dismiss the dispute on this booking."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reason">
              {dialogType === "refund" ? "Reason" : "Notes (optional)"}
            </Label>
            <Textarea
              id="reason"
              onChange={(e) => setReason(e.target.value)}
              placeholder={dialogType === "refund" ? "Reason for refund..." : "Add notes..."}
              rows={4}
              value={reason}
            />
          </div>
          <DialogFooter>
            <Button onClick={closeDialog} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={isProcessing || (dialogType === "refund" && !reason.trim())}
              onClick={handleConfirm}
              variant={dialogType === "dismiss" ? "destructive" : "default"}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
