import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify-email(.*)",
  "/reset-password(.*)",
  "/vehicles(.*)",
  "/how-it-works(.*)",
  "/help(.*)",
  "/safety(.*)",
  "/cancellation-policy(.*)",
  "/terms(.*)",
  "/privacy(.*)",
  "/contact(.*)",
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
          "wss://*.convex.cloud",
          "*.sentry.io",
          "*.r2.cloudflarestorage.com",
          "*.r2.dev",
          "*.vercel.app",
        ],
        "img-src": [
          "*.r2.dev",
          "*.r2.cloudflarestorage.com",
          "ik.imagekit.io",
          "images.unsplash.com",
          "*.vercel.app",
        ],
        "media-src": ["ik.imagekit.io", "*.r2.dev"],
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
