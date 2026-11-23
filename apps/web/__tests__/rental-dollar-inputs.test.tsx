import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import AmenitiesPage from "@/app/host/onboarding/amenities/page"
import OnboardingVehiclePage from "@/app/host/onboarding/vehicle/page"
import EditVehiclePage from "@/app/host/vehicles/[id]/edit/page"
import CreateVehiclePage from "@/app/host/vehicles/new/page"
import { OnboardingFlow } from "@/components/onboarding-flow"

const mock = vi.hoisted(() => ({
  vehicle: {} as Record<string, unknown>,
  draft: undefined as Record<string, unknown> | undefined,
  mutate: vi.fn(),
  push: vi.fn(),
  error: vi.fn(),
}))
const tracks: unknown[] = []
const onboardingStatus = { status: "completed" }
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: { id: "host" } }) }))
vi.mock("@convex-dev/r2/react", () => ({ useUploadFile: () => vi.fn() }))
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "vehicle" }),
  useRouter: () => ({ push: mock.push }),
}))
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }))
vi.mock("@/lib/feature-flags", () => ({ areVehiclePhotosRequired: () => false }))
vi.mock("sonner", () => ({ toast: { error: mock.error, success: vi.fn() } }))
vi.mock("convex/react", () => ({
  useMutation: () => mock.mutate,
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(fn)) {
      case "vehicles:getById":
        return mock.vehicle
      case "users:getOnboardingDraft":
        return mock.draft
      case "users:getHostOnboardingStatus":
        return onboardingStatus
      default:
        return tracks
    }
  },
}))
// Keep field state and handlers real while making select interactions native in jsdom.
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
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}))

const vehicle = {
  _id: "vehicle",
  make: "Mazda",
  model: "Synthetic",
  year: 2026,
  dailyRate: 1023,
  description: "Synthetic rental",
  horsepower: 200,
  transmission: "Manual",
  drivetrain: "RWD",
  images: [],
  address: { zipCode: "10001" },
  addOns: [{ name: "Helmet", price: 237, priceType: "daily", isRequired: true }],
}
const draft = {
  vehicleData: { ...vehicle, amenities: ["Air Conditioning"] },
  address: { street: "1 Test Lane", city: "Test", state: "NY", zipCode: "10001" },
}
const rate = () => screen.getByLabelText("Daily Rate ($) *")
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
function submitEdit(container: HTMLElement) {
  const form = container.querySelector("form")
  if (!form) throw new Error("Expected the vehicle edit form")
  fireEvent.submit(form)
}
beforeEach(() => {
  mock.vehicle = { ...vehicle }
  mock.draft = { ...draft }
  mock.mutate.mockReset().mockResolvedValue(undefined)
  mock.push.mockReset()
  mock.error.mockReset()
})
afterEach(cleanup)

