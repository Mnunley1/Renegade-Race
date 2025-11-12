"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useMutation, useAction } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  DollarSign,
  Users,
} from "lucide-react"
import { api } from "@/lib/convex"
import { Card, CardContent } from "@workspace/ui/components/card"

interface AddOn {
  name: string
  price: number
  description?: string
  isRequired?: boolean
}

interface BookingFormProps {
  pricePerDay: number
  vehicleId: string
  addOns?: AddOn[]
}

export function BookingForm({ pricePerDay, vehicleId, addOns = [] }: BookingFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isSignedIn } = useUser()
  const createReservation = useMutation(api.reservations.create)
  const createPaymentIntent = useAction(api.stripe.createPaymentIntent)

  const [pickupDate, setPickupDate] = useState<Date | undefined>(undefined)
  const [pickupTime, setPickupTime] = useState("")
  const [dropoffDate, setDropoffDate] = useState<Date | undefined>(undefined)
  const [dropoffTime, setDropoffTime] = useState("")
  const [openPickupDate, setOpenPickupDate] = useState(false)
  const [openDropoffDate, setOpenDropoffDate] = useState(false)
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>(() => {
    // Auto-select required add-ons
    return addOns.filter((addOn) => addOn.isRequired) || []
  })
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minPickupDate = today
  const minDropoffDate = pickupDate || today

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
    if (!pickupDate || !dropoffDate) return { days: 0, total: 0, addOnsTotal: 0 }

    const start = new Date(pickupDate)
    const end = new Date(dropoffDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0) return { days: 0, total: 0, addOnsTotal: 0 }

    const baseTotal = days * pricePerDay
    const addOnsTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0)
    const total = baseTotal + addOnsTotal

    return { days, total, addOnsTotal }
  }

  const { days, total, addOnsTotal } = calculateTotal()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!isSignedIn) {
      setError("Please sign in to make a reservation")
      setIsSubmitting(false)
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname || "/")}`)
      return
    }

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

      // Create reservation with vehicleId (should already be a Convex Id)
      const reservationId = await createReservation({
        vehicleId: vehicleId as any,
        startDate: startDateString,
        endDate: endDateString,
        pickupTime,
        dropoffTime,
        addOns: reservationAddOns,
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
            <CalendarIcon className="size-4" />
            Pickup Date
          </Label>
          <Popover open={openPickupDate} onOpenChange={setOpenPickupDate}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id="pickup-date"
                className="w-full justify-between font-normal h-11 px-3 py-2"
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
            <PopoverContent className="w-auto p-0 max-w-none" align="start" side="bottom">
              <Calendar
                mode="single"
                selected={pickupDate}
                onSelect={(date) => {
                  setPickupDate(date)
                  // Reset dropoff date if it's before new pickup date
                  if (dropoffDate && date && dropoffDate < date) {
                    setDropoffDate(undefined)
                  }
                  setOpenPickupDate(false)
                }}
                disabled={(date: Date) => {
                  const dateStart = new Date(date)
                  dateStart.setHours(0, 0, 0, 0)
                  return dateStart < minPickupDate
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
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
            <CalendarIcon className="size-4" />
            Dropoff Date
          </Label>
          <Popover open={openDropoffDate} onOpenChange={setOpenDropoffDate}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id="dropoff-date"
                className="w-full justify-between font-normal h-11 px-3 py-2"
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
            <PopoverContent className="w-auto p-0 max-w-none" align="start" side="bottom">
              <Calendar
                mode="single"
                selected={dropoffDate}
                onSelect={(date) => {
                  setDropoffDate(date)
                  setOpenDropoffDate(false)
                }}
                disabled={(date: Date) => {
                  const dateStart = new Date(date)
                  dateStart.setHours(0, 0, 0, 0)
                  const minDate = new Date(minDropoffDate)
                  minDate.setHours(0, 0, 0, 0)
                  return dateStart < minDate
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
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

      {/* Add-ons Selection */}
      {addOns.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-base font-semibold">Add-ons (Optional)</Label>
            <div className="space-y-2">
              {addOns.map((addOn, index) => {
                const isSelected = selectedAddOns.some((selected) => selected.name === addOn.name)
                return (
                  <Card
                    key={`${addOn.name}-${index}`}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary",
                      isSelected ? "border-primary border-2" : ""
                    )}
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
                                <span className="rounded bg-primary/10 px-2 py-0.5 text-primary text-xs font-medium">
                                  Required
                                </span>
                              )}
                            </div>
                            <span className="font-semibold">+${addOn.price.toLocaleString()}</span>
                          </div>
                          {addOn.description && (
                            <p className="mt-1 text-muted-foreground text-sm">{addOn.description}</p>
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

      {/* Price Summary */}
      {days > 0 && (
        <>
          <Separator />
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  ${pricePerDay.toLocaleString()} × {days} {days === 1 ? "day" : "days"}
                </span>
                <span className="font-medium">
                  ${(days * pricePerDay).toLocaleString()}
                </span>
              </div>
              {selectedAddOns.length > 0 && (
                <>
                  {selectedAddOns.map((addOn) => (
                    <div key={addOn.name} className="flex justify-between">
                      <span className="text-muted-foreground">{addOn.name}</span>
                      <span className="font-medium">+${addOn.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                </>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>${total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </>
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
          <CalendarIcon className="size-4 text-muted-foreground" />
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

