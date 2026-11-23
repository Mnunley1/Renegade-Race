"use client"

import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import { Car, GraduationCap, Home, Menu } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AuthLink } from "@/components/auth-link"
import { NotificationBell } from "@/components/notification-bell"
import { UserMenu } from "@/components/user-menu"

const NAV_LINKS = [
  { href: "/vehicles", label: "Rentals", icon: Car },
  { href: "/coaches", label: "Coaching", icon: GraduationCap },
  { href: "/paddock", label: "Paddock", icon: Home },
] as const

const sidebarLinkClass =
  "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors hover:bg-accent"

function isActivePath(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(`${href}/`)
}

function MobileSidebar() {
  const pathname = usePathname()
  const { isSignedIn } = useUser()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="md:hidden" size="icon" variant="ghost">
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-72 p-0" side="left">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SheetDescription className="sr-only">
          Browse rentals, coaching, and the paddock. Account tools are in the user menu.
        </SheetDescription>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2.5 border-border border-b p-6">
            <SheetClose asChild>
              <Link className="flex items-center gap-2.5" href="/">
                <Image
                  alt="Renegade"
                  className="rounded-full"
                  height={32}
                  src="/logo.png"
                  width={32}
                />
                <span
                  className="font-semibold text-foreground text-lg tracking-tight"
                  style={{ fontFamily: "var(--font-header), sans-serif" }}
                >
                  Renegade
                </span>
              </Link>
            </SheetClose>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <SheetClose asChild key={href}>
                  <Link
                    aria-current={isActivePath(pathname, href) ? "page" : undefined}
                    className={cn(
                      sidebarLinkClass,
                      isActivePath(pathname, href)
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground"
                    )}
                    href={href}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                </SheetClose>
              ))}
            </div>
            {!isSignedIn && (
              <>
                <Separator className="my-4" />
                <div className="space-y-1">
                  <SheetClose asChild>
                    <AuthLink
                      className={cn(sidebarLinkClass, "text-muted-foreground")}
                      fallbackHref={`/sign-in?redirect_url=${encodeURIComponent(pathname || "/")}`}
                      path="/sign-in"
                    >
                      Sign In
                    </AuthLink>
                  </SheetClose>
                  <SheetClose asChild>
                    <AuthLink
                      className={cn(sidebarLinkClass, "text-muted-foreground")}
                      fallbackHref="/sign-up"
                      path="/sign-up"
                    >
                      Sign Up
                    </AuthLink>
                  </SheetClose>
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function Navigation() {
  const pathname = usePathname()
  const { isSignedIn } = useUser()

  return (
    <nav
      aria-label="Primary navigation"
      className="sticky top-0 z-50 border-border border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-4">
            <MobileSidebar />
            <Link
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
              href="/"
            >
              <Image
                alt="Renegade"
                className="rounded-full"
                height={32}
                src="/logo.png"
                width={32}
              />
              <span
                className="font-semibold text-foreground text-lg tracking-tight"
                style={{ fontFamily: "var(--font-header), sans-serif" }}
              >
                Renegade
              </span>
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  aria-current={isActivePath(pathname, href) ? "page" : undefined}
                  className={cn(
                    "font-medium text-sm transition-colors hover:text-foreground",
                    isActivePath(pathname, href) ? "text-foreground" : "text-muted-foreground"
                  )}
                  href={href}
                  key={href}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isSignedIn && <NotificationBell />}
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}
