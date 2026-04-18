"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import {
  Calendar,
  Car,
  GraduationCap,
  Heart,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  User,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HostNavLink } from "@/components/host-nav-link"
import { InboxButton } from "@/components/inbox-button"
import { NotificationBell } from "@/components/notification-bell"
import { UserMenu } from "@/components/user-menu"
import { api } from "@/lib/convex"

const sidebarLinkClass =
  "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors hover:bg-accent"

function HostingSidebarLink({
  onboardingStatus,
  pathname,
}: {
  onboardingStatus: { status: string } | null | undefined
  pathname: string | null
}) {
  if (!onboardingStatus || onboardingStatus.status === "not_started") {
    return (
      <SheetClose asChild>
        <Link className={cn(sidebarLinkClass, "text-muted-foreground")} href="/host/onboarding">
          <Car className="size-4" />
          Become a Host
        </Link>
      </SheetClose>
    )
  }

  if (onboardingStatus.status === "in_progress") {
    return (
      <SheetClose asChild>
        <Link
          className={cn(sidebarLinkClass, "justify-between text-muted-foreground")}
          href="/host/onboarding"
        >
          <span className="flex items-center gap-3">
            <Car className="size-4" />
            Continue Setup
          </span>
          <span className="size-2 rounded-full bg-amber-500" />
        </Link>
      </SheetClose>
    )
  }

  return (
    <SheetClose asChild>
      <Link
        className={cn(
          sidebarLinkClass,
          pathname?.startsWith("/host") ? "bg-accent text-foreground" : "text-muted-foreground"
        )}
        href="/host/dashboard"
      >
        <Car className="size-4" />
        Host Dashboard
      </Link>
    </SheetClose>
  )
}

function MobileSidebar() {
  const pathname = usePathname()
  const { user, isSignedIn } = useUser()
  const { signOut } = useAuth()
  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, isSignedIn ? {} : "skip")
  const unreadCount = useQuery(
    api.messages.getUnreadCount,
    isSignedIn && user?.id ? { userId: user.id } : "skip"
  )

  const handleSignOut = async () => {
    await signOut()
    window.location.href = "/"
  }

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
        <div className="flex h-full flex-col">
          {/* Header */}
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

          {/* Navigation sections */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Browse */}
            <div className="space-y-1">
              <SheetClose asChild>
                <Link
                  className={cn(
                    sidebarLinkClass,
                    pathname === "/vehicles" ? "bg-accent text-foreground" : "text-muted-foreground"
                  )}
                  href="/vehicles"
                >
                  Vehicles
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  className={cn(
                    sidebarLinkClass,
                    pathname === "/motorsports" || pathname?.startsWith("/motorsports")
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground"
                  )}
                  href="/motorsports"
                >
                  Motorsports
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  className={cn(
                    sidebarLinkClass,
                    pathname === "/coaches" || pathname?.startsWith("/coaches")
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground"
                  )}
                  href="/coaches"
                >
                  Coaches
                </Link>
              </SheetClose>
            </div>

            {isSignedIn && (
              <>
                {/* Activity */}
                <Separator className="my-4" />
                <div className="space-y-1">
                  <SheetClose asChild>
                    <Link
                      className={cn(
                        sidebarLinkClass,
                        pathname === "/trips"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground"
                      )}
                      href="/trips"
                    >
                      <Calendar className="size-4" />
                      Trips
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      className={cn(
                        sidebarLinkClass,
                        pathname === "/favorites"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground"
                      )}
                      href="/favorites"
                    >
                      <Heart className="size-4" />
                      Favorites
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      className={cn(
                        sidebarLinkClass,
                        "justify-between",
                        pathname === "/messages"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground"
                      )}
                      href="/messages"
                    >
                      <span className="flex items-center gap-3">
                        <MessageSquare className="size-4" />
                        Inbox
                      </span>
                      {unreadCount !== undefined && unreadCount > 0 && (
                        <span className="flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 font-semibold text-primary-foreground text-xs leading-none">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                  </SheetClose>
                </div>

                {/* Hosting */}
                <Separator className="my-4" />
                <div className="space-y-1">
                  <HostingSidebarLink onboardingStatus={onboardingStatus} pathname={pathname} />
                </div>

                {/* Account */}
                <Separator className="my-4" />
                <div className="space-y-1">
                  <SheetClose asChild>
                    <Link
                      className={cn(
                        sidebarLinkClass,
                        pathname === "/profile"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground"
                      )}
                      href="/profile"
                    >
                      <User className="size-4" />
                      Profile
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      className={cn(
                        sidebarLinkClass,
                        pathname === "/settings"
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground"
                      )}
                      href="/settings"
                    >
                      <Settings className="size-4" />
                      Account
                    </Link>
                  </SheetClose>
                  <button
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 font-medium text-destructive text-sm transition-colors hover:bg-accent"
                    onClick={handleSignOut}
                    type="button"
                  >
                    <LogOut className="size-4" />
                    Log out
                  </button>
                </div>
              </>
            )}

            {!isSignedIn && (
              <>
                <Separator className="my-4" />
                <div className="space-y-1">
                  <SheetClose asChild>
                    <Link
                      className={cn(sidebarLinkClass, "text-muted-foreground")}
                      href={`/sign-in?redirect_url=${encodeURIComponent(pathname || "/")}`}
                    >
                      Sign In
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link className={cn(sidebarLinkClass, "text-muted-foreground")} href="/sign-up">
                      Sign Up
                    </Link>
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
    <nav className="sticky top-0 z-50 border-border border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-6">
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
              <Link
                className={cn(
                  "font-medium text-sm transition-colors hover:text-foreground",
                  pathname === "/vehicles" ? "text-foreground" : "text-muted-foreground"
                )}
                href="/vehicles"
              >
                Vehicles
              </Link>
              <Link
                className={cn(
                  "font-medium text-sm transition-colors hover:text-foreground",
                  pathname === "/motorsports" || pathname?.startsWith("/motorsports")
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                href="/motorsports"
              >
                Motorsports
              </Link>
              <Link
                className={cn(
                  "inline-flex items-center gap-1.5 font-medium text-sm transition-colors hover:text-foreground",
                  pathname === "/coaches" || pathname?.startsWith("/coaches")
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                href="/coaches"
              >
                <GraduationCap className="size-3.5 opacity-80" />
                Coaches
              </Link>
              {isSignedIn && (
                <>
                  <Separator className="h-5" orientation="vertical" />
                  <Link
                    className={cn(
                      "font-medium text-sm transition-colors hover:text-foreground",
                      pathname === "/trips" ? "text-foreground" : "text-muted-foreground"
                    )}
                    href="/trips"
                  >
                    Trips
                  </Link>
                  <Link
                    className={cn(
                      "font-medium text-sm transition-colors hover:text-foreground",
                      pathname === "/favorites" ? "text-foreground" : "text-muted-foreground"
                    )}
                    href="/favorites"
                  >
                    Favorites
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HostNavLink className="hidden md:flex" />
            <InboxButton />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}
