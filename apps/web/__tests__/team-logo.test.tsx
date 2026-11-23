import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { type ComponentProps, Suspense } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import TeamDetailPage from "@/app/motorsports/teams/[id]/page"
import { TeamCard } from "@/components/team-card"

const state = vi.hoisted(() => ({ team: {} as Record<string, unknown> }))
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: null }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("convex/react", () => ({
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn) === "teams:getById" ? state.team : [],
  useMutation: () => vi.fn(),
}))
vi.mock("@/components/team-application-form", () => ({ TeamApplicationForm: () => null }))
vi.mock("@/components/team-calendar", () => ({ TeamCalendar: () => null }))
vi.mock("@/components/team-roster", () => ({ TeamRoster: () => null }))
vi.mock("@/components/profile-analytics", () => ({ ProfileAnalytics: () => null }))
vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    sizes: _sizes,
    unoptimized: _unoptimized,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean }) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}))

const team = {
  _id: "team",
  name: "Test Team",
  ownerId: "owner",
  location: "Test",
  specialties: [],
  requirements: [],
  availableSeats: 0,
  isActive: true,
}
const origin = "https://staging-images.example.test"
const cardProps = {
  id: team._id,
  name: team.name,
  location: team.location,
  specialties: team.specialties,
  availableSeats: team.availableSeats,
}
beforeEach(() => {
  state.team = { ...team }
  vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", origin)
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it.each([
  "legacy",
  "r2",
])("keeps team card initials on a failed %s logo and recovers on source change", (kind) => {
  const source =
    kind === "legacy"
      ? { logoUrl: "https://static.wixstatic.com/media/synthetic.png" }
      : { logoR2Key: "images/general/team/logo" }
  const props = { ...cardProps, ...source }
  const view = render(<TeamCard {...props} />)
  fireEvent.error(screen.getByAltText("Test Team"))
  const fallback = screen.getByRole("img", { name: "Test Team unavailable" })
  expect(within(fallback).getByText("Te")).toHaveClass("text-white")
  expect(fallback.firstElementChild).toHaveClass("bg-primary")
  expect(view.container.querySelector("img")).toBeNull()
  view.rerender(<TeamCard {...props} logoR2Key="images/general/team/replacement" />)
  expect(screen.getByAltText("Test Team")).toHaveAttribute(
    "src",
    `${origin}/images/general/team/replacement`
  )
  expect(screen.queryByRole("img", { name: "Test Team unavailable" })).not.toBeInTheDocument()
})

it.each([
  "legacy",
  "r2",
])("keeps team detail branding on a failed %s logo and recovers on source change", async (kind) => {
  state.team = {
    ...team,
    ...(kind === "legacy"
      ? { logoUrl: "https://static.wixstatic.com/media/synthetic.png" }
      : { logoR2Key: "images/general/team/logo" }),
  }
  const params = Promise.resolve({ id: "team" })
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(
      <Suspense fallback="Loading">
        <TeamDetailPage params={params} />
      </Suspense>
    )
    await params
  })
  fireEvent.error(screen.getByAltText("Test Team"))
  const fallback = screen.getByRole("img", { name: "Test Team unavailable" })
  expect(within(fallback).getByText("Test Team")).toHaveClass("text-4xl", "text-white")
  expect(fallback.firstElementChild).toHaveClass("bg-primary")
  expect(view.container.querySelector("img")).toBeNull()
  state.team = { ...state.team, logoR2Key: "images/general/team/replacement" }
  view.rerender(
    <Suspense fallback="Loading">
      <TeamDetailPage params={params} />
    </Suspense>
  )
  expect(screen.getByAltText("Test Team")).toHaveAttribute(
    "src",
    `${origin}/images/general/team/replacement`
  )
})

it("shows the existing initials when neither source is usable", () => {
  const view = render(<TeamCard {...cardProps} />)
  expect(screen.getByRole("img", { name: "Test Team unavailable" })).toHaveTextContent("Te")
  expect(view.container.querySelector("img")).toBeNull()
})
