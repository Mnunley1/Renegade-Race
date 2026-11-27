import { ConvexError } from "convex/values"
import { inclusiveRentalDays } from "@/lib/date-utils"

export function calculateRentalEstimate(
  startDate: string,
  endDate: string,
  dailyRate: number,
  addOns: ReadonlyArray<{ price: number; priceType?: "daily" | "one-time" }>
) {
  const days = inclusiveRentalDays(startDate, endDate)
  if (days === 0) return { days: 0, total: 0, addOnsTotal: 0 }
  const addOnsTotal = addOns.reduce(
    (sum, addOn) => sum + addOn.price * (addOn.priceType === "daily" ? days : 1),
    0
  )
  return { days, total: days * dailyRate + addOnsTotal, addOnsTotal }
}

/** Persisted rental money is integer USD cents; convert only at display boundaries. */
export function formatRentalUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

export function getRentalQuoteError(error: unknown): string | null {
  if (error instanceof ConvexError && error.data?.code === "PRICE_CHANGED") {
    return typeof error.data.message === "string"
      ? error.data.message
      : "This booking's quote cannot be verified. Please submit a new rental request for host approval."
  }
  if (error instanceof Error && error.message.includes("PRICE_CHANGED")) {
    return "This booking's quote cannot be verified. Please submit a new rental request for host approval."
  }
  return null
}

export function isTerminalRentalPaymentError(error: unknown): boolean {
  return (
    (error instanceof ConvexError && error.data?.code === "PAYMENT_ATTEMPT_TERMINAL") ||
    (error instanceof Error && error.message.includes("PAYMENT_ATTEMPT_TERMINAL"))
  )
}

/** Recovery failures describe the owner's setup, never the renter's card or account IDs. */
export function getRentalPayoutHoldError(error: unknown): string | null {
  if (
    (error instanceof ConvexError && error.data?.code === "PAYOUT_VERIFICATION_REQUIRED") ||
    (error instanceof Error && error.message.includes("PAYOUT_VERIFICATION_REQUIRED"))
  ) {
    return "The owner needs to finish payment setup before you can pay for this rental. Your reservation has not been changed."
  }
  return null
}
