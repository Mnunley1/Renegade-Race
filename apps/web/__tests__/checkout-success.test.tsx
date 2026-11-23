import { cleanup, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import CheckoutSuccessPage from "@/app/checkout/success/page"

const mock = vi.hoisted(() => ({
  reservation: undefined as Record<string, unknown> | null | undefined,
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("reservationId=booking"),
}))
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: { id: "renter" } }) }))
vi.mock("convex/react", () => ({
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn) === "stripe:getUserPayments" ? [] : mock.reservation,
}))

const reservation = {
  _id: "booking",
  status: "approved",
  paymentStatus: "pending",
  startDate: "2031-08-01",
  endDate: "2031-08-03",
  totalDays: 2,
  totalAmount: 20000,
  vehicle: null,
}

beforeEach(() => {
  mock.reservation = { ...reservation }
})
afterEach(cleanup)

it("waits for persisted payment confirmation, then updates when the webhook settles", () => {
  const { rerender } = render(<CheckoutSuccessPage />)
  expect(screen.getByRole("heading", { name: "Awaiting payment confirmation" })).toBeInTheDocument()
  expect(screen.queryByText("Reservation Confirmed!")).toBeNull()
  expect(screen.queryByRole("link", { name: "Try Payment Again" })).toBeNull()

  mock.reservation = { ...reservation, status: "confirmed", paymentStatus: "paid" }
  rerender(<CheckoutSuccessPage />)
  expect(screen.getByRole("heading", { name: "Reservation Confirmed!" })).toBeInTheDocument()
  expect(screen.queryByText("Awaiting payment confirmation")).toBeNull()
})

it("shows a failed payment with a retry link without claiming confirmation", () => {
  mock.reservation = { ...reservation, paymentStatus: "failed" }
  render(<CheckoutSuccessPage />)
  expect(screen.getByRole("heading", { name: "Payment failed" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Try Payment Again" })).toHaveAttribute(
    "href",
    "/checkout/pay?reservationId=booking"
  )
  expect(screen.queryByText("Reservation Confirmed!")).toBeNull()
})

it.each([
  ["pending", "pending", "Awaiting host approval"],
  ["approved", "paid", "Payment received; booking needs review"],
  ["confirmed", "pending", "Awaiting payment confirmation"],
  ["cancelled", "paid", "Reservation not confirmed"],
  ["declined", "failed", "Reservation not confirmed"],
  ["completed", "paid", "Reservation not confirmed"],
  ["confirmed", "refunded", "Payment refunded"],
])("does not claim success for %s / %s opened directly", (status, paymentStatus, heading) => {
  mock.reservation = { ...reservation, status, paymentStatus }
  render(<CheckoutSuccessPage />)
  expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
  expect(screen.queryByText("Reservation Confirmed!")).toBeNull()
  expect(screen.queryByRole("link", { name: "Try Payment Again" })).toBeNull()
})

it.each([
  "paid",
  "partially_refunded",
])("directs an approved booking with %s payment to support without offering another payment", (paymentStatus) => {
  mock.reservation = { ...reservation, paymentStatus }
  render(<CheckoutSuccessPage />)
  expect(
    screen.getByRole("heading", { name: "Payment received; booking needs review" })
  ).toBeInTheDocument()
  expect(screen.getByText("Do not submit another payment.", { exact: false })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Contact Support" })).toHaveAttribute("href", "/contact")
  expect(screen.getByRole("link", { name: "View My Trips" })).toHaveAttribute("href", "/trips")
  expect(screen.queryByRole("link", { name: "Try Payment Again" })).toBeNull()
  expect(screen.queryByText("Reservation Confirmed!")).toBeNull()
})

it("keeps an active partially refunded reservation confirmed", () => {
  mock.reservation = { ...reservation, status: "confirmed", paymentStatus: "partially_refunded" }
  render(<CheckoutSuccessPage />)
  expect(screen.getByRole("heading", { name: "Reservation Confirmed!" })).toBeInTheDocument()
})

it("distinguishes a loading query from a missing reservation", () => {
  mock.reservation = undefined
  const { rerender } = render(<CheckoutSuccessPage />)
  expect(screen.getByText("Loading reservation details...")).toBeInTheDocument()
  mock.reservation = null
  rerender(<CheckoutSuccessPage />)
  expect(screen.getByRole("heading", { name: "Reservation unavailable" })).toBeInTheDocument()
  expect(screen.queryByText("Loading reservation details...")).toBeNull()
  expect(screen.queryByText("Reservation Confirmed!")).toBeNull()
})
