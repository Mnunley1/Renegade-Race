import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Navigation } from "@/components/navigation"
import { rentalDraftKey } from "@/lib/rental-draft"

const mock = vi.hoisted(() => ({
  signedIn: true,
  hostStatus: "completed" as string | undefined,
  hasCoachProfile: true,
  unreadCount: 3,
  signOut: vi.fn(),
  push: vi.fn(),
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: mock.signedIn,
    user: mock.signedIn
      ? {
          id: "renter",
          firstName: "Test",
          lastName: "Renter",
          emailAddresses: [{ emailAddress: "test@example.com" }],
        }
      : null,
  }),
  useAuth: () => ({ signOut: mock.signOut }),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push: mock.push }),
}))
vi.mock("convex/react", () => ({
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return
    switch (getFunctionName(fn)) {
      case "users:getHostOnboardingStatus":
        return mock.hostStatus ? { status: mock.hostStatus } : undefined
      case "coachProfiles:getByUser":
        return mock.hasCoachProfile ? { _id: "coach" } : null
      case "messages:getUnreadCount":
        return mock.unreadCount
      default:
        return
    }
  },
}))
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <button aria-label="Notifications" type="button" />,
}))
vi.mock("@/components/host-nav-link", () => ({
  HostNavLink: () => <a href="/host/dashboard">Header Hosting</a>,
}))
vi.mock("@/components/inbox-button", () => ({
  InboxButton: () => <a href="/messages">Header Inbox</a>,
}))

const PRIMARY_LINKS = [
  ["Rentals", "/vehicles"],
  ["Coaching", "/coaches"],
  ["Paddock", "/paddock"],
]
const REMOVED_LABELS = [
  "Vehicles",
  "Motorsports",
  "Coaches",
  "People",
  "Garage",
  "Deals",
  "Header Hosting",
  "Header Inbox",
]
const MESSAGES_LABEL = /^Messages/

beforeEach(() => {
  mock.signedIn = true
  mock.hostStatus = "completed"
  mock.hasCoachProfile = true
  mock.unreadCount = 3
  mock.push.mockReset()
  mock.signOut.mockReset().mockResolvedValue(undefined)
  sessionStorage.clear()
  window.history.replaceState(null, "", "/")
})
afterEach(cleanup)

function openUserMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Open user menu" }), { key: "ArrowDown" })
  return screen.findByRole("menu")
}

it.each([
  true,
  false,
])("shows exactly three primary destinations when signed in is %s", (signedIn) => {
  mock.signedIn = signedIn
  render(<Navigation />)
  const nav = screen.getByRole("navigation", { name: "Primary navigation" })
  for (const [label, href] of PRIMARY_LINKS)
    expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href)
  for (const label of REMOVED_LABELS)
    expect(within(nav).queryByRole("link", { name: label })).toBeNull()
  const hrefs = within(nav)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"))
  expect(hrefs).toEqual(
    signedIn
      ? ["/", "/vehicles", "/coaches", "/paddock"]
      : ["/", "/vehicles", "/coaches", "/paddock", "/sign-in?redirect_url=%2F", "/sign-up"]
  )
  expect(screen.queryByRole("button", { name: "Notifications" }) !== null).toBe(signedIn)
  expect(screen.queryByRole("button", { name: "Open user menu" }) !== null).toBe(signedIn)
})

it("keeps every signed-in tool in the shared user menu with the messages badge", async () => {
  render(<Navigation />)
  const menuElement = await openUserMenu()
  expect(menuElement).toHaveClass(
    "max-h-[var(--radix-dropdown-menu-content-available-height)]",
    "overflow-y-auto"
  )
  const menu = within(menuElement)
  for (const [name, href] of [
    ["My Trips", "/trips"],
    ["Favorites", "/favorites"],
    ["Hosting", "/host/dashboard"],
    ["Invoices", "/deals/invoices"],
    ["My Profile", "/profile"],
    ["Account Settings", "/settings"],
    ["Coach Dashboard", "/coach/dashboard"],
  ]) {
    expect(menu.getByRole("menuitem", { name })).toHaveAttribute("href", href)
  }
  const messages = menu.getByRole("menuitem", { name: MESSAGES_LABEL })
  expect(messages).toHaveAttribute("href", "/messages")
  expect(within(messages).getByText("3")).toBeInTheDocument()
  expect(menu.getByRole("menuitem", { name: "Sign Out" })).toBeInTheDocument()
  expect(menu.getAllByRole("menuitem")).toHaveLength(9)
})

