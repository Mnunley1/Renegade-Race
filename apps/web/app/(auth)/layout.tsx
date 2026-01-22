"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isSignUp = pathname?.includes("/sign-up")

  // Sign-up page has its own layout, so don't wrap it
  if (isSignUp) {
    return <>{children}</>
  }

  // Sign-in page uses the centered layout with logo
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background py-4 sm:py-8">
      <div className="w-full max-w-md px-4 sm:px-8">
        {/* Logo centered above forms */}
        <div className="mb-4 flex justify-center sm:mb-6">
          <Link className="transition-opacity hover:opacity-80" href="/">
            <Image
              alt="Renegade Rentals"
              className="rounded-full"
              height={64}
              src="/logo.png"
              width={64}
            />
          </Link>
        </div>

        {children}
      </div>
    </div>
  )
}
