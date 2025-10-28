import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Define routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/messages(.*)",
  "/vehicles/(.*)/book(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    const { userId } = await auth()

    if (!userId) {
      // Redirect to sign-in if not authenticated
      const signInUrl = new URL("/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  // Allow public access to all other routes
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
