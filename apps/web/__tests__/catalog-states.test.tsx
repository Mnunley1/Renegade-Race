import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VehicleDetailsPage from "@/app/vehicles/[id]/page"
import VehiclesPage from "@/app/vehicles/page"
import { VehicleCard } from "@/components/vehicle-card"

const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
  vehicles: undefined as Record<string, unknown>[] | undefined,
  tracks: [] as unknown[] | undefined,
  stats: {} as Record<string, { averageRating: number; totalReviews: number }> | undefined,
  detail: undefined as Record<string, unknown> | undefined,
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: true, user: { id: "renter" } }),
}))
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "vehicle" }),
  useSearchParams: () => state.params,
  useRouter: () => ({ push: state.push, replace: state.replace }),
}))
vi.mock("next/head", () => ({ default: () => null }))
vi.mock("@/components/vehicle-gallery", () => ({ VehicleGallery: () => null }))
vi.mock("@/app/vehicles/recently-viewed", () => ({ RecentlyViewed: () => null }))
vi.mock("@/app/vehicles/compare-bar", () => ({ CompareBar: () => null }))
vi.mock("@/app/vehicles/compare-modal", () => ({ CompareModal: () => null }))
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn().mockResolvedValue(null),
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(fn)) {
      case "tracks:getAll":
        return state.tracks
      case "vehicles:searchWithAvailability":
        return state.vehicles
      case "vehicles:getById":
        return state.detail
      case "reviews:getVehicleStatsBatch":
        return state.stats
      case "reviews:getByVehicle":
        return []
      case "reviews:getVehicleStats":
        return { averageRating: 0, totalReviews: 0 }
      default:
        return null
    }
  },
}))
const vehicle = {
  _id: "vehicle",
  ownerId: "owner",
  owner: { name: "Host" },
  year: 2026,
  make: "Synthetic",
  model: "Test Car",
  dailyRate: 12345,
  track: { name: "Test Track" },
  images: [],
  description: "Synthetic listing",
  isActive: true,
  isApproved: true,
  amenities: [],
  addOns: [],
  hostStripeReady: true,
}
const cardProps = {
  id: "vehicle",
  image: "",
  name: "Synthetic Test Car",
  year: 2026,
  make: "Synthetic",
  model: "Test Car",
  pricePerDay: 12345,
}
beforeEach(() => {
  state.params = new URLSearchParams()
  state.vehicles = [{ ...vehicle }]
  state.detail = { ...vehicle }
  state.tracks = []
  state.stats = {}
  state.push.mockClear()
  state.replace.mockClear()
  sessionStorage.clear()
})
afterEach(cleanup)

