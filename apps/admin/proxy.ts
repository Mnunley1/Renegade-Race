import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// All routes except sign-in require authentication and admin role
const isPublicRoute = createRouteMatcher(["/sign-in(.*)"])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, orgId } = await auth()

  // Allow public access to sign-in page
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Check if user is authenticated
  if (!userId) {
    const url = new URL("/sign-in", req.url)
    const redirectPath = req.nextUrl.pathname + req.nextUrl.search
    url.searchParams.set("redirect_url", redirectPath)
    return NextResponse.redirect(url)
  }

  // Check if user has admin role
  // Clerk stores metadata in publicMetadata when set via dashboard
  // This matches how the backend Convex functions check for admin role
  const publicMetadata = (sessionClaims?.publicMetadata as Record<string, unknown>) || {}
  const sessionMetadata = (sessionClaims as Record<string, unknown>) || {}
  const role =
    (publicMetadata.role as string | undefined) ||
    (sessionMetadata.orgRole as string | undefined) ||
    ((sessionMetadata.metadata as Record<string, unknown>)?.role as string | undefined)

  if (role !== "admin") {
    // Redirect non-admin users to sign-in with error message
    const url = new URL("/sign-in", req.url)
    url.searchParams.set("error", "admin_required")
    return NextResponse.redirect(url)
  }

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
