import { cleanup, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PublicProfilePage from "@/app/profile/[id]/page"

const query = vi.hoisted(() => ({ value: undefined as unknown }))
vi.mock("convex/react", () => ({ useQuery: () => query.value }))
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "member-clerk-id" }) }))
vi.mock("next/image", () => ({
  default: ({ ...props }: ComponentProps<"img">) => <img {...props} alt={props.alt ?? ""} />,
}))
afterEach(cleanup)

describe("public author deep links", () => {
  it("distinguishes loading from an unavailable/deleted author", () => {
    query.value = undefined
    const view = render(<PublicProfilePage />)
    expect(screen.getByText("Loading profile…")).toBeVisible()
    query.value = null
    view.rerender(<PublicProfilePage />)
    expect(screen.getByRole("heading", { name: "Profile unavailable" })).toBeVisible()
    expect(screen.queryByText("Loading profile…")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Paddock" })).toHaveAttribute("href", "/paddock")
  })

  it("renders public member fields and uses the resolved driver document ID for follow access", () => {
    query.value = {
      name: "Test member",
      bio: "Track days",
      location: "Track",
      driverProfileId: "actual-driver-document",
    }
    const view = render(<PublicProfilePage />)
    expect(screen.getByRole("heading", { name: "Test member" })).toBeVisible()
    expect(screen.getByText("Track days")).toBeVisible()
    expect(screen.getByRole("link", { name: "View driver profile" })).toHaveAttribute(
      "href",
      "/motorsports/drivers/actual-driver-document"
    )
    query.value = { name: "Non-driver member", bio: "Track days" }
    view.rerender(<PublicProfilePage />)
    expect(screen.queryByRole("link", { name: "View driver profile" })).not.toBeInTheDocument()
  })
})
