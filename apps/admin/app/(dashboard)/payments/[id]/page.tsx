"use client"

import { useQuery } from "convex/react"
import { useParams } from "next/navigation"
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
import { Badge } from "@workspace/ui/components/badge"
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

export default function PaymentDetailPage() {
  const params = useParams()
  const paymentId = params.id as Id<"payments">
  const payment = useQuery(api.stripe.getPaymentById, { paymentId })

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100)
  }

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
    payment.vehicle?.images?.find((img: any) => img.isPrimary) ||
    payment.vehicle?.images?.[0]

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
          <p className="text-muted-foreground mt-2">Payment ID: {payment._id}</p>
        </div>
        {getStatusBadge(payment.status)}
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
              <p className="font-semibold text-2xl">
                {formatCurrency(payment.amount || 0)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Status</p>
              <div className="mt-1">{getStatusBadge(payment.status)}</div>
            </div>
            {payment.stripePaymentIntentId && (
              <div>
                <p className="text-muted-foreground text-sm">Stripe Payment Intent ID</p>
                <p className="font-mono text-sm break-all">{payment.stripePaymentIntentId}</p>
              </div>
            )}
            {payment.stripeCheckoutSessionId && (
              <div>
                <p className="text-muted-foreground text-sm">Stripe Checkout Session ID</p>
                <p className="font-mono text-sm break-all">
                  {payment.stripeCheckoutSessionId}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-sm">Created</p>
              <p className="font-medium">
                {new Date(payment.createdAt).toLocaleString()}
              </p>
            </div>
            {payment.updatedAt && (
              <div>
                <p className="text-muted-foreground text-sm">Last Updated</p>
                <p className="font-medium">
                  {new Date(payment.updatedAt).toLocaleString()}
                </p>
              </div>
            )}
            {payment.refundedAt && (
              <div>
                <p className="text-muted-foreground text-sm">Refunded At</p>
                <p className="font-medium">
                  {new Date(payment.refundedAt).toLocaleString()}
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
              <p className="text-muted-foreground text-sm">
                {payment.renter?.email || "N/A"}
              </p>
              {payment.renter?.phone && (
                <p className="text-muted-foreground text-sm">
                  Phone: {payment.renter.phone}
                </p>
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
              <p className="text-muted-foreground text-sm">
                {payment.owner?.email || "N/A"}
              </p>
              {payment.owner?.phone && (
                <p className="text-muted-foreground text-sm">
                  Phone: {payment.owner.phone}
                </p>
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
                {payment.vehicle.track && (
                  <p className="text-muted-foreground text-sm">
                    Track: {payment.vehicle.track.name}
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
            <pre className="rounded-lg bg-muted p-4 text-xs overflow-auto">
              {JSON.stringify(payment.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
