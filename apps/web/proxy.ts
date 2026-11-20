import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { convexSiteOrigin } from "./lib/return-photo"

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify-email(.*)",
  "/reset-password(.*)",
  "/vehicles(.*)",
  "/checkout",
  "/sso-callback",
  "/how-it-works(.*)",
  "/help(.*)",
  "/safety(.*)",
  "/cancellation-policy(.*)",
  "/terms(.*)",
  "/privacy(.*)",
  "/contact(.*)",
  "/motorsports(.*)",
  "/coaches(.*)",
  "/paddock(.*)",
  "/profile/:id",
  "/api/webhooks(.*)",
])

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  },
  {
    contentSecurityPolicy: {
      directives: {
        "script-src": ["*.sentry.io"],
        "connect-src": [
          "accounts.renegaderace.com",
          "*.convex.cloud",
          convexSiteOrigin(),
          "wss://*.convex.cloud",
          "*.sentry.io",
          "*.r2.cloudflarestorage.com",
          "*.r2.dev",
          "*.vercel.app",
        ],
        "img-src": [
          "blob:",
          "*.r2.dev",
          "*.r2.cloudflarestorage.com",
          "images.renegaderace.com",
          "images.unsplash.com",
          "*.vercel.app",
        ],
        "media-src": ["*.r2.dev", "images.renegaderace.com"],
      },
    },
  }
)

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
