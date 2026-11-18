import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import PayPage from "@/app/checkout/pay/page"
import RequestSentPage from "@/app/checkout/request-sent/page"
import CheckoutSuccessPage from "@/app/checkout/success/page"
import HostReservationsPage from "@/app/host/reservations/page"
import { RentalPaymentSummary } from "@/components/rental-payment-summary"
import { TripCard } from "@/components/trip-card"

const SUBTOTAL_LABEL = /Rental subtotal/i
const DAILY_RATE = /\$10\.23\/day/
const PARTIAL_REFUND = /\$12\.30/
const REFUND_PROMISE = /You will receive/
const SUBTOTAL_AMOUNT = /\$30\.69/
const NO_REFUND_AMOUNT = /\$0\.00/

const mock = vi.hoisted(() => ({
  userId: "renter" as string | undefined,
  reservation: {} as Record<string, unknown>,
  payments: undefined as Record<string, unknown>[] | undefined,
  queries: vi.fn(),
  mutate: vi.fn(),
  createPaymentIntent: vi.fn(),
  push: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: !!mock.userId,
    user: mock.userId ? { id: mock.userId } : null,
  }),
}))
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} role="img" />,
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("reservationId=booking"),
  useRouter: () => ({ push: mock.push }),
}))
vi.mock("convex/react", () => ({
  useMutation: () => mock.mutate,
  useAction: () => mock.createPaymentIntent,
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(fn)
    mock.queries(name, args)
    if (args === "skip") return
    if (name === "reservations:getById") return mock.reservation
    if (name === "stripe:getUserPayments") return mock.payments
    if (name === "reservations:getByUser") return [mock.reservation]
    return []
  },
}))
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => Promise.resolve({}) }))
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
  PaymentElement: () => <div>Secure card form</div>,
  useStripe: () => ({ confirmPayment: vi.fn() }),
  useElements: () => ({ submit: vi.fn() }),
}))

const reservation = {
  _id: "booking",
  renterId: "renter",
  ownerId: "owner",
  paymentId: "payment",
  status: "confirmed",
  paymentStatus: "paid",
  startDate: "2031-01-04",
  endDate: "2031-01-06",
  totalDays: 3,
  dailyRate: 1023,
  totalAmount: 3069,
  vehicle: {
    _id: "vehicle",
    year: 2026,
    make: "Synthetic",
    model: "Roadster",
    images: [],
  },
  renter: { name: "Synthetic Renter" },
}
const payment = {
  _id: "payment",
  reservationId: "booking",
  renterId: "renter",
  ownerId: "owner",
  currency: "usd",
  amount: 3069,
  processingFee: 123,
  status: "succeeded",
}
const tripProps = {
  reservationId: "booking",
  paymentId: "payment",
  renterId: "renter",
  vehicleId: "vehicle",
  vehicleName: "Synthetic Roadster",
  vehicleImage: "",
  vehicleYear: 2026,
  vehicleMake: "Synthetic",
  vehicleModel: "Roadster",
  location: "Synthetic Track",
  startDate: reservation.startDate,
  endDate: reservation.endDate,
  totalDays: 3,
  dailyRate: 1023,
  totalAmount: 3069,
  cancellationPolicy: "moderate" as const,
  status: "confirmed" as const,
}
const summaryProps = { reservationId: "booking", paymentId: "payment", renterId: "renter" }

