"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction, useQuery } from "convex/react"
import { format, formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Car,
  Clock,
  CreditCard,
  DollarSign,
  ExternalLink,
  MapPin,
  Percent,
  ReceiptText,
  RefreshCw,
  Star,
  User,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { DetailPageLayout } from "@/components/detail-page-layout"
import { LoadingState } from "@/components/loading-state"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount / 100)

type PaymentData = NonNullable<ReturnType<typeof useQuery<typeof api.stripe.getPaymentById>>>

type VehicleWithImages = NonNullable<PaymentData["vehicle"]> & {
  images?: Array<{ isPrimary: boolean; cardUrl?: string; imageUrl?: string }>
  track?: { name: string; location?: string }
}

function SummaryCards({ payment }: { payment: PaymentData }) {
  const refundedAmount = payment.refundAmount || 0
  const maxRefundable = payment.amount - refundedAmount

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Total Amount</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <DollarSign className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">{formatCurrency(payment.amount)}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            {payment.currency?.toUpperCase() || "USD"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Platform Fee</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Percent className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">
            {formatCurrency(payment.platformFee)}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {payment.amount > 0
              ? `${((payment.platformFee / payment.amount) * 100).toFixed(1)}% of total`
              : "N/A"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Owner Payout</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <ArrowRightLeft className="h-4 w-4 text-purple-700 dark:text-purple-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">
            {formatCurrency(payment.ownerAmount)}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">After platform fee</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Status</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="mt-3">
            <StatusBadge className="text-sm" status={payment.status} />
          </div>
          <p className="mt-2 text-muted-foreground text-xs">
            {refundedAmount > 0
              ? `${formatCurrency(maxRefundable)} refundable`
              : `Created ${formatDistanceToNow(payment.createdAt, { addSuffix: true })}`}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentBreakdownCard({ payment }: { payment: PaymentData }) {
  const refundedAmount = payment.refundAmount || 0
  const netAmount = payment.amount - refundedAmount

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Payment Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gross Amount</span>
            <span className="font-medium">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform Fee</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              -{formatCurrency(payment.platformFee)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Owner Payout</span>
            <span className="font-medium">{formatCurrency(payment.ownerAmount)}</span>
          </div>
          {refundedAmount > 0 && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Refunded</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  -{formatCurrency(refundedAmount)}
                </span>
              </div>
              {payment.refundPercentage !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Refund %</span>
                  <span className="font-medium">{payment.refundPercentage}%</span>
                </div>
              )}
            </>
          )}
          <Separator />
          <div className="flex justify-between">
            <span className="font-semibold">Net Amount</span>
            <span className="font-bold text-lg">{formatCurrency(netAmount)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TransactionDetailsCard({ payment }: { payment: PaymentData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptText className="h-4 w-4" />
          Transaction Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Created
            </p>
            <p className="mt-2 font-semibold">
              {format(new Date(payment.createdAt), "EEEE, MMMM d, yyyy")}
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              {format(new Date(payment.createdAt), "h:mm a")}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Last Updated
            </p>
            <p className="mt-2 font-semibold">
              {format(new Date(payment.updatedAt), "EEEE, MMMM d, yyyy")}
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              {format(new Date(payment.updatedAt), "h:mm a")}
            </p>
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          {payment.stripePaymentIntentId && (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">Payment Intent</span>
              <span className="break-all text-right font-mono text-xs">
                {payment.stripePaymentIntentId}
              </span>
            </div>
          )}
          {payment.stripeChargeId && (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">Charge ID</span>
              <span className="break-all text-right font-mono text-xs">
                {payment.stripeChargeId}
              </span>
            </div>
          )}
          {payment.stripeCheckoutSessionId && (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">Checkout Session</span>
              <span className="break-all text-right font-mono text-xs">
                {payment.stripeCheckoutSessionId}
              </span>
            </div>
          )}
          {payment.stripeTransferId && (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">Transfer ID</span>
              <span className="break-all text-right font-mono text-xs">
                {payment.stripeTransferId}
              </span>
            </div>
          )}
          {payment.stripeAccountId && (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">Connect Account</span>
              <span className="break-all text-right font-mono text-xs">
                {payment.stripeAccountId}
              </span>
            </div>
          )}
          {payment.stripeCustomerId && (
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="shrink-0 text-muted-foreground">Customer ID</span>
              <span className="break-all text-right font-mono text-xs">
                {payment.stripeCustomerId}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RefundInfoCard({ payment }: { payment: PaymentData }) {
  if (!(payment.refundAmount || payment.refundReason)) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" />
          Refund Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payment.refundAmount && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <p className="font-medium text-orange-700 text-sm dark:text-orange-400">
                {payment.status === "refunded" ? "Fully Refunded" : "Partially Refunded"}
              </p>
            </div>
            <p className="mt-2 font-bold text-lg text-orange-700 dark:text-orange-300">
              {formatCurrency(payment.refundAmount)}
            </p>
            {payment.refundPercentage !== undefined && (
              <p className="mt-1 text-orange-600 text-xs dark:text-orange-400">
                {payment.refundPercentage}% of original amount
              </p>
            )}
          </div>
        )}
        {payment.refundPolicy && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Refund Policy</span>
            <StatusBadge status={payment.refundPolicy} />
          </div>
        )}
        {payment.refundReason && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Refund Reason
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{payment.refundReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FailureInfoCard({ payment }: { payment: PaymentData }) {
  if (!payment.failureReason) return null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="mb-1 font-medium text-red-700 text-xs uppercase tracking-wider dark:text-red-400">
            Failure Reason
          </p>
          <p className="whitespace-pre-wrap text-red-700 text-sm leading-relaxed dark:text-red-300">
            {payment.failureReason}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ReservationCard({ payment }: { payment: PaymentData }) {
  const router = useRouter()
  if (!payment.reservation) return null
  const reservation = payment.reservation

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Reservation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <StatusBadge status={reservation.status} />
          <span className="font-mono text-muted-foreground text-xs">
            ...{reservation._id.slice(-8)}
          </span>
        </div>
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dates</span>
            <span className="font-medium">
              {format(new Date(reservation.startDate), "MMM d")} -{" "}
              {format(new Date(reservation.endDate), "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">
              {reservation.totalDays} {reservation.totalDays === 1 ? "day" : "days"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{formatCurrency(reservation.totalAmount)}</span>
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => router.push(`/reservations/${reservation._id}`)}
          size="sm"
          variant="outline"
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          View Reservation
        </Button>
      </CardContent>
    </Card>
  )
}

function VehicleCard({ payment }: { payment: PaymentData }) {
  const router = useRouter()
  if (!payment.vehicle) return null
  const vehicleWithImages = payment.vehicle as VehicleWithImages
  const primaryImage =
    vehicleWithImages.images?.find((img) => img.isPrimary) || vehicleWithImages.images?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Car className="h-4 w-4" />
          Vehicle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {primaryImage && (
          <img
            alt={`${payment.vehicle.make} ${payment.vehicle.model}`}
            className="h-40 w-full rounded-lg object-cover"
            src={primaryImage.cardUrl || primaryImage.imageUrl}
          />
        )}
        <div>
          <p className="font-semibold">
            {payment.vehicle.year} {payment.vehicle.make} {payment.vehicle.model}
          </p>
          {vehicleWithImages.track && (
            <div className="mt-1 flex items-center gap-1 text-muted-foreground text-sm">
              <MapPin className="h-3.5 w-3.5" />
              <span>{vehicleWithImages.track.name}</span>
            </div>
          )}
        </div>
        <Button
          className="w-full"
          onClick={() => router.push(`/vehicles/${payment.vehicle?._id}`)}
          size="sm"
          variant="outline"
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          View Vehicle
        </Button>
      </CardContent>
    </Card>
  )
}

function UserCard({
  user,
  label,
  badgeLabel,
}: {
  user: PaymentData["renter"] | PaymentData["owner"]
  label: string
  badgeLabel: string
}) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <UserAvatar email={user?.email} name={user?.name} />
          <span className="ml-auto rounded border px-1.5 py-0 font-medium text-[10px] text-muted-foreground">
            {badgeLabel}
          </span>
        </div>
        {user?.phone && <p className="text-muted-foreground text-sm">{user.phone}</p>}
        {user?.rating && (
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{user.rating}</span>
            <span className="text-muted-foreground">rating</span>
          </div>
        )}
        {user?._id && (
          <Button
            className="w-full"
            onClick={() => router.push(`/users/${user.externalId}`)}
            size="sm"
            variant="outline"
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            View Profile
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function MetadataCard({ payment }: { payment: PaymentData }) {
  if (!payment.metadata || Object.keys(payment.metadata).length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Booking Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {payment.metadata.vehicleId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle ID</span>
              <span className="font-mono text-xs">{payment.metadata.vehicleId}</span>
            </div>
          )}
          {payment.metadata.startDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">{payment.metadata.startDate}</span>
            </div>
          )}
          {payment.metadata.endDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span className="font-medium">{payment.metadata.endDate}</span>
            </div>
          )}
          {payment.metadata.totalDays && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Days</span>
              <span className="font-medium">{payment.metadata.totalDays}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RefundDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: PaymentData
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const initiateRefund = useAction(api.admin.initiateRefund)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const maxRefundable = payment.amount - (payment.refundAmount || 0)

  const handleRefund = async () => {
    const amountInCents = Math.round(Number.parseFloat(refundAmount) * 100)
    if (Number.isNaN(amountInCents) || amountInCents <= 0) {
      toast.error("Please enter a valid refund amount")
      return
    }

    if (amountInCents > maxRefundable) {
      toast.error(`Refund amount cannot exceed ${formatCurrency(maxRefundable)}`)
      return
    }

    if (!refundReason.trim()) {
      toast.error("Please provide a reason for the refund")
      return
    }

    setIsProcessing(true)
    try {
      await initiateRefund({
        paymentId: payment._id,
        amount: amountInCents,
        reason: refundReason,
      })
      toast.success("Refund processed successfully")
      onOpenChange(false)
      setRefundAmount("")
      setRefundReason("")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "process refund",
        entity: "payment",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFullRefund = () => {
    setRefundAmount((maxRefundable / 100).toFixed(2))
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
          <DialogDescription>
            Issue a full or partial refund for this payment. Maximum refundable:{" "}
            {formatCurrency(maxRefundable)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="refund-amount">Refund Amount (USD)</Label>
              <Button
                className="h-auto px-2 py-0.5 text-xs"
                disabled={isProcessing}
                onClick={handleFullRefund}
                type="button"
                variant="outline"
              >
                Full Refund
              </Button>
            </div>
            <Input
              disabled={isProcessing}
              id="refund-amount"
              max={(maxRefundable / 100).toFixed(2)}
              min="0.01"
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={refundAmount}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason for Refund</Label>
            <Textarea
              disabled={isProcessing}
              id="refund-reason"
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Describe the reason for this refund..."
              rows={3}
              value={refundReason}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isProcessing} onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={isProcessing} onClick={handleRefund} variant="destructive">
            {isProcessing ? "Processing..." : "Process Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PaymentDetailPage() {
  const params = useParams()
  const paymentId = params.id as Id<"payments">
  const payment = useQuery(api.stripe.getPaymentById, { paymentId })

  const [refundDialogOpen, setRefundDialogOpen] = useState(false)

  if (payment === undefined) {
    return <LoadingState message="Loading payment details..." />
  }

  if (payment === null) {
    return (
      <DetailPageLayout title="Payment Not Found">
        <p className="text-muted-foreground">This payment could not be found.</p>
      </DetailPageLayout>
    )
  }

  const canRefund =
    payment.status === "succeeded" && payment.amount - (payment.refundAmount || 0) > 0

  return (
    <DetailPageLayout
      actions={
        canRefund ? (
          <Button onClick={() => setRefundDialogOpen(true)} variant="destructive">
            <RefreshCw className="mr-2 h-4 w-4" />
            Process Refund
          </Button>
        ) : undefined
      }
      badges={
        <div className="flex items-center gap-2">
          <StatusBadge status={payment.status} />
          {payment.refundPolicy && <StatusBadge status={payment.refundPolicy} />}
        </div>
      }
      title={`Payment ${payment._id.slice(-8).toUpperCase()}`}
    >
      <SummaryCards payment={payment} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PaymentBreakdownCard payment={payment} />
          <TransactionDetailsCard payment={payment} />
          <RefundInfoCard payment={payment} />
          <FailureInfoCard payment={payment} />
        </div>

        <div className="space-y-6">
          <ReservationCard payment={payment} />
          <VehicleCard payment={payment} />
          <UserCard badgeLabel="driver" label="Renter" user={payment.renter} />
          <UserCard badgeLabel="host" label="Owner" user={payment.owner} />
          <MetadataCard payment={payment} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all font-mono text-muted-foreground text-xs">{payment._id}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {canRefund && (
        <RefundDialog
          onOpenChange={setRefundDialogOpen}
          open={refundDialogOpen}
          payment={payment}
        />
      )}
    </DetailPageLayout>
  )
}
