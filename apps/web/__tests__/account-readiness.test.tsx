import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { Suspense } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import ChatPage from "@/app/messages/[id]/page"
import MessagesPage from "@/app/messages/page"
import DriverDetailPage from "@/app/motorsports/drivers/[id]/page"

const SEARCH_PLACEHOLDER = /search/i

const mock = vi.hoisted(() => ({
  user: { id: "account-a" } as { id: string } | null,
  session: "session-a" as string | null,
  clerkLoaded: true,
  authUserId: "account-a" as string | null,
  convexLoading: false,
  convexAuthenticated: true,
  queries: vi.fn(),
  list: undefined as Record<string, unknown>[] | undefined,
  messages: undefined as Record<string, unknown>[] | undefined,
  teams: undefined as Record<string, unknown>[] | undefined,
  connection: null as Record<string, unknown> | null,
  mutation: vi.fn(),
  send: vi.fn(),
  archive: vi.fn(),
  markRead: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  error: vi.fn(),
  toast: vi.fn(),
  params: new URLSearchParams(),
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: mock.user, isSignedIn: !!mock.user, isLoaded: mock.clerkLoaded }),
  useAuth: () => ({
    userId: mock.authUserId,
    sessionId: mock.session,
    isSignedIn: !!mock.session,
    isLoaded: mock.clerkLoaded,
  }),
}))
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "conversation" }),
  useSearchParams: () => mock.params,
  useRouter: () => ({ replace: mock.replace, push: mock.push }),
}))
vi.mock("sonner", () => ({ toast: { success: mock.toast, error: mock.toast } }))
vi.mock("@/lib/error-handler", () => ({
  handleErrorWithContext: mock.error,
  handleError: mock.error,
}))
vi.mock("@/components/driver-card", () => ({ DriverCard: () => null }))
vi.mock("@/components/driver-endorsements", () => ({ DriverEndorsements: () => null }))
vi.mock("@/components/driver-portfolio", () => ({ DriverPortfolio: () => null }))
vi.mock("@/components/profile-analytics", () => ({ ProfileAnalytics: () => null }))
vi.mock("@/app/messages/[id]/chat-header", () => ({ ChatHeader: () => null }))
vi.mock("@/app/messages/[id]/message-list", () => ({
  MessageList: ({ messages }: { messages?: { _id: string; content: string }[] }) => (
    <>
      {messages?.map((message) => (
        <p key={message._id}>{message.content}</p>
      ))}
    </>
  ),
}))
vi.mock("@/app/messages/[id]/confirmation-dialogs", () => ({
  ConfirmationDialogs: ({
    onConfirmArchiveConversation,
  }: {
    onConfirmArchiveConversation: () => void
  }) => (
    <button onClick={onConfirmArchiveConversation} type="button">
      Confirm archive
    </button>
  ),
}))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: mock.convexLoading,
    isAuthenticated: mock.convexAuthenticated,
  }),
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(fn)
    mock.queries(name, args)
    if (args === "skip") return
    switch (name) {
      case "conversations:getByUser":
        return mock.list
      case "conversations:getById":
        return { _id: "conversation", renterId: mock.user?.id, ownerId: "other", isActive: true }
      case "messages:getByConversation":
        return mock.messages
      case "users:getByExternalId":
        return { name: "Other participant" }
      case "messageTemplates:list":
        return { customTemplates: [], platformTemplates: [] }
      case "driverProfiles:getById":
        return {
          _id: "driver",
          userId: "driver-user",
          user: { name: "Public Driver" },
          isActive: true,
          isOwner: false,
          experience: "beginner",
          licenses: [],
          preferredCategories: [],
          availability: [],
          location: "Track",
        }
      case "driverProfiles:getSimilar":
        return []
      case "teams:getByOwner":
        return mock.teams
      case "teamDriverConnections:checkConnection":
        return mock.connection
      default:
        return
    }
  },
  useMutation: (fn: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(fn)) {
      case "messages:send":
        return mock.send
      case "messages:markConversationAsRead":
        return mock.markRead
      case "conversations:archive":
        return mock.archive
      default:
        return mock.mutation
    }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mock.user = { id: "account-a" }
  mock.session = "session-a"
  mock.authUserId = "account-a"
  mock.clerkLoaded = true
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.list = undefined
  mock.messages = undefined
  mock.teams = undefined
  mock.connection = null
  mock.params = new URLSearchParams()
  for (const mutation of [mock.send, mock.archive, mock.markRead, mock.mutation])
    mutation.mockResolvedValue(null)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

