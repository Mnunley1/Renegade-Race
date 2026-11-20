"use client"

import { useUser } from "@clerk/nextjs"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { Calendar as CalendarIcon, Check, ChevronDown, Clock, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { authReturnLink } from "@/lib/auth-return"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import {
  endDateFromDuration,
  formatDateToISO,
  inclusiveRentalDays,
  isValidRentalDuration,
  parseLocalDate,
} from "@/lib/date-utils"
import { r2Url } from "@/lib/r2-url"
import { calculateRentalEstimate, formatRentalUsd } from "@/lib/rental-checkout"
import {
  clearRentalDraft,
  isDateOnly,
  loadRentalDraft,
  type RentalDraft,
  saveRentalDraft,
} from "@/lib/rental-draft"

interface AddOn {
  name: string
  price: number
  description?: string
  isRequired?: boolean
  priceType?: "daily" | "one-time"
}

function CheckoutPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isSignedIn, user, isLoaded } = useUser()
  const vehicleId = searchParams.get("vehicleId")
  const startDateParam = searchParams.get("startDate")
  const endDateParam = searchParams.get("endDate")

  const vehicle = useQuery(
    api.vehicles.getById,
    vehicleId ? { id: vehicleId as Id<"vehicles"> } : "skip"
  )

  // Fetch blocked dates from availability
  const availability = useQuery(
    api.availability.getByVehicle,
    vehicleId ? { vehicleId: vehicleId as Id<"vehicles"> } : "skip"
  )
  const activeReservations = useQuery(
    api.reservations.listActiveForVehicle,
    vehicleId ? { vehicleId: vehicleId as Id<"vehicles"> } : "skip"
  )

  const createReservation = useMutation(api.reservations.create)

  const [pickupDate, setPickupDate] = useState<Date | undefined>(undefined)
  const [pickupTime, setPickupTime] = useState("")
  const [duration, setDuration] = useState<number | null>(1)
  const endDateValue =
    pickupDate && duration ? endDateFromDuration(formatDateToISO(pickupDate), duration) : null
  const dropoffDate = endDateValue ? (parseLocalDate(endDateValue) ?? undefined) : undefined
  const [dropoffTime, setDropoffTime] = useState("")
  const [openPickupDate, setOpenPickupDate] = useState(false)
  const [renterMessage, setRenterMessage] = useState("")
  const [selectedAddOnNames, setSelectedAddOnNames] = useState<string[]>([])
  const selectedAddOns: AddOn[] = (vehicle?.addOns ?? []).filter(
    (addOn: AddOn) => addOn.isRequired || selectedAddOnNames.includes(addOn.name)
  )
  const [initializedVehicle, setInitializedVehicle] = useState<string | null>(null)
  const [initializedOwner, setInitializedOwner] = useState<string | null | undefined>(undefined)
  const currentOwner = user?.id ?? null
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startDate = pickupDate ? formatDateToISO(pickupDate) : null
  const endDate = dropoffDate ? formatDateToISO(dropoffDate) : null
  const hasValidDateRange =
    startDate && endDate && isValidRentalDuration(inclusiveRentalDays(startDate, endDate))
  const rangeAvailability = useQuery(
    api.availability.checkAvailability,
    vehicleId && startDate && endDate && hasValidDateRange
      ? { vehicleId: vehicleId as Id<"vehicles">, startDate, endDate }
      : "skip"
  )
  const isCheckingAvailability =
    availability === undefined ||
    activeReservations === undefined ||
    (hasValidDateRange && rangeAvailability === undefined)
  let availabilityMessage = "These dates are open for a request. Host approval is still required."
  if (isCheckingAvailability) availabilityMessage = "Checking date availability…"
  else if (rangeAvailability?.isAvailable === false)
    availabilityMessage = "These dates are unavailable. Choose another rental period."

  const resumeDraft = searchParams.get("resume") === "1"
  useEffect(() => {
    if (
      !(vehicleId && isLoaded) ||
      (initializedVehicle === vehicleId && initializedOwner === currentOwner)
    )
      return
    const draft = loadRentalDraft(vehicleId, user?.id ?? null)
    let initialDate = draft?.startDate ? (parseLocalDate(draft.startDate) ?? undefined) : undefined
    let initialDuration: number | null = draft ? draft.duration : 1
    let dateError: string | null = null
    if (!(resumeDraft && draft) && (startDateParam || endDateParam)) {
      const days =
        startDateParam && endDateParam ? inclusiveRentalDays(startDateParam, endDateParam) : 0
      const validStart = isDateOnly(startDateParam) && startDateParam >= formatDateToISO(new Date())
      initialDate = validStart ? (parseLocalDate(startDateParam) ?? undefined) : undefined
      initialDuration =
        validStart && isDateOnly(endDateParam) && isValidRentalDuration(days) ? days : null
      if (initialDuration === null)
        dateError =
          "Those dates are not supported. Choose a future pickup date and a rental of 1, 2, or 3 calendar days."
    }
    setPickupDate(initialDate)
    setDuration(initialDuration)
    setPickupTime(draft?.pickupTime ?? "")
    setDropoffTime(draft?.dropoffTime ?? "")
    setSelectedAddOnNames(draft?.selectedAddOnNames ?? [])
    setRenterMessage(draft?.renterMessage ?? "")
    setError(dateError)
    setDraftNotice(
      draft
        ? "Your saved choices are restored. Review the current prices, required add-ons, and date availability before submitting."
        : null
    )
    setInitializedVehicle(vehicleId)
    setInitializedOwner(currentOwner)
  }, [
    vehicleId,
    isLoaded,
    user?.id,
    initializedVehicle,
    initializedOwner,
    currentOwner,
    resumeDraft,
    startDateParam,
    endDateParam,
  ])

  useEffect(() => {
    if (initializedVehicle !== vehicleId) return
    const requiredNames = (vehicle?.addOns ?? [])
      .filter((addOn: AddOn) => addOn.isRequired)
      .map((addOn: AddOn) => addOn.name)
    setSelectedAddOnNames((names) =>
      requiredNames.every((name: string) => names.includes(name))
        ? names
        : [...new Set([...names, ...requiredNames])]
    )
  }, [vehicle?.addOns, vehicleId, initializedVehicle])

  const draft: RentalDraft | null = vehicleId
    ? {
        version: 1,
        vehicleId,
        ownerId: user?.id ?? null,
        savedAt: Date.now(),
        startDate,
        duration,
        pickupTime,
        dropoffTime,
        selectedAddOnNames,
        renterMessage,
      }
    : null
  useEffect(() => {
    if (
      !vehicleId ||
      initializedVehicle !== vehicleId ||
      initializedOwner !== currentOwner ||
      isSubmitting
    )
      return
    setStorageUnavailable(
      !saveRentalDraft({
        version: 1,
        vehicleId,
        ownerId: user?.id ?? null,
        savedAt: Date.now(),
        startDate,
        duration,
        pickupTime,
        dropoffTime,
        selectedAddOnNames,
        renterMessage,
      })
    )
  }, [
    vehicleId,
    initializedVehicle,
    initializedOwner,
    currentOwner,
    user?.id,
    startDate,
    duration,
    pickupTime,
    dropoffTime,
    selectedAddOnNames,
    renterMessage,
    isSubmitting,
  ])

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
    if (!(hours && minutes)) return time24
    const hour = Number.parseInt(hours, 10)
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const ampm = hour < 12 ? "AM" : "PM"
    return `${hour12}:${minutes} ${ampm}`
  }

  // Calculate minimum dates
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minPickupDate = today

  // Get blocked dates from availability (where isAvailable is false)
  const blockedDates =
    availability
      ?.filter((item: { isAvailable: boolean; date: string }) => !item.isAvailable)
      .map((item: { date: string }) => parseLocalDate(item.date))
      .filter((d: Date | null): d is Date => d !== null) || []
  const reservedRanges =
    activeReservations?.filter(
      (reservation) => reservation.status === "approved" || reservation.status === "confirmed"
    ) ?? []
  const isRangeUnavailable = (start: Date, end = start) => {
    const firstDay = formatDateToISO(start)
    const lastDay = formatDateToISO(end)
    return (
      blockedDates.some((date) => {
        const day = formatDateToISO(date)
        return day >= firstDay && day <= lastDay
      }) ||
      reservedRanges.some(
        (reservation) => reservation.startDate <= lastDay && reservation.endDate >= firstDay
      )
    )
  }

  // Toggle add-on selection
  const toggleAddOn = (addOn: AddOn) => {
    if (addOn.isRequired) return // Can't deselect required add-ons

    setSelectedAddOnNames((prev) =>
      prev.includes(addOn.name) ? prev.filter((name) => name !== addOn.name) : [...prev, addOn.name]
    )
  }

  // Calculate total days and price
  const calculateTotal = () => {
    if (!(pickupDate && dropoffDate && vehicle)) {
      return { days: 0, total: 0, addOnsTotal: 0 }
    }

    return calculateRentalEstimate(
      formatDateToISO(pickupDate),
      formatDateToISO(dropoffDate),
      vehicle.dailyRate,
      selectedAddOns
    )
  }

  const { days, total } = calculateTotal()

  const handleSubmitRequest = async () => {
    if (!(isSignedIn && user?.id)) {
      if (!(draft && saveRentalDraft(draft))) {
        setError(
          "Your browser could not save this rental draft. Enable session storage before signing in so your choices can be restored."
        )
        return
      }
      const returnPath = `/checkout?${new URLSearchParams({ vehicleId: vehicleId ?? "", resume: "1" })}`
      router.push(authReturnLink("/sign-in", returnPath))
      return
    }

    if (!(pickupDate && dropoffDate && pickupTime && dropoffTime && vehicle)) {
      setError("Please fill in all required fields")
      return
    }

    if (!isValidRentalDuration(days)) {
      setError("Choose a rental of 1, 2, or 3 calendar days.")
      return
    }
    if (isCheckingAvailability || rangeAvailability?.isAvailable !== true) {
      setError("These dates are unavailable or still being checked. Please choose available dates.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Prepare selected add-ons data (without isRequired field)
      const reservationAddOns =
        selectedAddOns.length > 0
          ? selectedAddOns.map((addOn) => ({
              name: addOn.name,
              price: addOn.price,
              description: addOn.description,
              priceType: addOn.priceType,
            }))
          : undefined

      // Convert Date objects to ISO date strings (YYYY-MM-DD) using local date formatting
      // This prevents timezone shifts when converting dates
      const startDateString = formatDateToISO(pickupDate)
      const endDateString = formatDateToISO(dropoffDate)

      // Create reservation request (no payment at this stage)
      const newReservationId = await createReservation({
        vehicleId: vehicle._id,
        startDate: startDateString,
        endDate: endDateString,
        pickupTime,
        dropoffTime,
        renterMessage: renterMessage.trim() || undefined,
        addOns: reservationAddOns,
      })

      if (vehicleId) clearRentalDraft(vehicleId)
      // Redirect to request confirmation page
      router.push(`/checkout/request-sent?reservationId=${newReservationId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Show loading state
  if (vehicle === undefined && vehicleId) {
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
  if (!vehicle) {
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

  const vehicleImages = (vehicle as any)?.images as
    | Array<{ isPrimary: boolean; imageUrl?: string; r2Key?: string }>
    | undefined
  const primaryImageData = vehicleImages?.find((img) => img.isPrimary) || vehicleImages?.[0]
  const primaryImage =
    (primaryImageData?.r2Key ? r2Url(primaryImageData.r2Key) : primaryImageData?.imageUrl) || ""
  const isValid =
    isLoaded &&
    initializedVehicle === vehicleId &&
    initializedOwner === currentOwner &&
    pickupDate &&
    formatDateToISO(pickupDate) >= formatDateToISO(today) &&
    dropoffDate &&
    pickupTime &&
    dropoffTime &&
    isValidRentalDuration(days) &&
    !isCheckingAvailability &&
    rangeAvailability?.isAvailable === true

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-8 font-bold text-4xl">Request a Rental</h1>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Reservation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {vehicle && (
                <div className="flex gap-4">
                  {primaryImage && primaryImage.trim() !== "" ? (
                    <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="object-cover"
                        fill
                        sizes="160px"
                        src={primaryImage}
                      />
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {formatRentalUsd(vehicle.dailyRate)}/day
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
                          return (
                            availability === undefined ||
                            activeReservations === undefined ||
                            dateStart < minPickupDate ||
                            isRangeUnavailable(dateStart)
                          )
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
                            setPickupDate(date)
                            setError(null)
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
                      <span>Host-blocked dates cannot be requested.</span>
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
                <fieldset className="space-y-2">
                  <legend className="font-medium text-sm">Rental duration</legend>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((days) => {
                      const end = pickupDate
                        ? endDateFromDuration(formatDateToISO(pickupDate), days)
                        : null
                      const lastDay = end ? parseLocalDate(end) : null
                      const unavailable =
                        !(pickupDate && lastDay) ||
                        availability === undefined ||
                        activeReservations === undefined ||
                        isRangeUnavailable(pickupDate, lastDay)
                      return (
                        <Button
                          aria-pressed={duration === days}
                          disabled={unavailable}
                          key={days}
                          onClick={() => {
                            setDuration(days)
                            setError(null)
                          }}
                          type="button"
                          variant={duration === days ? "default" : "outline"}
                        >
                          {days} {days === 1 ? "day" : "days"}
                        </Button>
                      )
                    })}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Pickup and dropoff days both count. Friday through Sunday is 3 days.
                  </p>
                  <p className="text-sm">
                    Dropoff date:{" "}
                    {dropoffDate
                      ? dropoffDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Choose a pickup date and duration"}
                  </p>
                </fieldset>
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
                      {vehicle.addOns.map((addOn: AddOn, index: number) => {
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
                                      +{formatRentalUsd(addOn.price)}
                                      {addOn.priceType === "daily" ? "/day" : ""}
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

              <Separator />

              {/* Message to Host */}
              <div className="space-y-2">
                <Label htmlFor="renter-message">Message to Host (Optional)</Label>
                <Textarea
                  className="min-h-[100px]"
                  id="renter-message"
                  maxLength={1000}
                  onChange={(e) => setRenterMessage(e.target.value)}
                  placeholder="Introduce yourself, share your experience level, or ask any questions about the vehicle..."
                  value={renterMessage}
                />
                <p className="text-muted-foreground text-xs">
                  {renterMessage.length}/1000 characters
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Request Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {days > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Daily Rate</span>
                      <span>{formatRentalUsd(vehicle.dailyRate)}/day</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>
                        {days} {days === 1 ? "day" : "days"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Price</span>
                      <span>{formatRentalUsd(days * vehicle.dailyRate)}</span>
                    </div>
                  </>
                )}
                {selectedAddOns.length > 0 &&
                  selectedAddOns.map((addOn) => (
                    <div className="flex justify-between text-sm" key={addOn.name}>
                      <span className="text-muted-foreground">{addOn.name}</span>
                      <span>
                        +{formatRentalUsd(addOn.price * (addOn.priceType === "daily" ? days : 1))}
                      </span>
                    </div>
                  ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Estimated Total</span>
                  <span className="font-bold text-lg">{formatRentalUsd(total)}</span>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-3 text-muted-foreground text-sm">
                Rentals last 1, 2, or 3 calendar days, including pickup and dropoff dates. No
                payment is required now. Host-blocked dates and approved or confirmed bookings
                cannot be requested. Other pending requests do not reserve dates. The host will
                review your request and you'll only pay if approved.
              </div>

              {hasValidDateRange && (
                <output aria-live="polite" className="block text-sm">
                  {availabilityMessage}
                </output>
              )}

              {draftNotice && <p className="text-sm">{draftNotice}</p>}
              {selectedAddOnNames.some(
                (name) => !(vehicle.addOns ?? []).some((addOn: AddOn) => addOn.name === name)
              ) && (
                <p className="text-sm">
                  An add-on you selected is no longer available and has been removed from the quote.
                </p>
              )}
              {storageUnavailable && (
                <p className="text-sm">
                  Your browser cannot save these choices for later. Keep this page open until your
                  request is submitted.
                </p>
              )}
              {error && (
                <div
                  className="rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive text-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!isValid || isSubmitting}
                onClick={handleSubmitRequest}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Submitting...
                  </>
                ) : isSignedIn ? (
                  "Submit Request"
                ) : (
                  "Sign in to continue"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
              <p className="font-medium text-lg text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  )
}
