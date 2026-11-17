import { useUploadFile } from "@convex-dev/r2/react"
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ConvexProvider, ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import SafetyPage from "@/app/host/onboarding/safety/page"
import { listingImageUploadApi, onboardingImageUploadApi } from "@/lib/vehicle-upload-api"

const mock = vi.hoisted(() => ({
  create: vi.fn(),
  step: vi.fn(),
  complete: vi.fn(),
  push: vi.fn(),
  issueOnboarding: vi.fn(),
  issueListing: vi.fn(),
  sync: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  handleError: vi.fn(),
}))
const draft = {
  vehicleData: { make: "Test", model: "Car", year: 2020, dailyRate: 100, description: "Fixture" },
  address: { street: "1 Test St", city: "Test", state: "NC", zipCode: "00000" },
  images: [{ r2Key: "legacy-unverified-photo", isPrimary: true, order: 0 }],
}
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }))
vi.mock("sonner", () => ({ toast: { error: mock.error, success: mock.success } }))
vi.mock("@/lib/error-handler", () => ({ handleErrorWithContext: mock.handleError }))
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useQuery: () => draft,
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const functions: Record<string, ReturnType<typeof vi.fn>> = {
      "vehicles:createVehicleWithImages": mock.create,
      "users:updateHostOnboardingStep": mock.step,
      "users:completeHostOnboarding": mock.complete,
      "r2:generateOnboardingImageUploadUrl": mock.issueOnboarding,
      "r2:generateListingImageUploadUrl": mock.issueListing,
      "r2:syncMetadata": mock.sync,
    }
    const fn = functions[getFunctionName(ref)]
    if (!fn) throw new Error(`Unexpected mutation: ${getFunctionName(ref)}`)
    return fn
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mock.create.mockReset().mockResolvedValue("vehicle-id")
  mock.issueOnboarding
    .mockReset()
    .mockResolvedValue({ key: "owned-onboarding", url: "https://storage.invalid/onboarding" })
  mock.issueListing
    .mockReset()
    .mockResolvedValue({ key: "owned-listing", url: "https://storage.invalid/listing" })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function submit() {
  const user = userEvent.setup()
  render(<SafetyPage />)
  for (const checkbox of screen.getAllByRole("checkbox")) await user.click(checkbox)
  await user.click(screen.getByRole("button", { name: "Submit Listing" }))
}

it("returns a host with an unverified legacy photo to uploads without completing onboarding", async () => {
  mock.create.mockRejectedValue(
    new ConvexError({ code: "REUPLOAD_VEHICLE_PHOTO", message: "Ownership unverified" })
  )
  await submit()
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/host/onboarding/photos"))
  expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ images: draft.images }))
  expect(mock.error).toHaveBeenCalledWith(
    "Please upload your vehicle photos again before submitting this listing."
  )
  expect(mock.step).not.toHaveBeenCalled()
  expect(mock.complete).not.toHaveBeenCalled()
  expect(mock.success).not.toHaveBeenCalled()
  expect(mock.handleError).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Submit Listing" })).toBeEnabled()
})

it("keeps unrelated submission errors on the safety page instead of requesting unnecessary uploads", async () => {
  const error = new ConvexError({ code: "OTHER_ERROR", message: "Service unavailable" })
  mock.create.mockRejectedValue(error)
  await submit()
  await waitFor(() => expect(mock.handleError).toHaveBeenCalledWith(error, expect.any(Object)))
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.complete).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Submit Listing" })).toBeEnabled()
})

it("completes onboarding only after the listing accepts its photo references", async () => {
  await submit()
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/host/onboarding/complete"))
  expect(mock.step).toHaveBeenCalledTimes(2)
  expect(mock.complete).toHaveBeenCalledTimes(1)
  expect(mock.error).not.toHaveBeenCalled()
})

it.each([
  ["onboarding", onboardingImageUploadApi, "owned-onboarding"],
  ["listing", listingImageUploadApi, "owned-listing"],
] as const)("uploads %s bytes using the purpose-specific grant and syncs only its returned key", async (kind, api, key) => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetch)
  const client = new ConvexReactClient("https://fixture.convex.cloud")
  vi.spyOn(client, "mutation").mockImplementation(
    (...call: Parameters<ConvexReactClient["mutation"]>) => {
      const [ref, args] = call
      const name = getFunctionName(ref)
      if (name === "r2:syncMetadata") return mock.sync(args)
      if (name === "r2:generateOnboardingImageUploadUrl") return mock.issueOnboarding()
      if (name === "r2:generateListingImageUploadUrl") return mock.issueListing()
      throw new Error(`Unexpected mutation: ${name}`)
    }
  )
  const { result, unmount } = renderHook(() => useUploadFile(api), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    ),
  })
  const file = new File(["fixture"], "photo.jpg", { type: "image/jpeg" })
  let uploaded: string | undefined
  await act(async () => {
    uploaded = await result.current(file)
  })
  expect(uploaded).toBe(key)
  expect(fetch).toHaveBeenCalledWith(`https://storage.invalid/${kind}`, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: file,
  })
  expect(mock.sync).toHaveBeenCalledWith({ key })
  expect(kind === "onboarding" ? mock.issueListing : mock.issueOnboarding).not.toHaveBeenCalled()
  unmount()
  await client.close()
})
