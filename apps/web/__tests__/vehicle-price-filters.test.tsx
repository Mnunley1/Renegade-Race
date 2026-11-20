import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VehiclesPage from "@/app/vehicles/page"
import {
  matchesPriceBounds,
  parsePriceRange,
  priceFilterDollars,
  readPriceFilter,
} from "@/app/vehicles/price-filter"

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }))
const inventory = [1022, 1023, 1024, 49999, 50000, 50001].map((dailyRate) => ({
  _id: `vehicle-${dailyRate}`,
  dailyRate,
  year: 2026,
  make: "Test",
  model: `${dailyRate}`,
  images: [],
  track: { name: "Test Track" },
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
  useRouter: () => navigation,
}))
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(fn)) {
      case "tracks:getAll":
        return []
      case "vehicles:searchWithAvailability":
        return inventory
      case "reviews:getVehicleStatsBatch":
        return {}
      default:
        return null
    }
  },
}))
vi.mock("@/app/vehicles/recently-viewed", () => ({ RecentlyViewed: () => null }))
vi.mock("@/app/vehicles/compare-bar", () => ({ CompareBar: () => null }))
vi.mock("@/app/vehicles/compare-modal", () => ({ CompareModal: () => null }))
vi.mock("@/components/vehicle-card", () => ({
  VehicleCard: ({ id }: { id: string }) => <div data-testid="matching-vehicle">{id}</div>,
}))

beforeEach(() => {
  navigation.params = new URLSearchParams()
  navigation.replace.mockClear()
  sessionStorage.clear()
})
afterEach(cleanup)

function matchingPrices() {
  return screen
    .queryAllByTestId("matching-vehicle")
    .map((card) => Number(card.textContent?.replace("vehicle-", "")))
}

