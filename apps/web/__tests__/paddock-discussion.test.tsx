import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { PaddockDiscussion } from "@/components/paddock/paddock-discussion"
import { PublicAuthorLink } from "@/components/paddock/public-author-link"

const mock = vi.hoisted(() => ({
  post: undefined as any,
  comments: undefined as any,
  auth: {
    isReady: false,
    isLoading: false,
    isSignedIn: false,
    user: null as null | { id: string },
    accountKey: "guest",
  },
  add: vi.fn(),
  remove: vi.fn(),
}))
vi.mock("@/hooks/useAccountAuth", async (original) => ({
  ...(await original<typeof import("@/hooks/useAccountAuth")>()),
  useAccountAuth: () => mock.auth,
}))
vi.mock("convex/react", () => ({
  useQuery: (fn: any, args: any) =>
    args === "skip"
      ? undefined
      : getFunctionName(fn) === "posts:getPost"
        ? mock.post
        : mock.comments,
  useMutation: (fn: any) => (getFunctionName(fn) === "posts:addComment" ? mock.add : mock.remove),
}))
const post = {
  _id: "post",
  content: "Track update",
  createdAt: 1,
  commentCount: 0,
  author: { name: "Driver", profileHref: "/motorsports/drivers/actualProfileId" },
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.post = undefined
  mock.comments = undefined
  mock.auth = {
    isReady: false,
    isLoading: false,
    isSignedIn: false,
    user: null,
    accountKey: "guest",
  }
  mock.add.mockResolvedValue("comment")
})
afterEach(cleanup)
it("distinguishes loading, unavailable and guest-readable posts with a preserved sign-in destination", () => {
  const page = render(<PaddockDiscussion postId="post" />)
  expect(screen.getByRole("status", { name: "Loading discussion" })).toBeInTheDocument()
  mock.post = null
  page.rerender(<PaddockDiscussion postId="post" />)
  expect(screen.getByText("Post unavailable")).toBeInTheDocument()
  mock.post = post
  mock.comments = []
  page.rerender(<PaddockDiscussion postId="post" />)
  expect(screen.getByText("Track update")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Driver" })).toHaveAttribute(
    "href",
    "/motorsports/drivers/actualProfileId"
  )
  expect(screen.getByRole("link", { name: "Sign in to comment" })).toHaveAttribute(
    "href",
    "/sign-in?redirect_url=%2Fpaddock%2Fpost"
  )
  expect(screen.queryByRole("textbox")).toBeNull()
})
it("retains comment text after failure, retries explicitly, and reads authoritative counts", async () => {
  mock.post = post
  mock.comments = []
  mock.auth = {
    isReady: true,
    isLoading: false,
    isSignedIn: true,
    user: { id: "me" },
    accountKey: "me:session1",
  }
  mock.add.mockRejectedValueOnce(new Error("Unavailable"))
  const page = render(<PaddockDiscussion postId="post" />)
  fireEvent.change(screen.getByRole("textbox"), { target: { value: " Reply " } })
  fireEvent.click(screen.getByRole("button", { name: "Post comment" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Your text is saved")
  expect(screen.getByRole("textbox")).toHaveValue(" Reply ")
  fireEvent.click(screen.getByRole("button", { name: "Post comment" }))
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""))
  expect(mock.add).toHaveBeenLastCalledWith({ postId: "post", content: "Reply" })
  mock.post = { ...post, commentCount: 1 }
  mock.comments = [
    { _id: "comment", authorId: "me", content: "Reply", createdAt: 2, author: post.author },
  ]
  page.rerender(<PaddockDiscussion postId="post" />)
  expect(screen.getByRole("heading", { name: "Comments (1)" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Delete comment" })).toBeInTheDocument()
})
it("resets drafts on account/session changes and ignores an old pending completion", async () => {
  mock.post = post
  mock.comments = []
  mock.auth = {
    isReady: true,
    isLoading: false,
    isSignedIn: true,
    user: { id: "me" },
    accountKey: "me:one",
  }
  let resolve!: () => void
  mock.add.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r
      })
  )
  const page = render(<PaddockDiscussion postId="post" />)
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Old reply" } })
  fireEvent.click(screen.getByRole("button", { name: "Post comment" }))
  mock.auth = { ...mock.auth, accountKey: "me:two" }
  page.rerender(<PaddockDiscussion postId="post" />)
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New session reply" } })
  resolve()
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("New session reply"))
})
it("does not invent links for unavailable authors", () => {
  render(<PublicAuthorLink author={null} />)
  expect(screen.getByText("Unavailable user")).toBeInTheDocument()
  expect(screen.queryByRole("link")).toBeNull()
})
