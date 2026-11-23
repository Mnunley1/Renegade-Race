import { formatRentalUsd } from "@/lib/rental-checkout"
import { centsToDollarInput, dollarsToCents } from "@/lib/rental-money"

const PRICE_RANGE_PATTERN = /^\$?(\d+(?:\.\d+)?)(?:-\$?(\d+(?:\.\d+)?)|(\+))$/

export type PriceBounds = { min?: number; max?: number }

/** Catalog filter state and legacy `price` links use integer cents. */
export function parsePriceRange(value: unknown, unit: "cents" | "dollars" = "cents"): PriceBounds {
  if (typeof value !== "string" || value === "any") return {}
  const match = value.match(PRICE_RANGE_PATTERN)
  if (!match?.[1]) return {}
  const convert = (part: string) => {
    if (unit === "dollars") return dollarsToCents(part)
    const cents = Number(part)
    return Number.isSafeInteger(cents) && cents >= 0 ? cents : null
  }
  const min = convert(match[1])
  const max = match[2] === undefined ? undefined : convert(match[2])
  if (min === null || max === null || (max !== undefined && min > max)) return {}
  return { min, ...(max === undefined ? {} : { max }) }
}

export function priceRangeState(bounds: PriceBounds): string {
  if (bounds.min === undefined && bounds.max === undefined) return "any"
  return bounds.max === undefined ? `${bounds.min ?? 0}+` : `${bounds.min ?? 0}-${bounds.max}`
}

/** New URLs are explicitly dollar-valued; legacy links retain their cent bounds. */
export function readPriceFilter(params: Pick<URLSearchParams, "get">, stored?: unknown): string {
  const dollars = params.get("priceUsd")
  if (dollars !== null) return priceRangeState(parsePriceRange(dollars, "dollars"))
  return priceRangeState(parsePriceRange(params.get("price") ?? stored ?? "any"))
}

export function priceFilterDollars(value: string): string | null {
  const { min, max } = parsePriceRange(value)
  if (min === undefined) return null
  return max === undefined
    ? `${centsToDollarInput(min)}+`
    : `${centsToDollarInput(min)}-${centsToDollarInput(max)}`
}

export function priceFilterLabel(value: string): string {
  const { min, max } = parsePriceRange(value)
  if (min === undefined) return "Any price"
  return max === undefined
    ? `${formatRentalUsd(min)}+/day`
    : `${formatRentalUsd(min)}–${formatRentalUsd(max)}/day`
}

export function matchesPriceBounds(cents: number, bounds: PriceBounds): boolean {
  return (
    (bounds.min === undefined || cents >= bounds.min) &&
    (bounds.max === undefined || cents <= bounds.max)
  )
}
