import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TeamSeatOfferingCard } from "@/components/team-seat-offerings"
import type { Id } from "@/lib/convex"
import {
  dollarsToCents,
  seatAvailabilityLabel,
  type TeamSeatOfferingView,
  visibleTeamSeatOfferings,
} from "@/lib/team-seat-offerings"

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const offering: TeamSeatOfferingView = {
  _id: "offering-1" as Id<"seatOfferings">,
  title: "Sebring endurance co-driver",
  description: "Arrive-and-drive program with engineering and track support.",
  spotCount: 2,
  priceCents: 1_500_000,
  depositCents: 500_000,
  experienceLevel: "advanced",
  stintNotes: "Friday practice and two race stints.",
  isActive: true,
  inventory: {
    spotCount: 2,
    held: 0,
    waitlisted: 0,
    remaining: 2,
  },
  event: {
    _id: "event-1" as Id<"raceEvents">,
    name: "Sebring 12 Hours",
    startDate: "2031-03-14",
    endDate: "2031-03-16",
    trackName: "Sebring International Raceway",
    trackLocation: "Sebring, FL",
  },
  teamCar: {
    _id: "car-1" as Id<"teamCars">,
    make: "Porsche",
    model: "718 Cayman GT4 RS Clubsport",
    year: 2030,
    carNumber: "24",
    carClass: "GS",
  },
}

describe("team seat offering card", () => {
  it("shows event, car, availability, price, and a driver request action", () => {
    render(<TeamSeatOfferingCard canManage={false} offering={offering} />)

    expect(screen.getByText("Sebring endurance co-driver")).toBeInTheDocument()
    expect(screen.getByText("Sebring 12 Hours")).toBeInTheDocument()
    expect(screen.getByText("2030 Porsche 718 Cayman GT4 RS Clubsport · #24")).toBeInTheDocument()
    expect(screen.getByText("2 seats available")).toBeInTheDocument()
    expect(screen.getByText("$15,000")).toBeInTheDocument()
    expect(screen.getByText("$5,000 deposit · Advanced experience")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Request this seat" })).toBeInTheDocument()
  })

  it("shows owner publishing controls separately from the driver action", () => {
    render(<TeamSeatOfferingCard canManage offering={{ ...offering, isActive: false }} />)

    expect(screen.getByText("Unpublished")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request this seat" })).not.toBeInTheDocument()
  })
})

describe("team seat offering helpers", () => {
  it("keeps inactive and past listings private while owners can manage them", () => {
    const past = {
      ...offering,
      _id: "past" as Id<"seatOfferings">,
      event: {
        _id: "past-event" as Id<"raceEvents">,
        name: "Past race",
        startDate: "2030-01-01",
        endDate: "2030-01-01",
      },
    }
    const inactive = {
      ...offering,
      _id: "inactive" as Id<"seatOfferings">,
      isActive: false,
    }

    expect(
      visibleTeamSeatOfferings([past, inactive, offering], {
        canManage: false,
        today: "2031-01-01",
      })
    ).toEqual([offering])
    expect(
      visibleTeamSeatOfferings([past, inactive, offering], {
        canManage: true,
        today: "2031-01-01",
      })
    ).toHaveLength(3)
  })

  it("labels a full offering as a waitlist and parses currency exactly", () => {
    expect(
      seatAvailabilityLabel({
        ...offering,
        inventory: { ...offering.inventory, remaining: 0, waitlisted: 2 },
      })
    ).toBe("Waitlist open · 2 drivers waiting")
    expect(dollarsToCents("15000.50")).toBe(1_500_050)
    expect(dollarsToCents("not money")).toBeNull()
  })
})