function changePrice(label: string, value: string) {
  const input = screen.getByRole("spinbutton", { name: label })
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe("catalog dollar input and cent filtering", () => {
  it("uses a $10.23 inclusive range, emits dollar URLs and clears the filter", () => {
    render(<VehiclesPage />)
    changePrice("Minimum price (USD)", "10.23")
    changePrice("Maximum price (USD)", "10.23")
    expect(matchingPrices()).toEqual([1023])
    expect(screen.getByText("Price: $10.23–$10.23/day")).toBeInTheDocument()
    expect(navigation.replace).toHaveBeenLastCalledWith("?priceUsd=10.23-10.23", { scroll: false })
    fireEvent.click(screen.getByRole("button", { name: "Clear price filter" }))
    expect(matchingPrices()).toEqual([1022, 1023, 1024, 49999, 50000, 50001])
    expect(navigation.replace.mock.lastCall?.[0]).not.toContain("price")
    expect(screen.getByRole("spinbutton", { name: "Minimum price (USD)" })).toHaveValue(10.22)
  })

  it.each([
    "price=1023-1023",
    "priceUsd=10.23-10.23",
  ])("restores bounds and displayed dollars from %s", (query) => {
    navigation.params = new URLSearchParams(query)
    render(<VehiclesPage />)
    expect(matchingPrices()).toEqual([1023])
    expect(screen.getByRole("spinbutton", { name: "Minimum price (USD)" })).toHaveValue(10.23)
    expect(screen.getByRole("spinbutton", { name: "Maximum price (USD)" })).toHaveValue(10.23)
  })

  it("keeps an unbounded restored minimum explicit and clears all URL price parameters", () => {
    navigation.params = new URLSearchParams("priceUsd=10.23%2B&price=1022-1022")
    render(<VehiclesPage />)
    expect(matchingPrices()).toEqual([1023, 1024, 49999, 50000, 50001])
    expect(screen.getByRole("spinbutton", { name: "Maximum price (USD)" })).toHaveValue(null)
    expect(screen.getByRole("slider", { name: "Minimum" })).toHaveAttribute(
      "aria-valuenow",
      "10.23"
    )
    fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0] as HTMLElement)
    expect(matchingPrices()).toEqual([1022, 1023, 1024, 49999, 50000, 50001])
    expect(navigation.replace.mock.lastCall?.[0]).not.toContain("price")
  })

  it("does not restore stored bounds for an invalid explicit URL", () => {
    sessionStorage.setItem(
      "renegade-vehicle-filters",
      JSON.stringify({ selectedPriceRange: "1023-1023" })
    )
    navigation.params = new URLSearchParams("priceUsd=invalid")
    render(<VehiclesPage />)
    expect(matchingPrices()).toEqual([1022, 1023, 1024, 49999, 50000, 50001])
  })

  it("formats the empty-results price badge in dollars and clears it", () => {
    navigation.params = new URLSearchParams("q=no-matching-vehicle&priceUsd=10.23-10.23")
    render(<VehiclesPage />)
    expect(screen.getByRole("heading", { name: "No vehicles found" })).toBeInTheDocument()
    const priceBadges = screen.getAllByText("Price: $10.23–$10.23/day")
    expect(priceBadges).toHaveLength(2)
    expect(screen.queryByText("Price: 1023-1023")).not.toBeInTheDocument()
    fireEvent.click(priceBadges[1] as HTMLElement)
    expect(screen.queryByText("Price: $10.23–$10.23/day")).not.toBeInTheDocument()
    expect(navigation.replace.mock.lastCall?.[0]).not.toContain("price")
  })

  it("retains session-stored cent ranges without multiplying them", () => {
    sessionStorage.setItem(
      "renegade-vehicle-filters",
      JSON.stringify({ selectedPriceRange: "1023-1023", timestamp: Date.now() })
    )
    render(<VehiclesPage />)
    expect(matchingPrices()).toEqual([1023])
  })

  it("applies the $500 quick chip to 50000 cents and toggles back to any price", () => {
    render(<VehiclesPage />)
    fireEvent.click(screen.getByText("$500/day or less"))
    expect(matchingPrices()).toEqual([1022, 1023, 1024, 49999, 50000])
    expect(navigation.replace).toHaveBeenLastCalledWith("?priceUsd=0.00-500.00", { scroll: false })
    fireEvent.click(screen.getByText("$500/day or less"))
    expect(matchingPrices()).toEqual([1022, 1023, 1024, 49999, 50000, 50001])
  })

  it("rejects reversed and negative bounds without changing the active filter", () => {
    navigation.params = new URLSearchParams("priceUsd=10.23-10.24")
    render(<VehiclesPage />)
    changePrice("Minimum price (USD)", "20")
    expect(screen.getByRole("alert")).toHaveTextContent("minimum no greater than")
    expect(matchingPrices()).toEqual([1023, 1024])
    changePrice("Minimum price (USD)", "-1")
    expect(matchingPrices()).toEqual([1023, 1024])
  })

  it("rounds non-round input safely and permits a zero lower bound", () => {
    render(<VehiclesPage />)
    changePrice("Maximum price (USD)", "10.225")
    changePrice("Minimum price (USD)", "0")
    expect(matchingPrices()).toEqual([1022, 1023])
    expect(screen.getByRole("spinbutton", { name: "Maximum price (USD)" })).toHaveValue(10.23)
  })
})

describe("price URL conventions", () => {
  it("gives explicit dollars precedence and retains legacy plus links", () => {
    expect(readPriceFilter(new URLSearchParams("priceUsd=10.23%2B&price=9999-10000"))).toBe("1023+")
    expect(readPriceFilter(new URLSearchParams("price=1023%2B"))).toBe("1023+")
    expect(priceFilterDollars("1023+")).toBe("10.23+")
    expect(matchesPriceBounds(1022, parsePriceRange("1023+"))).toBe(false)
    expect(matchesPriceBounds(1023, parsePriceRange("1023+"))).toBe(true)
  })

  it.each([
    "-1-10",
    "10-1",
    "NaN-20",
    "Infinity+",
    "1e3-2000",
    "9007199254740992+",
    "10.23-20",
  ])("ignores malformed/unsafe legacy range %s", (range) => {
    expect(parsePriceRange(range)).toEqual({})
  })

  it("invalid new URLs do not fall back to unrelated legacy bounds", () => {
    expect(readPriceFilter(new URLSearchParams("priceUsd=oops&price=1023-1023"))).toBe("any")
  })
})