describe("rental dollar input boundaries", () => {
  it.each([
    "206",
    "10000",
    "2026.5",
    "",
  ])("rejects invalid changed vehicle year %s without writing", (value) => {
    const { container } = render(<EditVehiclePage />)
    change("Year *", value)
    submitEdit(container)
    expect(mock.mutate).not.toHaveBeenCalled()
    expect(mock.error).toHaveBeenCalledWith("Enter a four-digit vehicle year")
  })
  it("allows unrelated edits to an unchanged invalid legacy year", async () => {
    mock.vehicle = { ...vehicle, year: 206 }
    const { container } = render(<EditVehiclePage />)
    change("Description (Optional)", "New description")
    submitEdit(container)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].year).toBeUndefined()
  })
  it.each([
    OnboardingVehiclePage,
    OnboardingFlow,
  ])("rejects changed invalid years in both draft forms", (Form) => {
    render(<Form />)
    change("Year *", "206")
    expect(screen.getByRole("button", { name: "Continue to Photos" })).toBeDisabled()
    expect(mock.mutate).not.toHaveBeenCalled()
  })
  it("does not publish a new listing from an invalid legacy draft year", () => {
    mock.draft = { ...draft, vehicleData: { ...draft.vehicleData, year: 206 } }
    render(<OnboardingFlow initialStep={5} />)
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: "Submit Listing" }))
    expect(mock.error).toHaveBeenCalledWith("Enter a four-digit vehicle year")
    expect(mock.mutate).not.toHaveBeenCalled()
  })
  it.each([
    OnboardingVehiclePage,
    OnboardingFlow,
  ])("preserves a zero legacy year when hydrating and saving unrelated draft fields", async (Form) => {
    mock.draft = { ...draft, vehicleData: { ...draft.vehicleData, year: 0 } }
    render(<Form />)
    expect(screen.getByLabelText("Year *")).toHaveValue(0)
    change("Description *", "Unrelated description")
    fireEvent.click(screen.getByRole("button", { name: "Continue to Photos" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].vehicleData.year).toBe(0)
  })
  it("loads $10.23 and $2.37 from cents and preserves untouched edit values", async () => {
    const { container } = render(<EditVehiclePage />)
    expect(rate()).toHaveValue(10.23)
    expect(screen.getByText("$2.37/day")).toBeInTheDocument()
    submitEdit(container)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0]).toMatchObject({
      dailyRate: 1023,
      addOns: vehicle.addOns,
    })
  })

  it("preserves an existing zero rate on an unrelated edit", async () => {
    mock.vehicle = { ...vehicle, dailyRate: 0 }
    const { container } = render(<EditVehiclePage />)
    submitEdit(container)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].dailyRate).toBe(0)
  })

  it("converts changed rate and add-on dollar inputs to rounded cents", async () => {
    const { container } = render(<EditVehiclePage />)
    change("Daily Rate ($) *", "10.235")
    fireEvent.click(screen.getByRole("button", { name: "Edit Helmet" }))
    expect(screen.getByLabelText("Price ($) *")).toHaveValue(2.37)
    change("Price ($) *", "1.005")
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Save Changes" })
        .find((button) => button.getAttribute("type") === "button") as HTMLElement
    )
    submitEdit(container)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0]).toMatchObject({
      dailyRate: 1024,
      addOns: [{ name: "Helmet", price: 101 }],
    })
  })

  it("does not repair fractional historical cents during an unrelated edit", async () => {
    mock.vehicle = { ...vehicle, dailyRate: 10.23, addOns: [{ name: "Legacy", price: 2.37 }] }
    const { container } = render(<EditVehiclePage />)
    expect(rate()).toHaveValue(0.1023)
    fireEvent.click(screen.getByRole("button", { name: "Edit Legacy" }))
    expect(screen.getByLabelText("Price ($) *")).toHaveValue(2.37 / 100)
    change("Description (Optional)", "Updated description")
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Save Changes" })
        .find((button) => button.getAttribute("type") === "button") as HTMLElement
    )
    submitEdit(container)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0]).toMatchObject({
      dailyRate: 10.23,
      addOns: [{ price: 2.37 }],
    })
  })

  it.each([
    "",
    "-10",
    "0",
    "9007199254740991",
  ])("rejects invalid changed rate %s without writing", (value) => {
    const { container } = render(<EditVehiclePage />)
    change("Daily Rate ($) *", value)
    submitEdit(container)
    expect(mock.mutate).not.toHaveBeenCalled()
    expect(mock.error).toHaveBeenCalled()
  })

  it("accepts a free add-on and rejects a negative add-on", async () => {
    const { container } = render(<EditVehiclePage />)
    change("Add-on Name *", "Free helmet")
    change("Price ($) *", "-1")
    fireEvent.click(screen.getByRole("button", { name: "Add Add-on" }))
    expect(mock.error).toHaveBeenCalled()
    change("Price ($) *", "0")
    fireEvent.click(screen.getByRole("button", { name: "Add Add-on" }))
    submitEdit(container)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].addOns).toContainEqual(
      expect.objectContaining({ name: "Free helmet", price: 0 })
    )
  })

  it("roundtrips the onboarding rate without erasing existing add-ons", async () => {
    render(<OnboardingVehiclePage />)
    expect(rate()).toHaveValue(10.23)
    fireEvent.click(screen.getByRole("button", { name: "Continue to Photos" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].vehicleData).toMatchObject({
      dailyRate: 1023,
      addOns: vehicle.addOns,
    })
  })

  it("converts a newly entered onboarding rate to cents", async () => {
    render(<OnboardingVehiclePage />)
    change("Daily Rate ($) *", "12.345")
    fireEvent.click(screen.getByRole("button", { name: "Continue to Photos" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].vehicleData.dailyRate).toBe(1235)
  })

  it("preserves fractional legacy draft prices when untouched", async () => {
    mock.draft = { ...draft, vehicleData: { ...draft.vehicleData, dailyRate: 10.23 } }
    render(<OnboardingVehiclePage />)
    fireEvent.click(screen.getByRole("button", { name: "Continue to Photos" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].vehicleData.dailyRate).toBe(10.23)
  })

  it("hydrates late-loading draft add-ons and saves new dollar prices as cents", async () => {
    mock.draft = undefined
    const { rerender } = render(<AmenitiesPage />)
    mock.draft = { ...draft }
    rerender(<AmenitiesPage />)
    expect(screen.getByText("$2.37/day")).toBeInTheDocument()
    change("Add-on Name", "Fuel")
    change("Price ($)", "10.23")
    fireEvent.click(screen.getByRole("button", { name: "Add Add-on" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue to Availability" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].vehicleData.addOns).toEqual([
      expect.objectContaining({ name: "Helmet", price: 237 }),
      expect.objectContaining({ name: "Fuel", price: 1023 }),
    ])
  })

  it("converts the mounted onboarding flow rate and retains existing cent add-ons", async () => {
    render(<OnboardingFlow />)
    expect(rate()).toHaveValue(10.23)
    change("Daily Rate ($) *", "10.235")
    fireEvent.click(screen.getByRole("button", { name: "Continue to Photos" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].vehicleData).toMatchObject({
      dailyRate: 1024,
      addOns: vehicle.addOns,
    })
  })

  it("keeps the mounted onboarding draft and final create payload in cents", async () => {
    render(<OnboardingFlow initialStep={5} />)
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: "Submit Listing" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0]).toMatchObject({
      dailyRate: 1023,
      addOns: vehicle.addOns,
    })
  })

  it("preserves absent legacy add-on cadence when loading and saving amenities", async () => {
    mock.draft = {
      ...draft,
      vehicleData: { ...draft.vehicleData, addOns: [{ name: "Legacy", price: 2.37 }] },
    }
    render(<AmenitiesPage />)
    expect(screen.getByText("$0.02 one-time")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue to Availability" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0].vehicleData.addOns).toEqual([
      { name: "Legacy", price: 2.37 },
    ])
  })

  it("submits new listing rates and add-ons as cents once", async () => {
    render(<CreateVehiclePage />)
    for (const [label, value] of [
      ["Make *", "Mazda"],
      ["Model *", "Synthetic"],
      ["Daily Rate ($) *", "10.23"],
      ["Horsepower *", "200"],
      ["Description *", "Synthetic listing"],
      ["ZIP Code *", "10001"],
    ])
      change(label as string, value as string)
    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[1] as HTMLElement, { target: { value: "manual" } })
    fireEvent.change(selects[2] as HTMLElement, { target: { value: "rwd" } })
    fireEvent.click(screen.getByRole("button", { name: "Continue to Photos" }))
    fireEvent.click(screen.getByRole("button", { name: "Skip Photos" }))
    change("Add-on Name", "Helmet")
    change("Price ($)", "2.375")
    fireEvent.click(screen.getByRole("button", { name: "Add Add-on" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue to Availability" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue to Safety" }))
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: "Submit Listing" }))
    await waitFor(() => expect(mock.mutate).toHaveBeenCalled())
    expect(mock.mutate.mock.calls[0]?.[0]).toMatchObject({
      dailyRate: 1023,
      addOns: [{ name: "Helmet", price: 238 }],
    })
  })

  it("keeps new listing rates in dollars while validating before moving to photos", () => {
    render(<CreateVehiclePage />)
    change("Daily Rate ($) *", "10.23")
    expect(rate()).toHaveValue(10.23)
    change("Daily Rate ($) *", "-1")
    expect(screen.getByRole("button", { name: "Continue to Photos" })).toBeDisabled()
    expect(mock.mutate).not.toHaveBeenCalled()
  })
})
