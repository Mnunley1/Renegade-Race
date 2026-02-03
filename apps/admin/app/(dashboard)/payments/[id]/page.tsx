"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  Car,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react"
import type { Id } from "@/lib/convex"
import { useState } from "react"
import { toast } from "sonner"

export default function PaymentDetailPage() {
  const params = useParams()
  const paymentId = params.id as Id<"payments">
  const payment = useQuery(api.stripe.getPaymentById, { paymentId })
  const initiateRefund = useAction(api.admin.initiateRefund)

  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-600">
            <Clock className="mr-1 size-3" />
            Pending
          </Badge>
        )
      case "succeeded":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="mr-1 size-3" />
            Succeeded
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 size-3" />
            Failed
          </Badge>
        )
      case "refunded":
        return (
          <Badge variant="secondary">
            <RefreshCw className="mr-1 size-3" />
            Refunded
          </Badge>
        )
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

  const handleRefund = async () => {
    if (!payment) return

    const amountInCents = Math.round(Number.parseFloat(refundAmount) * 100)
    if (isNaN(amountInCents) || amountInCents <= 0) {
      toast.error("Please enter a valid refund amount")
      return
    }

    const maxRefundable = payment.amount - (payment.refundAmount || 0)
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
        paymentId,
        amount: amountInCents,
        reason: refundReason,
      })
      toast.success("Refund processed successfully")
      setRefundDialogOpen(false)
      setRefundAmount("")
      setRefundReason("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process refund")
    } finally {
      setIsProcessing(false)
    }
  }

  const canRefund =
    payment && payment.status === "succeeded" && payment.amount - (payment.refundAmount || 0) > 0

  if (payment === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading payment...</div>
      </div>
    )
  }

  if (payment === null) {
    return (
      <div className="space-y-6">
        <Link href="/payments">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Payments
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Payment not found
          </CardContent>
        </Card>
      </div>
    )
  }

  const primaryImage =
    (payment.vehicle as any)?.images?.find((img: any) => img.isPrimary) ||
    (payment.vehicle as any)?.images?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/payments">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 size-4" />
              Back to Payments
            </Button>
          </Link>
          <h1 className="font-bold text-3xl">Payment Details</h1>
          <p className="mt-2 text-muted-foreground">Payment ID: {payment._id}</p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(payment.status)}
          {canRefund && (
            <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <RefreshCw className="mr-2 size-4" />
                  Process Refund
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Process Refund</DialogTitle>
                  <DialogDescription>
                    Issue a full or partial refund for this payment. Maximum refundable:{" "}
                    {formatCurrency(payment.amount - (payment.refundAmount || 0))}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="refund-amount">Refund Amount (USD)</Label>
                    <Input
                      id="refund-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(payment.amount - (payment.refundAmount || 0)) / 100}
                      placeholder="0.00"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refund-reason">Reason for Refund</Label>
                    <Textarea
                      id="refund-reason"
                      placeholder="Enter reason for refund..."
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      disabled={isProcessing}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setRefundDialogOpen(false)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleRefund} disabled={isProcessing}>
                    {isProcessing ? "Processing..." : "Process Refund"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="size-5" />
              <CardTitle>Payment Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground text-sm">Amount</p>
              <p className="font-semibold text-2xl">{formatCurrency(payment.amount || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Status</p>
              <div className="mt-1">{getStatusBadge(payment.status)}</div>
            </div>
            {payment.stripePaymentIntentId && (
              <div>
                <p className="text-muted-foreground text-sm">Stripe Payment Intent ID</p>
                <p className="break-all font-mono text-sm">{payment.stripePaymentIntentId}</p>
              </div>
            )}
            {payment.stripeCheckoutSessionId && (
              <div>
                <p className="text-muted-foreground text-sm">Stripe Checkout Session ID</p>
                <p className="break-all font-mono text-sm">{payment.stripeCheckoutSessionId}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-sm">Created</p>
              <p className="font-medium">{new Date(payment.createdAt).toLocaleString()}</p>
            </div>
            {payment.updatedAt && (
              <div>
                <p className="text-muted-foreground text-sm">Last Updated</p>
                <p className="font-medium">{new Date(payment.updatedAt).toLocaleString()}</p>
              </div>
            )}
            {(payment as any).refundedAt && (
              <div>
                <p className="text-muted-foreground text-sm">Refunded At</p>
                <p className="font-medium">
                  {new Date((payment as any).refundedAt).toLocaleString()}
                </p>
              </div>
            )}
            {payment.refundAmount && (
              <div>
                <p className="text-muted-foreground text-sm">Refund Amount</p>
                <p className="font-semibold text-lg text-orange-600">
                  {formatCurrency(payment.refundAmount)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reservation Information */}
        {payment.reservation && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="size-5" />
                <CardTitle>Reservation Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground text-sm">Reservation ID</p>
                <Link href={`/reservations/${payment.reservation._id}`}>
                  <Button variant="link" className="h-auto p-0 font-mono text-sm">
                    {payment.reservation._id}
                  </Button>
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Status</p>
                <Badge variant="outline">{payment.reservation.status}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Dates</p>
                <p className="font-medium">
                  {new Date(payment.reservation.startDate).toLocaleDateString()} -{" "}
                  {new Date(payment.reservation.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Days</p>
                <p className="font-medium">{payment.reservation.totalDays} days</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Amount</p>
                <p className="font-semibold text-lg">
                  {formatCurrency(payment.reservation.totalAmount)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Renter Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-5" />
              <CardTitle>Renter Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">{payment.renter?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">{payment.renter?.email || "N/A"}</p>
              {payment.renter?.phone && (
                <p className="text-muted-foreground text-sm">Phone: {payment.renter.phone}</p>
              )}
            </div>
            {payment.renter?.rating && (
              <div>
                <p className="text-muted-foreground text-sm">Rating</p>
                <p className="font-medium">{payment.renter.rating}/5</p>
              </div>
            )}
            {payment.renter?._id && (
              <Link href={`/users/${payment.renter._id}`}>
                <Button variant="outline" size="sm">
                  View User Profile
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Owner Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-5" />
              <CardTitle>Owner Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">{payment.owner?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">{payment.owner?.email || "N/A"}</p>
              {payment.owner?.phone && (
                <p className="text-muted-foreground text-sm">Phone: {payment.owner.phone}</p>
              )}
            </div>
            {payment.owner?.rating && (
              <div>
                <p className="text-muted-foreground text-sm">Rating</p>
                <p className="font-medium">{payment.owner.rating}/5</p>
              </div>
            )}
            {payment.owner?._id && (
              <Link href={`/users/${payment.owner._id}`}>
                <Button variant="outline" size="sm">
                  View User Profile
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Information */}
      {payment.vehicle && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Car className="size-5" />
              <CardTitle>Vehicle Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {primaryImage && (
                <div className="flex-shrink-0">
                  <img
                    src={primaryImage.cardUrl || primaryImage.imageUrl}
                    alt={`${payment.vehicle.make} ${payment.vehicle.model}`}
                    className="h-32 w-48 rounded-lg object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {payment.vehicle.year} {payment.vehicle.make} {payment.vehicle.model}
                </h3>
                {(payment.vehicle as any).track && (
                  <p className="text-muted-foreground text-sm">
                    Track: {(payment.vehicle as any).track.name}
                  </p>
                )}
                <div className="mt-2">
                  <Link href={`/vehicles/${payment.vehicle._id}`}>
                    <Button variant="outline" size="sm">
                      View Vehicle Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {payment.metadata && Object.keys(payment.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify(payment.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