it("does not flash signed-out or empty messaging while Clerk and Convex finish separately", () => {
  mock.clerkLoaded = false
  mock.convexLoading = true
  mock.convexAuthenticated = false
  const view = render(<MessagesPage />)
  expect(screen.getByText("Loading conversations...")).toBeInTheDocument()
  expect(screen.queryByText("Please sign in")).not.toBeInTheDocument()
  expect(mock.queries).not.toHaveBeenCalled()
  mock.clerkLoaded = true
  view.rerender(<MessagesPage />)
  expect(mock.queries).not.toHaveBeenCalled()
  mock.convexLoading = false
  mock.convexAuthenticated = true
  view.rerender(<MessagesPage />)
  expect(screen.getByRole("status", { name: "Loading conversations" })).toBeInTheDocument()
  expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument()
  mock.list = []
  view.rerender(<MessagesPage />)
  expect(screen.getByText("No conversations yet")).toBeInTheDocument()
})

it("unmounts protected messaging immediately on sign-out even if Convex still reports authenticated", () => {
  mock.list = []
  const view = render(<MessagesPage />)
  expect(screen.getByText("No conversations yet")).toBeInTheDocument()
  mock.user = null
  mock.session = null
  mock.authUserId = null
  mock.queries.mockClear()
  view.rerender(<MessagesPage />)
  expect(screen.getByText("Please sign in")).toBeInTheDocument()
  expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument()
  expect(mock.queries).not.toHaveBeenCalled()
})

it("shows an account connection failure rather than an empty inbox if Convex rejects auth", () => {
  mock.convexAuthenticated = false
  render(<MessagesPage />)
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to connect")
  expect(mock.queries).not.toHaveBeenCalled()
})

it("resets search and bulk selection when the signed-in session switches", () => {
  mock.list = []
  const view = render(<MessagesPage />)
  fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
    target: { value: "account A private search" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Select" }))
  mock.user = { id: "account-b" }
  mock.session = "session-b"
  mock.authUserId = "account-b"
  view.rerender(<MessagesPage />)
  expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveValue("")
  expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument()
  expect(mock.queries).toHaveBeenCalledWith("conversations:getByUser", {
    userId: "account-b",
    role: "renter",
  })
})

it("delays chat queries, templates and mark-read until both systems are ready", () => {
  mock.convexLoading = true
  mock.convexAuthenticated = false
  mock.messages = []
  const view = render(<ChatPage />)
  expect(screen.getByText("Loading conversation...")).toBeInTheDocument()
  expect(mock.queries).not.toHaveBeenCalled()
  expect(mock.markRead).not.toHaveBeenCalled()
  mock.convexLoading = false
  mock.convexAuthenticated = true
  view.rerender(<ChatPage />)
  expect(mock.markRead).toHaveBeenCalledWith({
    conversationId: "conversation",
    userId: "account-a",
  })
  expect(mock.queries).toHaveBeenCalledWith("messageTemplates:list", { userId: "account-a" })
})

it("drops chat drafts and messages during account change and marks read for the new account", () => {
  mock.messages = [{ _id: "message", content: "Account A protected text" }]
  const view = render(<ChatPage />)
  fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
    target: { value: "Account A draft" },
  })
  mock.user = { id: "account-b" }
  mock.authUserId = "account-b"
  mock.session = "session-b"
  mock.convexLoading = true
  mock.convexAuthenticated = false
  mock.queries.mockClear()
  view.rerender(<ChatPage />)
  expect(screen.queryByText("Account A protected text")).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue("Account A draft")).not.toBeInTheDocument()
  expect(mock.queries).not.toHaveBeenCalled()
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.messages = []
  view.rerender(<ChatPage />)
  expect(screen.getByPlaceholderText("Type a message...")).toHaveValue("")
  expect(mock.markRead).toHaveBeenLastCalledWith({
    conversationId: "conversation",
    userId: "account-b",
  })
})

