import { describe, expect, it } from "vitest"
import { centsToDollarInput, dollarsToCents } from "@/lib/rental-money"

describe("rental dollar input boundaries", () => {
  it.each([
    ["10.23", 1023],
    [10.23, 1023],
    ["0", 0],
    [".01", 1],
    ["10.", 1000],
    ["1.005", 101],
    ["1.0049", 100],
    ["9.999", 1000],
    [" 00010.23 ", 1023],
    ["90071992547409.91", Number.MAX_SAFE_INTEGER],
  ])("converts %s dollars to %s cents", (input, cents) => {
    expect(dollarsToCents(input)).toBe(cents)
  })

  it.each([
    "",
    " ",
    "-1",
    "-0.01",
    "1e3",
    "1,000",
    "$10",
    "10.2.3",
    "NaN",
    Number.POSITIVE_INFINITY,
    Number.NaN,
    "90071992547409.92",
    "90071992547409.915",
    "1".repeat(101),
  ])("rejects invalid or unsafe price %s", (input) => expect(dollarsToCents(input)).toBeNull())

  it.each([0, 1, 1023, 999999, Number.MAX_SAFE_INTEGER])("roundtrips integer cents %s", (cents) => {
    expect(dollarsToCents(centsToDollarInput(cents))).toBe(cents)
  })

  it("shows historical fractional cents without inferring a correction", () => {
    expect(centsToDollarInput(10.23)).toBe("0.1023")
    expect(centsToDollarInput(1023)).toBe("10.23")
  })
})
