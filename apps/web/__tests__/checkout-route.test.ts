import { NextRequest } from "next/server"
import { expect, it, vi } from "vitest"

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@clerk/nextjs/server")>()
  return { ...original, clerkMiddleware: (handler: unknown) => handler }
})
vi.mock("@/lib/return-photo", () => ({ convexSiteOrigin: () => "https://test.convex.site" }))

it.each([
  ["/checkout?vehicleId=vehicle", false],
  ["/checkout/pay", true],
  ["/checkout/success", true],
  ["/checkout/request-sent", true],
  ["/checkout/pay-coaching", true],
  ["/checkout/anything", true],
  ["/sso-callback", false],
])("keeps the correct guest boundary for %s", async (path, protectedRoute) => {
  const { default: middleware } = await import("@/proxy")
  const protect = vi.fn()
  await (
    middleware as unknown as (
      auth: { protect: typeof protect },
      request: NextRequest
    ) => Promise<void>
  )({ protect }, new NextRequest(`https://app.example${path}`))
  expect(protect).toHaveBeenCalledTimes(protectedRoute ? 1 : 0)
})
