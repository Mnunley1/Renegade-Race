"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useQuery, useAction } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { api } from "@/lib/convex"
import Image from "next/image"
import Link from "next/link"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

function CheckoutForm({ reservationId, totalAmount }: { reservationId: string; totalAmount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || "Payment failed")
        setIsProcessing(false)
        return
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success?reservationId=${reservationId}`,
        },
        redirect: "if_required",
      })

      if (confirmError) {
        setError(confirmError.message || "Payment failed")
        setIsProcessing(false)
      } else {
        // Payment succeeded - redirect to success page
        router.push(`/checkout/success?reservationId=${reservationId}`)
      }
    } catch (err) {
      console.error("Payment error:", err)
      setError(err instanceof Error ? err.message : "Payment failed")
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="mb-4 font-semibold text-lg">Payment Details</h3>
        <PaymentElement />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">${(totalAmount / 100).toLocaleString()}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">Total</span>
          <span className="font-bold text-2xl">${(totalAmount / 100).toLocaleString()}</span>
        </div>
      </div>

      <Button className="w-full" size="lg" type="submit" disabled={!stripe || isProcessing}>
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay $${(totalAmount / 100).toLocaleString()}`
        )}
      </Button>
    </form>
  )
}

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reservationId = searchParams.get("reservationId")
  const clientSecret = searchParams.get("clientSecret")

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reservationId || !clientSecret) {
      setError("Missing reservation or payment information")
    }
  }, [reservationId, clientSecret])

  if (!reservationId || !clientSecret) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="mx-auto mb-4 size-12 text-destructive" />
            <h2 className="mb-2 font-bold text-2xl">Invalid Checkout Session</h2>
            <p className="mb-6 text-muted-foreground">
              {error || "Missing reservation or payment information"}
            </p>
            <Button asChild>
              <Link href="/vehicles">Browse Vehicles</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const reservation = useQuery(api.reservations.getById, { id: reservationId as any })

  if (!reservation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const vehicle = reservation.vehicle
  const primaryImage = vehicle?.images?.find((img) => img.isPrimary)?.cardUrl || vehicle?.images?.[0]?.cardUrl || ""

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
    },
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" className="mb-6" asChild>
        <Link href={`/vehicles/${vehicle?._id}`}>
          <ArrowLeft className="mr-2 size-4" />
          Back to vehicle
        </Link>
      </Button>

      <h1 className="mb-8 font-bold text-4xl">Complete Your Reservation</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Reservation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vehicle && (
                <div className="flex gap-4">
                  {primaryImage && (
                    <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="object-cover"
                        fill
                        sizes="160px"
                        src={primaryImage}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {new Date(reservation.startDate).toLocaleDateString()} -{" "}
                      {new Date(reservation.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {reservation.totalDays} {reservation.totalDays === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Elements options={options} stripe={stripePromise}>
                <CheckoutForm
                  reservationId={reservationId}
                  totalAmount={reservation.totalAmount || 0}
                />
              </Elements>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily Rate</span>
                  <span>${(reservation.dailyRate || 0).toLocaleString()}/day</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span>
                    {reservation.totalDays} {reservation.totalDays === 1 ? "day" : "days"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">
                    ${((reservation.totalAmount || 0) / 100).toLocaleString()}
                  </span>
                </div>
              </div>

              {reservation.pickupTime && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <h4 className="mb-2 font-semibold text-sm">Pickup Details</h4>
                  <p className="text-muted-foreground text-sm">
                    {new Date(reservation.startDate).toLocaleDateString()} at {reservation.pickupTime}
                  </p>
                </div>
              )}

              {reservation.dropoffTime && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <h4 className="mb-2 font-semibold text-sm">Dropoff Details</h4>
                  <p className="text-muted-foreground text-sm">
                    {new Date(reservation.endDate).toLocaleDateString()} at {reservation.dropoffTime}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

