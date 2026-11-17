import { act, cleanup, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import HostReturn from "@/app/host/returns/[reservationId]/page"
import RenterReturn from "@/app/trips/return/[reservationId]/page"
import { ReturnPhoto } from "@/components/return-photo"
import { requestReturnPhoto } from "@/lib/return-photo"

const mock = vi.hoisted(() => ({
  subject: null as string | null,
  getToken: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    userId: mock.subject,
    sessionId: mock.subject && `session-${mock.subject}`,
    sessionClaims: { aud: "convex" },
    getToken: mock.getToken,
  }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ reservationId: "booking" }),
}))
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: !!mock.subject }),
  useMutation: () => vi.fn(),
  // Simulate a stale cached completion on account switch. UI must still hide it.
  useQuery: (fn: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(fn).startsWith("reservations:") ? reservation : completion,
}))

const reservation = {
  ownerId: "owner",
  renterId: "renter",
  vehicle: { make: "Test", model: "Car", year: 2026 },
}
const completion = {
  ...reservation,
  reservation,
  status: "completed",
  renterReturnForm: { notes: "Renter’s private note", photos: [] },
  ownerReturnReview: { notes: "Owner’s private note", photos: [] },
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud")
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "")
  mock.subject = null
  mock.getToken.mockReset().mockResolvedValue("fixture-token")
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it.each([
  ["renter", RenterReturn],
  ["owner", HostReturn],
] as const)("shows submitted evidence to the %s, then hides it for unrelated and signed-out callers", (user, Page) => {
  mock.subject = user
  const { rerender } = render(<Page />)
  expect(screen.getByText(completion.renterReturnForm.notes)).toBeInTheDocument()
  expect(screen.getByText(completion.ownerReturnReview.notes)).toBeInTheDocument()

  for (const outsider of ["stranger", null]) {
    mock.subject = outsider
    rerender(<Page />)
    expect(screen.getByText("Return unavailable")).toBeInTheDocument()
    expect(screen.queryByText(completion.renterReturnForm.notes)).toBeNull()
    expect(screen.queryByText(completion.ownerReturnReview.notes)).toBeNull()
  }
})

it("sends photo bytes only to the configured Convex HTTP endpoint, with no cookie, redirect, or cached response", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }))
  vi.stubGlobal("fetch", fetch)
  const file = new File(["image"], "return.jpg", { type: "image/jpeg" })
  await requestReturnPhoto("booking", "fixture-token", { file })
  const [url, init] = fetch.mock.calls[0]!
  expect(String(url)).toBe("https://example.convex.site/return-photo?reservationId=booking")
  expect(init).toMatchObject({
    method: "POST",
    body: file,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  })
  expect(init.headers.get("Authorization")).toBe("Bearer fixture-token")
  expect(init.headers.get("Content-Type")).toBe("image/jpeg")
  await expect(requestReturnPhoto("booking", null, { file })).rejects.toThrow("Sign in")
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("treats historical references as data and revokes the private image on account change", async () => {
  const key = "https://untrusted.example/return.jpg?next=evil"
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("photo", { headers: { "Content-Type": "image/jpeg" } }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
  vi.stubGlobal("fetch", fetch)
  const revokeObjectURL = vi.fn()
  class TestURL extends URL {
    static createObjectURL = vi.fn(() => "blob:private-preview")
    static revokeObjectURL = revokeObjectURL
  }
  vi.stubGlobal("URL", TestURL)
  mock.subject = "renter"
  const props = { reservationId: "booking", photoKey: key, alt: "Renter return photo" }
  const { rerender } = render(<ReturnPhoto {...props} />)
  expect(await screen.findByAltText(props.alt)).toHaveAttribute("src", "blob:private-preview")
  const [url, init] = fetch.mock.calls[0]!
  expect(url.origin).toBe("https://example.convex.site")
  expect(url.pathname).toBe("/return-photo")
  expect(url.searchParams.get("key")).toBe(key)
  expect(init).toMatchObject({ credentials: "omit", redirect: "error", cache: "no-store" })
  mock.subject = "stranger"
  rerender(<ReturnPhoto {...props} />)
  expect(screen.queryByAltText(props.alt)).toBeNull()
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:private-preview")
  expect(await screen.findByText("Photo unavailable")).toBeInTheDocument()
  mock.subject = null
  await act(() => rerender(<ReturnPhoto {...props} />))
  expect(fetch).toHaveBeenCalledTimes(2)
})
