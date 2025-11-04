import { Button } from "@workspace/ui/components/button"
import { Home, Search } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />

      <div className="relative max-w-2xl text-center">
        {/* Racing Flag Animation */}
        <div className="mb-8 flex justify-center">
          <div className="text-9xl">🏁</div>
        </div>

        {/* 404 Display */}
        <div className="mb-6">
          <h1 className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text font-bold text-9xl text-transparent">
            404
          </h1>
        </div>

        {/* Error Message */}
        <div className="mb-12 space-y-4">
          <h2 className="font-bold text-3xl md:text-4xl">Page Not Found</h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Looks like you've gone off track! The page you're looking for doesn't exist or has been
            moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/">
            <Button className="w-full sm:w-auto" size="lg">
              <Home className="mr-2 size-4" />
              Back to Home
            </Button>
          </Link>
          <Link href="/vehicles">
            <Button className="w-full sm:w-auto" size="lg" variant="outline">
              <Search className="mr-2 size-4" />
              Browse Vehicles
            </Button>
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="mt-16">
          <p className="mb-4 text-muted-foreground text-sm">Or try these popular pages:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/vehicles">
              <Button className="text-sm" variant="ghost">
                All Vehicles
              </Button>
            </Link>
            <Link href="/profile">
              <Button className="text-sm" variant="ghost">
                My Profile
              </Button>
            </Link>
            <Link href="/messages">
              <Button className="text-sm" variant="ghost">
                Messages
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
