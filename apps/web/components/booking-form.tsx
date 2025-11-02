"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useMutation, useAction } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Calendar, Clock, DollarSign, Users } from "lucide-react"
import { api } from "@/lib/convex"

interface BookingFormProps {
  pricePerDay: number
  vehicleId: string
}

export function BookingForm({ pricePerDay, vehicleId }: BookingFormProps) {
  const router = useRouter()
  const { user, isSignedIn } = useUser()
  const createReservation = useMutation(api.reservations.create)
  const createPaymentIntent = useAction(api.stripe.createPaymentIntent)

  const [pickupDate, setPickupDate] = useState("")
  const [pickupTime, setPickupTime] = useState("")
  const [dropoffDate, setDropoffDate] = useState("")
  const [dropoffTime, setDropoffTime] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate time options (every 30 minutes from 6 AM to 10 PM)
  const generateTimeOptions = () => {
    const times: string[] = []
    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time24 = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        times.push(time24)
      }
    }
    return times
  }

  const timeOptions = generateTimeOptions()

  const formatTimeForDisplay = (time24: string) => {
    const [hours, minutes] = time24.split(":")
    const hour = Number.parseInt(hours, 10)
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const ampm = hour < 12 ? "AM" : "PM"
    return `${hour12}:${minutes} ${ampm}`
  }

  // Calculate minimum dates
  const today = new Date().toISOString().split("T")[0]
  const minPickupDate = today
  const minDropoffDate = pickupDate || today

  // Calculate total days and price
  const calculateTotal = () => {
    if (!pickupDate || !dropoffDate) return { days: 0, total: 0 }

    const start = new Date(pickupDate)
    const end = new Date(dropoffDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0) return { days: 0, total: 0 }

    const total = days * pricePerDay
    return { days, total }
  }

  const { days, total } = calculateTotal()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!isSignedIn) {
      setError("Please sign in to make a reservation")
      setIsSubmitting(false)
      router.push("/sign-in")
      return
    }

    try {
      // Create reservation with vehicleId (should already be a Convex Id)
      const reservationId = await createReservation({
        vehicleId: vehicleId as any,
        startDate: pickupDate,
        endDate: dropoffDate,
        pickupTime,
        dropoffTime,
      })

      // Convert total to cents for Stripe (amount in cents)
      const amountInCents = Math.round(total * 100)

      // Create payment intent
      const { clientSecret } = await createPaymentIntent({
        reservationId,
        amount: amountInCents,
      })

      // Redirect to checkout page with reservation and payment info
      router.push(`/checkout?reservationId=${reservationId}&clientSecret=${clientSecret}`)
    } catch (err) {
      console.error("Error creating reservation:", err)
      setError(err instanceof Error ? err.message : "Failed to create reservation. Please try again.")
      setIsSubmitting(false)
    }
  }

  const isValid = pickupDate && dropoffDate && pickupTime && dropoffTime && days > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-3xl">${pricePerDay}</span>
        <span className="text-muted-foreground text-sm">/day</span>
      </div>

      <Separator />

      {/* Pickup Date and Time */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="pickup-date" className="mb-2 flex items-center gap-2">
            <Calendar className="size-4" />
            Pickup Date
          </Label>
          <Input
            id="pickup-date"
            type="date"
            value={pickupDate}
            min={minPickupDate}
            onChange={(e) => {
              setPickupDate(e.target.value)
              // Reset dropoff date if it's before new pickup date
              if (dropoffDate && e.target.value && dropoffDate < e.target.value) {
                setDropoffDate("")
              }
            }}
            required
          />
        </div>
        <div>
          <Label htmlFor="pickup-time" className="mb-2 flex items-center gap-2">
            <Clock className="size-4" />
            Pickup Time
          </Label>
          <Select value={pickupTime} onValueChange={setPickupTime} required>
            <SelectTrigger id="pickup-time">
              <SelectValue placeholder="Select pickup time" />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {formatTimeForDisplay(time)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Dropoff Date and Time */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="dropoff-date" className="mb-2 flex items-center gap-2">
            <Calendar className="size-4" />
            Dropoff Date
          </Label>
          <Input
            id="dropoff-date"
            type="date"
            value={dropoffDate}
            min={minDropoffDate}
            onChange={(e) => setDropoffDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="dropoff-time" className="mb-2 flex items-center gap-2">
            <Clock className="size-4" />
            Dropoff Time
          </Label>
          <Select value={dropoffTime} onValueChange={setDropoffTime} required>
            <SelectTrigger id="dropoff-time">
              <SelectValue placeholder="Select dropoff time" />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {formatTimeForDisplay(time)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price Summary */}
      {days > 0 && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                ${pricePerDay} × {days} {days === 1 ? "day" : "days"}
              </span>
              <span className="font-medium">${total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <Separator />

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button className="w-full" size="lg" type="submit" disabled={!isValid || isSubmitting}>
        {isSubmitting ? "Processing..." : "Reserve Now"}
      </Button>

      <p className="text-center text-muted-foreground text-xs">You won't be charged yet</p>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Free cancellation</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Pay at pickup</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Instant booking</span>
        </div>
      </div>
    </form>
  )
}