it("does not announce zero inventory during a slow first load, including mobile filters", () => {
  state.vehicles = undefined
  const view = render(<VehiclesPage />)
  expect(screen.getByRole("status")).toHaveTextContent("Loading listings…")
  expect(screen.queryByRole("heading", { name: "No matching listings" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Filters" }))
  const filters = screen.getByRole("dialog")
  expect(within(filters).getByRole("button", { name: "Loading listings…" })).toBeDisabled()
  state.vehicles = [{ ...vehicle, hostStripeReady: false }]
  view.rerender(<VehiclesPage />)
  expect(within(filters).getByRole("button", { name: "Show 1 matching listing" })).toBeEnabled()
  fireEvent.click(within(filters).getByRole("button", { name: "Show 1 matching listing" }))
  expect(screen.getByRole("status")).toHaveTextContent("1 matching listing")
  expect(screen.getByText("Coming soon")).toBeInTheDocument()
})

it("keeps loading while required track or rating-filter data is unresolved", () => {
  state.tracks = undefined
  const view = render(<VehiclesPage />)
  expect(screen.getByRole("status")).toHaveTextContent("Loading listings…")
  view.unmount()
  state.tracks = []
  state.params = new URLSearchParams("rating=4")
  state.stats = undefined
  const ratingView = render(<VehiclesPage />)
  expect(screen.getByRole("status")).toHaveTextContent("Loading listings…")
  expect(screen.queryByRole("heading", { name: "No matching listings" })).toBeNull()
  state.stats = { vehicle: { averageRating: 4.5, totalReviews: 2 } }
  ratingView.rerender(<VehiclesPage />)
  expect(screen.getByRole("status")).toHaveTextContent("1 matching listing")
})

it.each([
  "server",
  "client",
])("shows a genuine zero-result %s search with recovery actions", (filter) => {
  if (filter === "server") {
    state.params = new URLSearchParams("make=Missing")
    state.vehicles = []
  } else {
    state.params = new URLSearchParams("q=no-match")
  }
  render(<VehiclesPage />)
  expect(screen.getByRole("status")).toHaveTextContent("0 matching listings")
  expect(screen.getByRole("heading", { name: "No matching listings" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Clear All Filters" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "Clear Search & Dates" })).toBeEnabled()
  expect(screen.queryByText("No vehicles available")).toBeNull()
})

it("counts matching listings including coming soon before local pagination", () => {
  state.vehicles = Array.from({ length: 13 }, (_, index) => ({
    ...vehicle,
    _id: `vehicle-${index}`,
    hostStripeReady: index !== 0,
  }))
  render(<VehiclesPage />)
  expect(screen.getByRole("status")).toHaveTextContent("13 matching listings")
  expect(screen.getAllByText("View details")).toHaveLength(12)
  expect(screen.getByText("Coming soon")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Load More Vehicles" }))
  expect(screen.getAllByText("View details")).toHaveLength(13)
  expect(screen.getByRole("status")).toHaveTextContent("13 matching listings")
})

describe.each(["grid", "list"] as const)("%s card readiness", (layout) => {
  it.each([
    [false, "Coming soon"],
    [true, "Ready to request"],
    [undefined, "Booking status unavailable"],
  ] as const)("uses one status for %s readiness and links to details", (ready, label) => {
    state.params = new URLSearchParams("startDate=2031-01-04&endDate=2031-01-06")
    render(<VehicleCard {...cardProps} datesSelected hostStripeReady={ready} layout={layout} />)
    if (ready === undefined) {
      expect(screen.queryByText("Ready to request")).toBeNull()
      expect(screen.queryByText("Coming soon")).toBeNull()
    } else {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText("Available")).toBeNull()
    expect(screen.getByText("View details")).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/vehicles/vehicle?startDate=2031-01-04&endDate=2031-01-06"
    )
  })
})

it("keeps the detail page loading without offering a request before data arrives", () => {
  state.detail = undefined
  render(<VehicleDetailsPage />)
  expect(screen.getByText("Loading vehicle details...")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Request rental" })).toBeNull()
})

it.each([
  [false, "Coming soon"],
  [undefined, "Booking unavailable"],
] as const)("disables both detail request CTAs for %s readiness", (ready, label) => {
  state.detail = { ...vehicle, hostStripeReady: ready }
  render(<VehicleDetailsPage />)
  for (const button of screen.getAllByRole("button", { name: label })) {
    expect(button).toBeDisabled()
    fireEvent.click(button)
  }
  expect(screen.getAllByRole("button", { name: label })).toHaveLength(2)
  expect(screen.queryByRole("button", { name: "Request rental" })).toBeNull()
  expect(state.push).not.toHaveBeenCalled()
})

it("offers requests on both detail CTAs, preserves dates, and explains approval before payment", () => {
  state.params = new URLSearchParams("startDate=2031-01-04&endDate=2031-01-06")
  render(<VehicleDetailsPage />)
  const buttons = screen.getAllByRole("button", { name: "Request rental" })
  expect(buttons).toHaveLength(2)
  for (const button of buttons) {
    expect(button).toBeEnabled()
    fireEvent.click(button)
  }
  expect(state.push).toHaveBeenCalledTimes(2)
  expect(state.push).toHaveBeenLastCalledWith(
    "/checkout?vehicleId=vehicle&startDate=2031-01-04&endDate=2031-01-06"
  )
  expect(
    screen.getByText("Send a request for host approval. Payment follows approval.")
  ).toBeInTheDocument()
})