beforeEach(() => {
  mock.userId = "renter"
  mock.reservation = { ...reservation }
  mock.payments = [{ ...payment }]
  mock.queries.mockClear()
  mock.mutate.mockReset()
  mock.push.mockReset()
  mock.createPaymentIntent.mockReset().mockResolvedValue({
    clientSecret: "synthetic_secret",
    amount: 3069,
    processingFee: 123,
    chargeAmount: 3192,
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it("shows the same non-round multiday rental subtotal in request, trip, success, and host views", () => {
  for (const view of [
    <RequestSentPage key="request" />,
    <TripCard key="trip" {...tripProps} />,
    <CheckoutSuccessPage key="success" />,
  ]) {
    const result = render(view)
    expect(screen.getAllByText("$30.69").length).toBeGreaterThan(0)
    expect(screen.getAllByText(SUBTOTAL_LABEL).length).toBeGreaterThan(0)
    expect(screen.queryByText("$3,069")).toBeNull()
    result.unmount()
  }
  mock.userId = "owner"
  render(<HostReservationsPage />)
  expect(screen.getAllByText("$30.69")).toHaveLength(2)
  expect(screen.queryByText("$31")).toBeNull()
})

it("keeps daily rate and rental subtotal separate from the charged card total", () => {
  render(<TripCard {...tripProps} />)
  expect(screen.getByText(DAILY_RATE)).toBeInTheDocument()
  expect(screen.getByText("Card processing fee")).toBeInTheDocument()
  expect(screen.getByText("$1.23")).toBeInTheDocument()
  expect(screen.getByText("Total charged")).toBeInTheDocument()
  expect(screen.getByText("$31.92")).toBeInTheDocument()
  expect(screen.queryByText("Total refunded")).toBeNull()
})

it("shows the same subtotal, fee, and exact total on the payment screen without rescaling the request", async () => {
  mock.reservation = { ...reservation, status: "approved", paymentStatus: "pending" }
  render(<PayPage />)
  expect(await screen.findByRole("button", { name: "Pay $31.92" })).toBeInTheDocument()
  expect(screen.getAllByText("$30.69").length).toBeGreaterThan(0)
  expect(screen.getAllByText("$1.23").length).toBeGreaterThan(0)
  expect(screen.getByText("$10.23/day")).toBeInTheDocument()
  expect(mock.createPaymentIntent).toHaveBeenCalledWith({ reservationId: "booking", amount: 3069 })
  expect(mock.mutate).not.toHaveBeenCalled()
})

it("shows stored daily add-ons for each rental day and one-time add-ons once", async () => {
  mock.reservation = {
    ...reservation,
    status: "approved",
    paymentStatus: "pending",
    totalAmount: 3793,
    addOns: [
      { name: "Helmet", price: 125, priceType: "daily" },
      { name: "Delivery", price: 349, priceType: "one-time" },
    ],
  }
  mock.createPaymentIntent.mockResolvedValue({
    clientSecret: "synthetic_secret",
    amount: 3793,
    processingFee: 147,
    chargeAmount: 3940,
  })
  render(<PayPage />)
  expect(await screen.findByRole("button", { name: "Pay $39.40" })).toBeInTheDocument()
  expect(screen.getByText("Helmet").parentElement).toHaveTextContent("$3.75")
  expect(screen.getByText("Delivery").parentElement).toHaveTextContent("$3.49")
  expect(screen.getAllByText("$37.93").length).toBeGreaterThan(0)
  expect(mock.createPaymentIntent).toHaveBeenCalledWith({ reservationId: "booking", amount: 3793 })
  expect(mock.mutate).not.toHaveBeenCalled()
})

it("keeps the final amount pending until payment initialization returns the charge", () => {
  mock.reservation = { ...reservation, status: "approved", paymentStatus: "pending" }
  mock.createPaymentIntent.mockImplementation(
    () =>
      new Promise<never>(() => {
        // Simulate a payment service response that has not arrived.
      })
  )
  render(<PayPage />)
  expect(screen.getByText("$30.69")).toBeInTheDocument()
  expect(screen.getByText("Total due").parentElement).toHaveTextContent("Calculating…")
  expect(screen.getByText("Total due").parentElement).not.toHaveTextContent("$30.69")
  expect(screen.queryByRole("button", { name: "Pay $30.69" })).toBeNull()
})

it("does not substitute the rental subtotal for a charge when initialization fails", async () => {
  mock.reservation = { ...reservation, status: "approved", paymentStatus: "pending" }
  mock.createPaymentIntent
    .mockReset()
    .mockRejectedValueOnce(new Error("Payment service unavailable"))
    .mockImplementation(
      () =>
        new Promise<never>(() => {
          // Existing retry behavior is outside this display regression's scope.
        })
    )
  render(<PayPage />)
  expect(await screen.findByText("Unavailable")).toBeInTheDocument()
  expect(screen.getByText("$30.69")).toBeInTheDocument()
  expect(screen.getByText("Total due").parentElement).not.toHaveTextContent("$30.69")
  expect(screen.queryByRole("button", { name: "Pay $30.69" })).toBeNull()
})

it.each([
  "pending",
  "processing",
  "failed",
  "cancelled",
])("does not claim a captured charge or refund for a %s payment", (status) => {
  mock.payments = [{ ...payment, status, refundAmount: 1000 }]
  render(<RentalPaymentSummary {...summaryProps} />)
  expect(screen.queryByText("Total charged")).toBeNull()
  expect(screen.queryByText("Total refunded")).toBeNull()
})

it("does not invent amounts while payment data is loading or absent", () => {
  mock.payments = undefined
  const result = render(<RentalPaymentSummary {...summaryProps} />)
  expect(screen.queryByText("Total charged")).toBeNull()
  mock.payments = []
  result.rerender(<RentalPaymentSummary {...summaryProps} />)
  expect(screen.queryByText("Total charged")).toBeNull()
  mock.payments = [{ ...payment }]
  result.rerender(<RentalPaymentSummary {...summaryProps} paymentId={undefined} />)
  expect(screen.queryByText("Total charged")).toBeNull()
})

it.each([
  { _id: "another-payment" },
  { reservationId: "another-booking" },
  { renterId: "another-renter" },
  { currency: "eur" },
])("does not present an unrelated or non-USD payment as this booking's charge: %j", (change) => {
  mock.payments = [{ ...payment, ...change }]
  render(<RentalPaymentSummary {...summaryProps} />)
  expect(screen.queryByText("Total charged")).toBeNull()
  expect(screen.queryByText("$31.92")).toBeNull()
})

it("skips renter billing queries for anonymous and unrelated viewers", () => {
  for (const userId of [undefined, "unrelated"]) {
    mock.userId = userId
    mock.queries.mockClear()
    const result = render(<RentalPaymentSummary {...summaryProps} />)
    expect(mock.queries).toHaveBeenCalledWith("stripe:getUserPayments", "skip")
    expect(screen.queryByText("Total charged")).toBeNull()
    result.unmount()
  }
})

it.each([
  ["partially_refunded", 1535, "$15.35"],
  ["refunded", 3199, "$31.99"],
])("uses captured totals and cumulative successful refunds for %s payments", (status, refundAmount, refundLabel) => {
  mock.payments = [{ ...payment, status, capturedAmount: 3199, refundAmount }]
  render(<RentalPaymentSummary {...summaryProps} />)
  expect(screen.getByText("Total charged")).toBeInTheDocument()
  expect(screen.getAllByText("$31.99").length).toBeGreaterThan(0)
  expect(screen.getByText("Total refunded")).toBeInTheDocument()
  expect(screen.getAllByText(refundLabel).length).toBeGreaterThan(0)
})

it("supports legacy zero-fee payment records without recomputing today's card fee", () => {
  mock.payments = [{ ...payment, processingFee: undefined }]
  render(<RentalPaymentSummary {...summaryProps} />)
  expect(screen.getByText("Total charged")).toBeInTheDocument()
  expect(screen.getAllByText("$30.69").length).toBeGreaterThan(0)
  expect(screen.queryByText("$31.92")).toBeNull()
})

it("estimates renter refunds from rental cents after prior refunds, excluding card fees", () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2031-01-01T12:00:00Z"))
  mock.payments = [{ ...payment, status: "partially_refunded", refundAmount: 305 }]
  render(<TripCard {...tripProps} />)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.getByText("Estimated rental refund")).toBeInTheDocument()
  expect(screen.getByText(PARTIAL_REFUND)).toBeInTheDocument()
  expect(screen.queryByText(REFUND_PROMISE)).toBeNull()
  expect(mock.mutate).not.toHaveBeenCalled()
})

it("leaves the cancellation estimate unavailable while the payment ledger is loading", () => {
  mock.payments = undefined
  render(<TripCard {...tripProps} />)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.getByText("Refund estimate unavailable.")).toBeInTheDocument()
  expect(screen.queryByText("Total charged")).toBeNull()
  expect(screen.queryByText(REFUND_PROMISE)).toBeNull()
})

it("uses the listing cancellation policy without changing the rental-day count", () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2031-01-01T12:00:00Z"))
  const result = render(<TripCard {...tripProps} cancellationPolicy="flexible" />)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.getAllByText(SUBTOTAL_AMOUNT).length).toBeGreaterThan(1)
  result.unmount()
  render(<TripCard {...tripProps} cancellationPolicy="strict" />)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.getByText(NO_REFUND_AMOUNT)).toBeInTheDocument()
})
