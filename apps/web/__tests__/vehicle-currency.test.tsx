import { cleanup, render, screen, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import HostVehicleDetailPage from "@/app/host/vehicles/[id]/page"
import HostVehiclesListPage from "@/app/host/vehicles/list/page"
import VehicleDetailsPage from "@/app/vehicles/[id]/page"
import { CompareModal } from "@/app/vehicles/compare-modal"
import { RecentlyViewed } from "@/app/vehicles/recently-viewed"
import type { VehicleItem } from "@/app/vehicles/types"
import { VehicleCard } from "@/components/vehicle-card"
import { useRecentlyViewed } from "@/hooks/use-recently-viewed"

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: true, user: { id: "host" } }),
}))
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "vehicle" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("next/head", () => ({ default: () => null }))
vi.mock("@/components/vehicle-gallery", () => ({ VehicleGallery: () => null }))
vi.mock("@/hooks/use-recently-viewed", () => ({
  useRecentlyViewed: vi.fn(() => ({ items: [cardVehicle] })),
}))
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue(null),
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(fn)) {
      case "vehicles:getById":
        return vehicle
      case "vehicles:getByOwner":
        return [vehicle]
      case "vehicles:canDelete":
        return { canDelete: true }
      case "reservations:getByUser":
        return reservations
      case "reviews:getByVehicle":
        return []
      case "reviews:getVehicleStats":
        return { averageRating: 0, totalReviews: 0 }
      case "vehicleAnalytics:getVehicleAnalytics":
        return null
      default:
        return null
    }
  },
}))
vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) => (open ? children : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

const cardVehicle: VehicleItem = {
  id: "vehicle",
  image: "",
  name: "Synthetic Test Car",
  year: 2026,
  make: "Synthetic",
  model: "Test Car",
  pricePerDay: 12345,
  location: "Test track",
  track: "Test track",
  rating: 0,
  reviews: 0,
  transmission: "Manual",
  drivetrain: "RWD",
}
const vehicle = {
  _id: "vehicle",
  ...cardVehicle,
  dailyRate: 12345,
  ownerId: "host",
  owner: { _id: "host", name: "Host" },
  track: { name: "Test track" },
  images: [],
  description: "Synthetic quote",
  isActive: true,
  isApproved: true,
  amenities: [],
  addOns: [{ name: "Helmet", price: 678, priceType: "daily" }],
}
const reservations = [
  {
    _id: "pending",
    vehicleId: "vehicle",
    status: "pending",
    totalAmount: 24690,
    startDate: "2099-01-01",
    endDate: "2099-01-02",
    renter: { name: "Renter" },
  },
  {
    _id: "confirmed",
    vehicleId: "vehicle",
    status: "confirmed",
    totalAmount: 13023,
    startDate: "2099-01-03",
    endDate: "2099-01-03",
    renter: { name: "Renter" },
  },
]

afterEach(cleanup)

describe("vehicle currency displays", () => {
  it("preserves opaque legacy recently-viewed labels without guessing missing structured fields", () => {
    vi.mocked(useRecentlyViewed).mockReturnValueOnce({
      items: [
        { id: "legacy", name: "Legacy cached label", image: "", pricePerDay: 1000, viewedAt: 1 },
      ],
      addItem: vi.fn(),
      clearItems: vi.fn(),
    })
    render(<RecentlyViewed />)
    expect(screen.getByText("Legacy cached label")).toBeInTheDocument()
    expect(screen.queryByText("Year unconfirmed undefined undefined")).not.toBeInTheDocument()
  })
  it.each([
    "grid",
    "list",
  ] as const)("renders a neutral legacy year in %s cards and image descriptions", (layout) => {
    render(
      <VehicleCard
        {...cardVehicle}
        layout={layout}
        make="Mazda"
        model="Synthetic"
        name="206 Mazda Synthetic"
        year={206}
      />
    )
    expect(screen.getByText("Year unconfirmed Mazda Synthetic")).toBeInTheDocument()
    expect(screen.queryByText("206 Mazda Synthetic")).not.toBeInTheDocument()
  })
  it.each(["grid", "list"] as const)("shows cents accurately in the %s card", (layout) => {
    render(<VehicleCard {...cardVehicle} layout={layout} />)
    expect(screen.getByText("$123.45")).toBeInTheDocument()
    expect(screen.getByText("Est. weekend $308.63", { exact: false })).toBeInTheDocument()
    expect(screen.queryByText("$12345")).not.toBeInTheDocument()
  })

  it("shows the same rate in comparisons and recently viewed cards", () => {
    render(
      <>
        <CompareModal
          onOpenChange={vi.fn()}
          open
          vehicles={[
            cardVehicle,
            { ...cardVehicle, id: "other", name: "Second car", pricePerDay: 1000 },
          ]}
        />
        <RecentlyViewed />
      </>
    )
    const comparison = screen.getByRole("dialog")
    expect(within(comparison).getByText("$123.45/day")).toBeInTheDocument()
    expect(within(comparison).getByText("$10.00/day")).toBeInTheDocument()
    expect(within(comparison).getByText("Estimated weekend")).toBeInTheDocument()
    expect(within(comparison).getByText("$308.63")).toBeInTheDocument()
    expect(screen.getAllByText("$123.45/day")).toHaveLength(2)
  })

  it("retains cents on vehicle details and daily add-ons", () => {
    render(<VehicleDetailsPage />)
    expect(screen.getAllByText("$123.45")).toHaveLength(2)
    expect(screen.getByText("$6.78")).toBeInTheDocument()
    expect(screen.getByText("per day")).toBeInTheDocument()
  })

  it("shows the host listing rate in dollars", () => {
    render(<HostVehiclesListPage />)
    expect(screen.getByText("$123.45/day")).toBeInTheDocument()
  })

  it("keeps multiday booking subtotals and their aggregate precise without calling them earnings", () => {
    render(<HostVehicleDetailPage />)
    expect(screen.getByText("$123.45/day", { exact: false })).toBeInTheDocument()
    expect(screen.getByText("$246.90")).toBeInTheDocument()
    expect(screen.getByText("$130.23")).toBeInTheDocument()
    expect(screen.getByText("$377.13")).toBeInTheDocument()
    expect(screen.getByText("Rental subtotals")).toBeInTheDocument()
    expect(screen.getByText("All booking statuses")).toBeInTheDocument()
    expect(screen.queryByText("All-time revenue")).not.toBeInTheDocument()
    expect(screen.getByText("$6.78", { exact: false })).toBeInTheDocument()
  })
})
