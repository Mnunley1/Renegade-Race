"use client"

import { useUser } from "@clerk/nextjs"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { useAction, useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  Loader2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { api } from "@/lib/convex"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

interface AddOn {
  name: string
  price: number
  description?: string
  isRequired?: boolean
}

function PaymentForm({
  reservationId,
  totalAmount,
}: {
  reservationId: string
  totalAmount: number
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!(stripe && elements)) {
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
      setError(err instanceof Error ? err.message : "Payment failed")
      setIsProcessing(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="mb-4 font-semibold text-lg">Payment Details</h3>
        <PaymentElement />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
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

      <Button className="w-full" disabled={!stripe || isProcessing} size="lg" type="submit">
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
  const { isSignedIn, user } = useUser()
  const vehicleId = searchParams.get("vehicleId")
  const reservationId = searchParams.get("reservationId")
  const clientSecret = searchParams.get("clientSecret")

  const vehicle = useQuery(api.vehicles.getById, vehicleId ? { id: vehicleId as any } : "skip")
  const reservation = useQuery(
    api.reservations.getById,
    reservationId ? { id: reservationId as any } : "skip"
  )

  // Fetch blocked dates from availability
  const availability = useQuery(
    api.availability.getByVehicle,
    vehicleId ? { vehicleId: vehicleId as any } : "skip"
  )

  const createReservation = useMutation(api.reservations.create)
  const createPaymentIntent = useAction(api.stripe.createPaymentIntent)

  const [pickupDate, setPickupDate] = useState<Date | undefined>(undefined)
  const [pickupTime, setPickupTime] = useState("")
  const [dropoffDate, setDropoffDate] = useState<Date | undefined>(undefined)
  const [dropoffTime, setDropoffTime] = useState("")
  const [openPickupDate, setOpenPickupDate] = useState(false)
  const [openDropoffDate, setOpenDropoffDate] = useState(false)
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>(() => {
    // Auto-select required add-ons if vehicle is loaded
    return vehicle?.addOns?.filter((addOn) => addOn.isRequired) || []
  })
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update selected add-ons when vehicle loads
  useEffect(() => {
    if (vehicle?.addOns) {
      const requiredAddOns = vehicle.addOns.filter((addOn) => addOn.isRequired)
      if (requiredAddOns.length > 0) {
        setSelectedAddOns(requiredAddOns)
      }
    }
  }, [vehicle?.addOns])

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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minPickupDate = today
  const minDropoffDate = pickupDate || today

  // Get blocked dates from availability (where isAvailable is false)
  const blockedDates =
    availability
      ?.filter((item) => !item.isAvailable)
      .map((item) => {
        const date = new Date(item.date)
        date.setHours(0, 0, 0, 0)
        return date
      }) || []

  // Combine blocked dates (availability already accounts for reservations)
  const unavailableDates = new Set(blockedDates.map((d) => d.toISOString().split("T")[0]))

  // Function to check if a date is unavailable
  const isDateUnavailable = (date: Date): boolean => {
    const dateStr = date.toISOString().split("T")[0]
    return unavailableDates.has(dateStr)
  }

  // Function to check if a date range contains any unavailable dates
  const isDateRangeUnavailable = (startDate: Date, endDate: Date): boolean => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    // Check each date in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (isDateUnavailable(d)) {
        return true
      }
    }
    return false
  }

  // Toggle add-on selection
  const toggleAddOn = (addOn: AddOn) => {
    if (addOn.isRequired) return // Can't deselect required add-ons

    setSelectedAddOns((prev) => {
      const isSelected = prev.some((selected) => selected.name === addOn.name)
      if (isSelected) {
        return prev.filter((selected) => selected.name !== addOn.name)
      }
      return [...prev, addOn]
    })
  }

  // Calculate total days and price
  const calculateTotal = () => {
    if (!(pickupDate && dropoffDate && vehicle)) {
      return { days: 0, total: 0, addOnsTotal: 0 }
    }

    const start = new Date(pickupDate)
    const end = new Date(dropoffDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0) return { days: 0, total: 0, addOnsTotal: 0 }

    const baseTotal = days * vehicle.dailyRate
    const addOnsTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0)
    const total = baseTotal + addOnsTotal

    return { days, total, addOnsTotal }
  }

  const { days, total } = calculateTotal()

  const handleProceedToPayment = async () => {
    if (!(isSignedIn && user?.id)) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`)
      return
    }

    if (!(pickupDate && dropoffDate && pickupTime && dropoffTime && vehicle)) {
      setError("Please fill in all required fields")
      return
    }

    // Validate that the selected date range doesn't contain blocked dates
    if (isDateRangeUnavailable(pickupDate, dropoffDate)) {
      setError("The selected dates include unavailable dates. Please select different dates.")
      setIsCreatingReservation(false)
      return
    }

    setIsCreatingReservation(true)
    setError(null)

    try {
      // Prepare selected add-ons data (without isRequired field)
      const reservationAddOns =
        selectedAddOns.length > 0
          ? selectedAddOns.map((addOn) => ({
              name: addOn.name,
              price: addOn.price,
              description: addOn.description,
            }))
          : undefined

      // Convert Date objects to ISO date strings (YYYY-MM-DD)
      const startDateString = pickupDate.toISOString().split("T")[0]
      const endDateString = dropoffDate.toISOString().split("T")[0]

      // Create reservation
      const newReservationId = await createReservation({
        vehicleId: vehicle._id,
        startDate: startDateString,
        endDate: endDateString,
        pickupTime,
        dropoffTime,
        addOns: reservationAddOns,
      })

      // Convert total to cents for Stripe (amount in cents)
      const amountInCents = Math.round(total * 100)

      // Create payment intent
      const { clientSecret: newClientSecret } = await createPaymentIntent({
        reservationId: newReservationId,
        amount: amountInCents,
      })

      // Redirect to payment step
      router.push(
        `/checkout?vehicleId=${vehicle._id}&reservationId=${newReservationId}&clientSecret=${newClientSecret}`
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create reservation. Please try again."
      )
      setIsCreatingReservation(false)
    }
  }

  // If we have reservation and clientSecret, show payment form
  if (reservation && clientSecret) {
    const vehicle = reservation.vehicle
    const primaryImage =
      vehicle?.images?.find((img) => img.isPrimary)?.cardUrl ||
      vehicle?.images?.find((img) => img.isPrimary)?.imageUrl ||
      vehicle?.images?.[0]?.cardUrl ||
      vehicle?.images?.[0]?.imageUrl ||
      ""

    const options: StripeElementsOptions = {
      clientSecret,
      appearance: {
        theme: "stripe",
      },
    }

    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Button className="mb-6" onClick={() => router.back()} variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>

        <h1 className="mb-8 font-bold text-4xl">Complete Your Reservation</h1>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
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
                  <PaymentForm
                    reservationId={reservationId!}
                    totalAmount={reservation.totalAmount || 0}
                  />
                </Elements>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
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
                  {reservation.addOns && reservation.addOns.length > 0 && (
                    <>
                      {reservation.addOns.map((addOn) => (
                        <div className="flex justify-between text-sm" key={addOn.name}>
                          <span className="text-muted-foreground">{addOn.name}</span>
                          <span>+${addOn.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </>
                  )}
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
                      {new Date(reservation.startDate).toLocaleDateString()} at{" "}
                      {formatTimeForDisplay(reservation.pickupTime)}
                    </p>
                  </div>
                )}

                {reservation.dropoffTime && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h4 className="mb-2 font-semibold text-sm">Dropoff Details</h4>
                    <p className="text-muted-foreground text-sm">
                      {new Date(reservation.endDate).toLocaleDateString()} at{" "}
                      {formatTimeForDisplay(reservation.dropoffTime)}
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

  // Show loading state
  if (!vehicle && vehicleId) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <p className="font-medium text-lg text-muted-foreground">Loading vehicle...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if no vehicle
  if (!(vehicle || vehicleId)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="mb-2 font-bold text-2xl">Vehicle Not Found</h2>
            <p className="mb-6 text-muted-foreground">Please select a vehicle to continue.</p>
            <Button asChild>
              <Link href="/vehicles">Browse Vehicles</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!vehicle) return null

  const primaryImage =
    vehicle.images?.find((img) => img.isPrimary)?.cardUrl ||
    vehicle.images?.find((img) => img.isPrimary)?.imageUrl ||
    vehicle.images?.[0]?.cardUrl ||
    vehicle.images?.[0]?.imageUrl ||
    ""
  // Check if form is valid and dates don't contain blocked dates
  const isValid =
    pickupDate &&
    dropoffDate &&
    pickupTime &&
    dropoffTime &&
    days > 0 &&
    !isDateRangeUnavailable(pickupDate, dropoffDate)

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button className="mb-6" onClick={() => router.back()} variant="ghost">
        <ArrowLeft className="mr-2 size-4" />
        Back
      </Button>

      <h1 className="mb-8 font-bold text-4xl">Complete Your Reservation</h1>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Reservation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      ${vehicle.dailyRate.toLocaleString()}/day
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Pickup Date and Time */}
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 flex items-center gap-2" htmlFor="pickup-date">
                    <CalendarIcon className="size-4" />
                    Pickup Date
                  </Label>
                  <Popover onOpenChange={setOpenPickupDate} open={openPickupDate}>
                    <PopoverTrigger asChild>
                      <Button
                        className="h-11 w-full justify-between px-3 py-2 font-normal"
                        id="pickup-date"
                        variant="outline"
                      >
                        {pickupDate
                          ? pickupDate.toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Select date"}
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        disabled={(date: Date) => {
                          const dateStart = new Date(date)
                          dateStart.setHours(0, 0, 0, 0)
                          return dateStart < minPickupDate || isDateUnavailable(dateStart)
                        }}
                        initialFocus
                        mode="single"
                        modifiers={{
                          blocked: blockedDates,
                        }}
                        modifiersClassNames={{
                          blocked: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
                        }}
                        onSelect={(date) => {
                          if (date) {
                            if (isDateUnavailable(date)) {
                              setError("This date is unavailable. Please select a different date.")
                              return
                            }
                            setPickupDate(date)
                            setError(null)
                            // Reset dropoff date if it's before new pickup date or if it's unavailable
                            if (dropoffDate && date && dropoffDate < date) {
                              setDropoffDate(undefined)
                            } else if (dropoffDate && isDateRangeUnavailable(date, dropoffDate)) {
                              setError(
                                "The selected date range includes unavailable dates. Please select different dates."
                              )
                              setDropoffDate(undefined)
                            }
                            setOpenPickupDate(false)
                          }
                        }}
                        selected={pickupDate}
                      />
                    </PopoverContent>
                  </Popover>
                  {blockedDates.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-muted-foreground text-xs">
                      <div className="size-3 rounded bg-red-100 dark:bg-red-900/20" />
                      <span>Unavailable dates</span>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="mb-2 flex items-center gap-2" htmlFor="pickup-time">
                    <Clock className="size-4" />
                    Pickup Time
                  </Label>
                  <Select onValueChange={setPickupTime} required value={pickupTime}>
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
                  <Label className="mb-2 flex items-center gap-2" htmlFor="dropoff-date">
                    <CalendarIcon className="size-4" />
                    Dropoff Date
                  </Label>
                  <Popover onOpenChange={setOpenDropoffDate} open={openDropoffDate}>
                    <PopoverTrigger asChild>
                      <Button
                        className="h-11 w-full justify-between px-3 py-2 font-normal"
                        id="dropoff-date"
                        variant="outline"
                      >
                        {dropoffDate
                          ? dropoffDate.toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Select date"}
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        disabled={(date: Date) => {
                          const dateStart = new Date(date)
                          dateStart.setHours(0, 0, 0, 0)
                          const minDate = new Date(minDropoffDate)
                          minDate.setHours(0, 0, 0, 0)
                          return dateStart < minDate || isDateUnavailable(dateStart)
                        }}
                        initialFocus
                        mode="single"
                        modifiers={{
                          blocked: blockedDates,
                        }}
                        modifiersClassNames={{
                          blocked: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
                        }}
                        onSelect={(date) => {
                          if (date) {
                            if (isDateUnavailable(date)) {
                              setError("This date is unavailable. Please select a different date.")
                              return
                            }
                            // Validate that the date range from pickup to dropoff doesn't contain blocked dates
                            if (pickupDate && isDateRangeUnavailable(pickupDate, date)) {
                              setError(
                                "The selected date range includes unavailable dates. Please select different dates."
                              )
                              return
                            }
                            setDropoffDate(date)
                            setError(null)
                            setOpenDropoffDate(false)
                          }
                        }}
                        selected={dropoffDate}
                      />
                    </PopoverContent>
                  </Popover>
                  {blockedDates.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-muted-foreground text-xs">
                      <div className="size-3 rounded bg-red-100 dark:bg-red-900/20" />
                      <span>Unavailable dates</span>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="mb-2 flex items-center gap-2" htmlFor="dropoff-time">
                    <Clock className="size-4" />
                    Dropoff Time
                  </Label>
                  <Select onValueChange={setDropoffTime} required value={dropoffTime}>
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

              {/* Add-ons Selection */}
              {vehicle.addOns && vehicle.addOns.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="font-semibold text-base">Add-ons (Optional)</Label>
                    <div className="space-y-2">
                      {vehicle.addOns.map((addOn, index) => {
                        const isSelected = selectedAddOns.some(
                          (selected) => selected.name === addOn.name
                        )
                        return (
                          <Card
                            className={cn(
                              "cursor-pointer transition-all hover:border-primary",
                              isSelected ? "border-2 border-primary" : ""
                            )}
                            key={`${addOn.name}-${index}`}
                            onClick={() => toggleAddOn(addOn)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    "mt-1 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground"
                                  )}
                                >
                                  {isSelected && <Check className="size-3" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold">{addOn.name}</h4>
                                      {addOn.isRequired && (
                                        <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                                          Required
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-semibold">
                                      +${addOn.price.toLocaleString()}
                                    </span>
                                  </div>
                                  {addOn.description && (
                                    <p className="mt-1 text-muted-foreground text-sm">
                                      {addOn.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {days > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Daily Rate</span>
                      <span>${vehicle.dailyRate.toLocaleString()}/day</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>
                        {days} {days === 1 ? "day" : "days"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Price</span>
                      <span>${(days * vehicle.dailyRate).toLocaleString()}</span>
                    </div>
                  </>
                )}
                {selectedAddOns.length > 0 && (
                  <>
                    {selectedAddOns.map((addOn) => (
                      <div className="flex justify-between text-sm" key={addOn.name}>
                        <span className="text-muted-foreground">{addOn.name}</span>
                        <span>+${addOn.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">${total.toLocaleString()}</span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!isValid || isCreatingReservation}
                onClick={handleProceedToPayment}
                size="lg"
              >
                {isCreatingReservation ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Proceed to Payment"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
