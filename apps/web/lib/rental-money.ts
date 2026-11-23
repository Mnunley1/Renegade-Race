const DOLLAR_INPUT = /^(?:\d+(?:\.\d*)?|\.\d+)$/

/** Editable rental prices are USD dollars; API and persisted prices are cents. */
export function dollarsToCents(value: string | number): number | null {
  const input = String(value).trim()
  // Parse decimal text instead of multiplying a binary float (1.005 * 100).
  // Exponents, currency symbols, separators, and negative values are not prices.
  if (input.length > 100 || !DOLLAR_INPUT.test(input)) return null
  const [whole = "", fraction = ""] = input.split(".")
  const cents =
    BigInt(whole || "0") * 100n +
    BigInt(fraction.slice(0, 2).padEnd(2, "0")) +
    (Number(fraction[2] || "0") >= 5 ? 1n : 0n)
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null
}

export function centsToDollarInput(cents: number): string {
  if (!Number.isFinite(cents)) return ""
  if (!Number.isSafeInteger(cents) || cents < 0) {
    // Display legacy values as recorded; callers preserve untouched raw values.
    // Never infer that a historical cent value was intended to mean dollars.
    return String(cents / 100)
  }
  const amount = BigInt(cents)
  return `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`
}
