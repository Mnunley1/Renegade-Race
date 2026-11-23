import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import CheckoutPage from "@/app/checkout/page"
import { Navigation } from "@/components/navigation"
import { inclusiveRentalDays, isValidRentalDuration } from "@/lib/date-utils"
import { calculateRentalEstimate, formatRentalUsd } from "@/lib/rental-checkout"
import { rentalDraftKey } from "@/lib/rental-draft"

const mock = vi.hoisted(() => ({
  params: "",
  signedIn: true,
  userId: "renter",
  vehicle: undefined as typeof vehicle | undefined,
  createReservation: vi.fn(),
  push: vi.fn(),
  availability: [] as { date: string; isAvailable: boolean }[] | undefined,
  reservations: [] as { status: string; startDate: string; endDate: string }[] | undefined,
  range: { isAvailable: true } as { isAvailable: boolean } | undefined,
  checkRange: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
  useUser: () => ({
    isLoaded: true,
    isSignedIn: mock.signedIn,
    user: mock.signedIn ? { id: mock.userId } : null,
  }),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(mock.params),
  useRouter: () => ({ push: mock.push }),
}))
vi.mock("convex/react", () => ({
  useMutation: () => mock.createReservation,
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return
    switch (getFunctionName(fn)) {
      case "vehicles:getById":
        return mock.vehicle ?? vehicle
      case "availability:getByVehicle":
        return mock.availability
      case "reservations:listActiveForVehicle":
        return mock.reservations
      case "availability:checkAvailability":
        mock.checkRange(args)
        return mock.range
      default:
        return
    }
  },
}))
vi.mock("@workspace/ui/components/calendar", () => ({
  Calendar: ({
    disabled,
    onSelect,
  }: {
    disabled: (date: Date) => boolean
    onSelect: (date: Date) => void
  }) => (
    <div>
      {["2099-08-01", "2099-08-02", "2099-08-03"].map((day) => (
        <button
          disabled={disabled(new Date(`${day}T00:00:00`))}
          key={day}
          onClick={() => onSelect(new Date(`${day}T00:00:00`))}
          type="button"
        >
          Calendar {day}
        </button>
      ))}
    </div>
  ),
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
  sessionStorage.clear()
  mock.signedIn = true
  mock.userId = "renter"
  mock.vehicle = undefined
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-01"
  mock.createReservation.mockReset().mockResolvedValue("booking")
  mock.push.mockReset()
  mock.availability = []
  mock.reservations = []
  mock.range = { isAvailable: true }
  mock.checkRange.mockReset()
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

it("allows an available same-day request and submits the displayed add-on pricing", async () => {
  render(<CheckoutPage />)
  expect(await screen.findByRole("button", { name: "1 day" })).toBeInTheDocument()
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

function chooseTimes() {
  const times = screen.getAllByRole("combobox")
  times.forEach((time, index) => {
    fireEvent.change(time, { target: { value: index === 0 ? "08:00" : "18:00" } })
  })
}

it("checks the entire selected range and blocks a host-blocked middle day", async () => {
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-03"
  mock.availability = [{ date: "2099-08-02", isAvailable: false }]
  mock.range = { isAvailable: false }
  render(<CheckoutPage />)
  await screen.findByRole("button", { name: "3 days" })
  chooseTimes()
  expect(mock.checkRange).toHaveBeenCalledWith({
    vehicleId: "vehicle",
    startDate: "2099-08-01",
    endDate: "2099-08-03",
  })
  expect(screen.getByRole("status")).toHaveTextContent("These dates are unavailable")
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "3 days" })).toBeDisabled()
  expect(mock.createReservation).not.toHaveBeenCalled()
})

it.each(["approved", "confirmed"])("disables %s occupied dates", async (status) => {
  mock.reservations = [{ status, startDate: "2099-08-01", endDate: "2099-08-02" }]
  mock.range = { isAvailable: false }
  render(<CheckoutPage />)
  await screen.findByRole("button", { name: "1 day" })
  chooseTimes()
  fireEvent.click(screen.getByLabelText("Pickup Date"))
  expect(screen.getByRole("button", { name: "Calendar 2099-08-01" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Calendar 2099-08-02" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Calendar 2099-08-03" })).toBeEnabled()
  expect(mock.createReservation).not.toHaveBeenCalled()
})

it("allows a competing pending request without treating its dates as occupied", async () => {
  mock.reservations = [{ status: "pending", startDate: "2099-08-01", endDate: "2099-08-02" }]
  render(<CheckoutPage />)
  await screen.findByRole("button", { name: "1 day" })
  chooseTimes()
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeEnabled()
  fireEvent.click(screen.getByLabelText("Pickup Date"))
  expect(screen.getByRole("button", { name: "Calendar 2099-08-01" })).toBeEnabled()
})

it("waits for availability and blocks submission if the selected range becomes unavailable", async () => {
  mock.range = undefined
  const page = render(<CheckoutPage />)
  await screen.findByRole("button", { name: "1 day" })
  chooseTimes()
  expect(screen.getByRole("status")).toHaveTextContent("Checking date availability")
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeDisabled()
  mock.range = { isAvailable: true }
  page.rerender(<CheckoutPage />)
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeEnabled()
  mock.range = { isAvailable: false }
  page.rerender(<CheckoutPage />)
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeDisabled()
  expect(mock.createReservation).not.toHaveBeenCalled()
})

it("keeps submission disabled until calendar records are loaded", async () => {
  mock.reservations = undefined
  render(<CheckoutPage />)
  await screen.findByRole("button", { name: "1 day" })
  chooseTimes()
  expect(screen.getByRole("status")).toHaveTextContent("Checking date availability")
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeDisabled()
})

it("shows the two-day total including daily add-ons", async () => {
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-02"
  render(<CheckoutPage />)
  expect(await screen.findByRole("button", { name: "2 days" })).toBeInTheDocument()
  expect(screen.getByText("$285.00")).toBeInTheDocument()
})

it("does not submit a four-day range supplied through the URL", async () => {
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-04"
  render(<CheckoutPage />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Those dates are not supported")
  expect(screen.getByRole("button", { name: "1 day" })).toHaveAttribute("aria-pressed", "false")
  expect(screen.getByRole("button", { name: "3 days" })).toHaveAttribute("aria-pressed", "false")
  const times = screen.getAllByRole("combobox")
  expect(times).toHaveLength(2)
  times.forEach((time, index) => {
    fireEvent.change(time, { target: { value: index === 0 ? "08:00" : "18:00" } })
  })
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeDisabled()
  expect(mock.createReservation).not.toHaveBeenCalled()
})

it("restores a guest draft after sign-in without submitting and revalidates availability", async () => {
  mock.signedIn = false
  mock.vehicle = {
    ...vehicle,
    addOns: [
      ...vehicle.addOns,
      { name: "Gloves", price: 500, priceType: "one-time", isRequired: false },
    ],
  }
  const page = render(<CheckoutPage />)
  chooseTimes()
  fireEvent.click(screen.getByRole("button", { name: "2 days" }))
  fireEvent.click(screen.getByText("Gloves"))
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Meet at the paddock" } })
  fireEvent.click(screen.getByRole("button", { name: "Sign in to continue" }))
  expect(mock.push).toHaveBeenCalledWith(
    "/sign-in?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1"
  )
  expect(mock.createReservation).not.toHaveBeenCalled()
  const saved = JSON.parse(sessionStorage.getItem(rentalDraftKey("vehicle")) ?? "null")
  expect(saved).toMatchObject({
    startDate: "2099-08-01",
    duration: 2,
    selectedAddOnNames: ["Helmet", "Delivery", "Gloves"],
    renterMessage: "Meet at the paddock",
    pickupTime: "08:00",
    dropoffTime: "18:00",
  })
  expect(saved).not.toHaveProperty("price")
  page.unmount()
  mock.signedIn = true
  mock.params = "vehicleId=vehicle&resume=1"
  mock.range = { isAvailable: false }
  const restored = render(<CheckoutPage />)
  expect(screen.getByRole("textbox")).toHaveValue("Meet at the paddock")
  expect(screen.getByRole("button", { name: "2 days" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeDisabled()
  expect(mock.checkRange).toHaveBeenLastCalledWith({
    vehicleId: "vehicle",
    startDate: "2099-08-01",
    endDate: "2099-08-02",
  })
  expect(mock.createReservation).not.toHaveBeenCalled()
  mock.range = { isAvailable: true }
  restored.rerender(<CheckoutPage />)
  expect(screen.getByRole("button", { name: "Submit Request" })).toBeEnabled()
  expect(mock.createReservation).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Submit Request" }))
  await waitFor(() => expect(mock.createReservation).toHaveBeenCalledTimes(1))
  expect(mock.createReservation).toHaveBeenCalledWith(
    expect.objectContaining({
      startDate: "2099-08-01",
      endDate: "2099-08-02",
      renterMessage: "Meet at the paddock",
      addOns: expect.arrayContaining([expect.objectContaining({ name: "Gloves", price: 500 })]),
    })
  )
  await waitFor(() => expect(sessionStorage.getItem(rentalDraftKey("vehicle"))).toBeNull())
})

it("reconciles restored add-ons and prices against the live listing", () => {
  sessionStorage.setItem(
    rentalDraftKey("vehicle"),
    JSON.stringify({
      version: 1,
      vehicleId: "vehicle",
      ownerId: null,
      savedAt: Date.now(),
      startDate: "2099-08-01",
      duration: 1,
      pickupTime: "08:00",
      dropoffTime: "18:00",
      selectedAddOnNames: ["Gloves", "Removed"],
      renterMessage: "",
      price: 1,
      addOns: [{ name: "Gloves", price: 1 }],
    })
  )
  mock.params = "vehicleId=vehicle&resume=1"
  mock.vehicle = {
    ...vehicle,
    dailyRate: 12000,
    addOns: [
      ...vehicle.addOns,
      { name: "Gloves", price: 750, priceType: "one-time", isRequired: false },
    ],
  }
  const page = render(<CheckoutPage />)
  expect(screen.getByText("$187.50")).toBeInTheDocument()
  expect(
    screen.getByText(
      "An add-on you selected is no longer available and has been removed from the quote."
    )
  ).toBeInTheDocument()
  mock.vehicle = {
    ...mock.vehicle,
    addOns: [
      ...mock.vehicle.addOns.map((addOn) =>
        addOn.name === "Gloves" ? { ...addOn, price: 1000 } : addOn
      ),
      { name: "Required inspection", price: 100, priceType: "one-time", isRequired: true },
    ],
  }
  page.rerender(<CheckoutPage />)
  expect(screen.getByText("$191.00")).toBeInTheDocument()
  expect(screen.getAllByText("Gloves")).toHaveLength(2)
  expect(mock.createReservation).not.toHaveBeenCalled()
})

it("keeps choices on screen and explains a blocked browser-storage handoff", () => {
  mock.signedIn = false
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage denied")
  })
  render(<CheckoutPage />)
  chooseTimes()
  fireEvent.click(screen.getByRole("button", { name: "Sign in to continue" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Enable session storage")
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.createReservation).not.toHaveBeenCalled()
  storage.mockRestore()
})

it("keeps the selected duration when changing pickup and derives the inclusive dropoff", () => {
  mock.params = "vehicleId=vehicle&startDate=2099-08-01&endDate=2099-08-02"
  render(<CheckoutPage />)
  fireEvent.click(screen.getByLabelText("Pickup Date"))
  fireEvent.click(screen.getByRole("button", { name: "Calendar 2099-08-03" }))
  expect(screen.getByRole("button", { name: "2 days" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByText("Dropoff date: Aug 4, 2099")).toBeInTheDocument()
  expect(mock.checkRange).toHaveBeenLastCalledWith({
    vehicleId: "vehicle",
    startDate: "2099-08-03",
    endDate: "2099-08-04",
  })
})

it("does not carry a previous renter's message across an account switch", () => {
  const page = render(<CheckoutPage />)
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Private draft from renter one" },
  })
  expect(JSON.parse(sessionStorage.getItem(rentalDraftKey("vehicle")) ?? "null").ownerId).toBe(
    "renter"
  )
  mock.userId = "another-renter"
  page.rerender(<CheckoutPage />)
  expect(screen.getByRole("textbox")).toHaveValue("")
  expect(JSON.parse(sessionStorage.getItem(rentalDraftKey("vehicle")) ?? "null")).toMatchObject({
    ownerId: "another-renter",
    renterMessage: "",
  })
  expect(mock.createReservation).not.toHaveBeenCalled()
})

it.each([
  ["Log in", "/sign-in", false],
  ["Sign up", "/sign-up", false],
  ["Sign In", "/sign-in", true],
  ["Sign Up", "/sign-up", true],
])("preserves the vehicle and draft through the header %s action", (label, authPath, mobile) => {
  mock.signedIn = false
  window.history.replaceState(null, "", `/checkout?${mock.params}`)
  const page = render(
    <>
      <Navigation />
      <CheckoutPage />
    </>
  )
  chooseTimes()
  fireEvent.click(screen.getByRole("button", { name: "2 days" }))
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Header auth draft" } })
  if (mobile) fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
  const authLink = screen.getByRole("link", { name: label })
  const target = new URL(authLink.getAttribute("href")!, "https://app.example")
  expect(target.pathname).toBe(authPath)
  const returnPath = target.searchParams.get("redirect_url")!
  expect(new URL(returnPath, "https://app.example").searchParams.get("vehicleId")).toBe("vehicle")
  expect(new URL(returnPath, "https://app.example").searchParams.get("resume")).toBe("1")
  fireEvent.click(authLink)
  if (mobile) expect(screen.queryByRole("dialog")).toBeNull()
  expect(mock.push).toHaveBeenCalledWith(`${target.pathname}${target.search}`)
  expect(mock.createReservation).not.toHaveBeenCalled()
  page.unmount()
  mock.signedIn = true
  mock.params = new URL(returnPath, "https://app.example").search.slice(1)
  render(<CheckoutPage />)
  expect(screen.getByRole("textbox")).toHaveValue("Header auth draft")
  expect(screen.getByRole("button", { name: "2 days" })).toHaveAttribute("aria-pressed", "true")
  expect(mock.createReservation).not.toHaveBeenCalled()
  window.history.replaceState(null, "", "/")
})
