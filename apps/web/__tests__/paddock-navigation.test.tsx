import { cleanup, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, expect, it, vi } from "vitest"
import { PaddockFeed } from "@/components/paddock/paddock-feed"

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ isSignedIn: false, user: null }) }))
vi.mock("convex/react", () => ({
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn) === "posts:listFeed"
      ? [
          {
            _kind: "post",
            _id: "post-document",
            createdAt: Date.now(),
            content: "Track update",
            commentCount: 3,
            author: {
              name: "Driver",
              userId: "clerk-user",
              profileHref: "/motorsports/drivers/driver-document",
            },
          },
        ]
      : [],
  useMutation: () => vi.fn(),
}))
afterEach(cleanup)
it("links the actual feed author and comment control to their resolved destinations", () => {
  render(<PaddockFeed />)
  expect(screen.getByRole("link", { name: "Driver" })).toHaveAttribute(
    "href",
    "/motorsports/drivers/driver-document"
  )
  expect(screen.getByRole("link", { name: "View discussion (3 comments)" })).toHaveAttribute(
    "href",
    "/paddock/post-document"
  )
  expect(screen.queryByRole("link", { name: "People" })).toBeNull()
})
