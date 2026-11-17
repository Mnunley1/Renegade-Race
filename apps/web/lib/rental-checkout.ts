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

export function formatRentalUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}