it("keeps the mobile hamburger to primary links and exposes tools through the same avatar", async () => {
  render(<Navigation />)
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
  const dialog = screen.getByRole("dialog", { name: "Navigation Menu" })
  for (const [label, href] of PRIMARY_LINKS)
    expect(within(dialog).getByRole("link", { name: label })).toHaveAttribute("href", href)
  for (const label of REMOVED_LABELS)
    expect(within(dialog).queryByRole("link", { name: label })).toBeNull()
  expect(
    within(dialog)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
  ).toEqual(["/", "/vehicles", "/coaches", "/paddock"])
  expect(within(dialog).queryByRole("link", { name: "My Trips" })).toBeNull()
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(within(await openUserMenu()).getByRole("menuitem", { name: "Invoices" })).toHaveAttribute(
    "href",
    "/deals/invoices"
  )
})

it.each([
  undefined,
  "not_started",
  "in_progress",
  "completed",
])("keeps Hosting's destination correct for %s", async (status) => {
  mock.hostStatus = status
  render(<Navigation />)
  expect(within(await openUserMenu()).getByRole("menuitem", { name: "Hosting" })).toHaveAttribute(
    "href",
    status === "completed" ? "/host/dashboard" : "/host/onboarding"
  )
})

it("retains coach onboarding without a coach profile", async () => {
  mock.hasCoachProfile = false
  render(<Navigation />)
  expect(
    within(await openUserMenu()).getByRole("menuitem", { name: "Become a Coach" })
  ).toHaveAttribute("href", "/coach/onboarding")
})

it.each([
  "/vehicles/car",
  "/coaches/coach",
  "/paddock/post",
])("announces the active primary destination on desktop and mobile for %s", (path) => {
  window.history.replaceState(null, "", path)
  render(<Navigation />)
  const destination = PRIMARY_LINKS.find(([, href]) => path.startsWith(`${href}/`))![0]
  expect(screen.getByRole("link", { name: destination })).toHaveAttribute("aria-current", "page")
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
  expect(
    within(screen.getByRole("dialog")).getByRole("link", { name: destination })
  ).toHaveAttribute("aria-current", "page")
})

it("announces nested account paths without marking unrelated prefixes active", async () => {
  window.history.replaceState(null, "", "/deals/invoices/invoice")
  render(<Navigation />)
  const menu = within(await openUserMenu())
  expect(menu.getByRole("menuitem", { name: "Invoices" })).toHaveAttribute("aria-current", "page")
  expect(menu.getByRole("menuitem", { name: "Hosting" })).not.toHaveAttribute("aria-current")
  expect(menu.getByRole("menuitem", { name: "Coach Dashboard" })).not.toHaveAttribute(
    "aria-current"
  )
})

it("signs out from the account menu", async () => {
  render(<Navigation />)
  fireEvent.click(within(await openUserMenu()).getByRole("menuitem", { name: "Sign Out" }))
  await waitFor(() => expect(mock.signOut).toHaveBeenCalledTimes(1))
})

it.each([
  ["Log in", "/sign-in", false],
  ["Sign up", "/sign-up", false],
  ["Sign In", "/sign-in", true],
  ["Sign Up", "/sign-up", true],
])("preserves checkout draft handoff from %s", (label, path, mobile) => {
  mock.signedIn = false
  window.history.replaceState(null, "", "/checkout?vehicleId=vehicle")
  const draft = {
    version: 1,
    vehicleId: "vehicle",
    ownerId: null,
    savedAt: Date.now(),
    startDate: "2099-08-01",
    duration: 2,
    pickupTime: "08:00",
    dropoffTime: "18:00",
    selectedAddOnNames: ["Helmet"],
    renterMessage: "Keep my choices",
  }
  sessionStorage.setItem(rentalDraftKey("vehicle"), JSON.stringify(draft))
  render(<Navigation />)
  if (mobile) fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
  const link = screen.getByRole("link", { name: label })
  const expected = `${path}?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1`
  expect(link).toHaveAttribute("href", expected)
  fireEvent.click(link)
  expect(mock.push).toHaveBeenCalledWith(expected)
  expect(JSON.parse(sessionStorage.getItem(rentalDraftKey("vehicle"))!)).toEqual(draft)
  if (mobile) expect(screen.queryByRole("dialog")).toBeNull()
})