it("ignores a previous session's archive completion instead of redirecting or toasting", async () => {
  mock.messages = []
  let finish!: () => void
  mock.archive.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  const view = render(<ChatPage />)
  fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }))
  mock.user = { id: "account-b" }
  mock.authUserId = "account-b"
  mock.session = "session-b"
  view.rerender(<ChatPage />)
  await act(async () => finish())
  expect(mock.replace).not.toHaveBeenCalled()
  expect(mock.toast).not.toHaveBeenCalled()
})

it("preserves current-session mutation errors", async () => {
  mock.messages = []
  mock.archive.mockRejectedValue(new Error("backend rejected archive"))
  render(<ChatPage />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm archive" })))
  expect(mock.error).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ action: "archive conversation" })
  )
})

it("keeps the driver public but skips owned teams and view mutation while auth is delayed", async () => {
  mock.convexLoading = true
  mock.convexAuthenticated = false
  const params = Promise.resolve({ id: "driver" })
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(
      <Suspense>
        <DriverDetailPage params={params} />
      </Suspense>
    )
    await params
  })
  expect(screen.getAllByText("Public Driver").length).toBeGreaterThan(0)
  expect(screen.getByText("Loading your teams...")).toBeInTheDocument()
  expect(mock.queries).toHaveBeenCalledWith("teams:getByOwner", "skip")
  expect(mock.mutation).not.toHaveBeenCalled()
  mock.convexLoading = false
  mock.convexAuthenticated = true
  mock.teams = []
  view.rerender(
    <Suspense>
      <DriverDetailPage params={params} />
    </Suspense>
  )
  expect(mock.queries).toHaveBeenCalledWith("teams:getByOwner", {})
  expect(screen.queryByText("Loading your teams...")).not.toBeInTheDocument()
})

it("does not reuse another account's cached teams or connection when switching accounts", async () => {
  mock.teams = [{ _id: "team-a", ownerId: "account-a", name: "A private team" }]
  mock.connection = { teamId: "team-a", driverProfileId: "driver", status: "accepted" }
  const params = Promise.resolve({ id: "driver" })
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(
      <Suspense>
        <DriverDetailPage params={params} />
      </Suspense>
    )
    await params
  })
  expect(screen.getAllByRole("button", { name: "Message Driver" })).toHaveLength(2)
  mock.user = { id: "account-b" }
  mock.authUserId = "account-b"
  mock.session = "session-b"
  mock.queries.mockClear()
  view.rerender(
    <Suspense>
      <DriverDetailPage params={params} />
    </Suspense>
  )
  expect(screen.queryByRole("button", { name: "Message Driver" })).not.toBeInTheDocument()
  expect(screen.getByText("Loading your teams...")).toBeInTheDocument()
  expect(mock.queries).toHaveBeenCalledWith("teamDriverConnections:checkConnection", "skip")
  mock.teams = [{ _id: "team-b", ownerId: "account-b", name: "B team" }]
  mock.connection = null
  view.rerender(
    <Suspense>
      <DriverDetailPage params={params} />
    </Suspense>
  )
  expect(mock.queries).toHaveBeenCalledWith("teamDriverConnections:checkConnection", {
    teamId: "team-b",
    driverProfileId: "driver",
  })
  expect(screen.getAllByRole("button", { name: "Request to Connect" })).toHaveLength(2)
})
