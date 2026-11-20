import { afterEach, expect, it, vi } from "vitest"
import { authReturnLink, safeReturnPath } from "@/lib/auth-return"
import {
  endDateFromDuration,
  formatDateForDisplay,
  formatDateToISO,
  inclusiveRentalDays,
  parseLocalDate,
} from "@/lib/date-utils"
import { parseRentalDraft } from "@/lib/rental-draft"
import { formatBookingDateRange } from "@/lib/reservation-status"

const now = new Date("2030-01-01T12:00:00Z").getTime()
const draft = {
  version: 1,
  vehicleId: "vehicle",
  ownerId: null,
  savedAt: now,
  startDate: "2030-03-09",
  duration: 3,
  pickupTime: "08:00",
  dropoffTime: "18:30",
  selectedAddOnNames: ["Helmet"],
  renterMessage: "Meet at the track",
}
afterEach(() => vi.unstubAllEnvs())

it.each([
  null,
  "https://evil.example",
  "//evil.example",
  "/\\evil.example",
  "/%2fevil.example",
  "/%5cevil.example",
  "/checkout\n",
  "/checkout%0d%0a",
  "/bad%",
  "/bad%ZZ",
  "javascript:alert(1)",
])("rejects an unsafe or malformed return destination: %s", (value) => {
  expect(safeReturnPath(value)).toBe("/")
})
it("preserves a relative checkout destination without decoding its query twice", () => {
  const destination = "/checkout?vehicleId=vehicle&resume=1&label=100%25"
  expect(safeReturnPath(destination)).toBe(destination)
  const link = authReturnLink("/sign-up", destination)
  expect(
    safeReturnPath(new URL(link, "https://app.example").searchParams.get("redirect_url"))
  ).toBe(destination)
})
it("accepts a fresh guest draft for the signed-in renter but strips monetary payloads", () => {
  expect(
    parseRentalDraft(
      JSON.stringify({ ...draft, totalAmount: 1, addOns: [{ name: "Helmet", price: 1 }] }),
      "vehicle",
      "renter",
      now
    )
  ).toEqual(draft)
})
it.each([
  { version: 2 },
  { vehicleId: "another" },
  { ownerId: "another-user" },
  { savedAt: now - 86_400_001 },
  { savedAt: now + 1 },
  { startDate: "2029-12-31" },
  { startDate: "2030-02-30" },
  { startDate: "2030-03-09extra" },
  { duration: 4 },
  { duration: -1 },
  { duration: "3" },
  { pickupTime: "25:30" },
  { dropoffTime: "18:33" },
  { selectedAddOnNames: [{ name: "Helmet", price: 1 }] },
  { selectedAddOnNames: new Array(101).fill("Helmet") },
  { renterMessage: "a".repeat(1001) },
])("rejects an expired, foreign, or tampered rental draft: %j", (change) => {
  expect(
    parseRentalDraft(JSON.stringify({ ...draft, ...change }), "vehicle", "renter", now)
  ).toBeNull()
})
it("rejects broken and oversized storage records without throwing", () => {
  for (const value of ["{", "null", "0", "x".repeat(16385)])
    expect(parseRentalDraft(value, "vehicle", null, now)).toBeNull()
})
it.each([
  ["2028-02-28", 3, "2028-03-01"],
  ["2030-12-31", 2, "2031-01-01"],
  ["2026-03-07", 3, "2026-03-09"],
  ["2026-10-31", 3, "2026-11-02"],
  ["2030-01-31", 1, "2030-01-31"],
])("derives inclusive dropoff across calendar boundaries: %s + %s", (start, duration, end) => {
  expect(endDateFromDuration(start, duration)).toBe(end)
  expect(inclusiveRentalDays(start, end)).toBe(duration)
})
it.each([
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "Asia/Tokyo",
])("renders rental date-only labels without shifting a day in %s", (timezone) => {
  vi.stubEnv("TZ", timezone)
  expect(formatDateForDisplay("2030-01-01")).toBe("Jan 1, 2030")
  expect(formatBookingDateRange("2030-01-01", "2030-01-03")).toBe("Jan 1 – 3")
  expect(formatDateToISO(parseLocalDate("2030-01-01")!)).toBe("2030-01-01")
  expect(parseLocalDate("2030-01-01junk")).toBeNull()
})
