import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import CheckoutPage from "@/app/checkout/page"
import { inclusiveRentalDays, isValidRentalDuration } from "@/lib/date-utils"
import { calculateRentalEstimate, formatRentalUsd } from "@/lib/rental-checkout"

const mock = vi.hoisted(() => ({
  params: "",
  createReservation: vi.fn(),
  push: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: true, user: { id: "renter" } }),
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mock.params),
  useRouter: () => ({ push: mock.push }),
}))
vi.mock("convex/react", () => ({
  useMutation: () => mock.createReservation,
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn) === "vehicles:getById"
      ? vehicle
      : [{ date: "2099-08-01", isAvailable: false }],
}))
vi.mock("@workspace/ui/components/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode
    onValueChange: (value: string) => void
    value: string
  }) => (
    <select onChange={(event) => onValueChange(event.target.value)} value={value}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

const vehicle = {
  _id: "vehicle",
  make: "Test",
  model: "Car",
  year: 2026,
  dailyRate: 10000,
  addOns: [
    { name: "Helmet", price: 2500, priceType: "daily" as const, isRequired: true },
    { name: "Delivery", price: 3500, priceType: "one-time" as const, isRequired: true },
  ],
  images: [],
}

beforeEach(() => {
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-01"
  mock.createReservation.mockReset().mockResolvedValue("booking")
  mock.push.mockReset()
})
afterEach(cleanup)

it.each([
  ["2026-08-01", "2026-08-01", 1],
  ["2026-08-01", "2026-08-02", 2],
  ["2026-08-01", "2026-08-03", 3],
  ["2026-03-07", "2026-03-09", 3],
  ["2026-10-31", "2026-11-02", 3],
  ["2028-02-28", "2028-03-01", 3],
  ["2026-08-02", "2026-08-01", 0],
  ["invalid", "2026-08-01", 0],
])("counts occupied calendar days from %s to %s", (start, end, days) => {
  expect(inclusiveRentalDays(start, end)).toBe(days)
})

it("limits rental requests to one through three days and prices daily add-ons in cents", () => {
  expect([0, 1, 2, 3, 4, 1.5].map(isValidRentalDuration)).toEqual([
    false,
    true,
    true,
    true,
    false,
    false,
  ])
  expect(calculateRentalEstimate("2026-08-01", "2026-08-02", 10000, vehicle.addOns)).toEqual({
    days: 2,
    addOnsTotal: 8500,
    total: 28500,
  })
  expect(formatRentalUsd(28500)).toBe("$285.00")
})

it("allows a same-day request on a host-marked date and submits the displayed add-on pricing", async () => {
  render(<CheckoutPage />)
  expect(await screen.findByText("1 day")).toBeInTheDocument()
  expect(screen.getByText("$160.00")).toBeInTheDocument()
  const times = screen.getAllByRole("combobox")
  expect(times).toHaveLength(2)
  times.forEach((time, index) => {
    fireEvent.change(time, { target: { value: index === 0 ? "08:00" : "18:00" } })
  })
  fireEvent.click(screen.getByRole("button", { name: "Submit Request" }))
  await waitFor(() =>
    expect(mock.createReservation).toHaveBeenCalledWith({
      vehicleId: "vehicle",
      startDate: "2099-08-01",
      endDate: "2099-08-01",
      pickupTime: "08:00",
      dropoffTime: "18:00",
      renterMessage: undefined,
      addOns: [
        { name: "Helmet", price: 2500, priceType: "daily", description: undefined },
        { name: "Delivery", price: 3500, priceType: "one-time", description: undefined },
      ],
    })
  )
  expect(mock.push).toHaveBeenCalledWith("/checkout/request-sent?reservationId=booking")
})

it("shows the two-day total including daily add-ons", async () => {
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-02"
  render(<CheckoutPage />)
  expect(await screen.findByText("2 days")).toBeInTheDocument()
  expect(screen.getByText("$285.00")).toBeInTheDocument()
})

it("does not submit a four-day range supplied through the URL", async () => {
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-04"
  render(<CheckoutPage />)
  await screen.findByText("4 days")
  const times = screen.getAllByRole("combobox")
  expect(times).toHaveLength(2)
  times.forEach((time, index) => {
    fireEvent.change(time, { target: { value: index === 0 ? "08:00" : "18:00" } })
  })
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeDisabled()
  expect(mock.createReservation).not.toHaveBeenCalled()
})
