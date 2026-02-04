"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useQuery } from "convex/react"
import {
  Calendar,
  Car,
  HeadphonesIcon,
  Heart,
  HelpCircle,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  User,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { api } from "@/lib/convex"

export function UserMenu() {
  const { user, isSignedIn } = useUser()
  const { signOut } = useAuth()
  const pathname = usePathname()
  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, isSignedIn ? {} : "skip")
  const unreadCount = useQuery(
    api.messages.getUnreadCount,
    isSignedIn && user?.id ? { userId: user.id } : "skip"
  )

  const handleSignOut = async () => {
    await signOut()
    // Use window.location for full page navigation to ensure auth state updates properly
    window.location.href = "/"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="relative flex items-center gap-2 px-3 py-5" variant="ghost">
          <Menu className="size-5" />
          <div className="relative">
            <Avatar className="size-8">
              {isSignedIn ? (
                <>
                  <AvatarImage alt={user?.firstName || "User"} src={user?.imageUrl} />
                  <AvatarFallback>
                    {(
                      user?.firstName?.[0] ||
                      user?.emailAddresses?.[0]?.emailAddress?.[0] ||
                      "U"
                    ).toUpperCase()}
                  </AvatarFallback>
                </>
              ) : (
                <AvatarFallback>
                  <User className="size-5" />
                </AvatarFallback>
              )}
            </Avatar>
            {unreadCount !== undefined && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 font-semibold text-primary-foreground text-xs leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {isSignedIn ? (
          <>
            {/* Quick Actions Section */}
            <DropdownMenuItem asChild>
              <Link className="flex items-center text-sm" href="/favorites">
                <Heart className="mr-3 size-4" />
                Favorites
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="flex items-center text-sm" href="/trips">
                <Calendar className="mr-3 size-4" />
                Trips
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="flex items-center text-sm" href="/messages">
                <MessageSquare className="mr-3 size-4" />
                <span>Inbox</span>
                {unreadCount !== undefined && unreadCount > 0 && (
                  <Badge className="ml-auto" variant="destructive">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Host Section */}
            {isSignedIn &&
              (!onboardingStatus || onboardingStatus.status === "not_started" ? (
                <DropdownMenuItem asChild>
                  <Link className="flex items-center text-sm" href="/host/onboarding">
                    <Car className="mr-3 size-4" />
                    Become a Host
                  </Link>
                </DropdownMenuItem>
              ) : onboardingStatus.status === "in_progress" ? (
                <DropdownMenuItem asChild>
                  <Link
                    className="flex items-center justify-between text-sm"
                    href="/host/onboarding"
                  >
                    <span className="flex items-center">
                      <Car className="mr-3 size-4 shrink-0" />
                      <span>Continue Setup</span>
                    </span>
                    <span className="ml-2 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/30 dark:text-amber-400">
                      In Progress
                    </span>
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link className="flex items-center text-sm" href="/host/dashboard">
                    <Car className="mr-3 size-4" />
                    Host Dashboard
                  </Link>
                </DropdownMenuItem>
              ))}

            <DropdownMenuSeparator />

            {/* User Account Section */}
            <DropdownMenuItem asChild>
              <Link className="flex items-center text-sm" href="/profile">
                <User className="mr-3 size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={pathname === "/settings" ? "bg-accent" : ""}>
              <Link className="flex items-center text-sm" href="/settings">
                <Settings className="mr-3 size-4" />
                Account
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Help & Info Section */}
            <DropdownMenuItem asChild>
              <Link className="flex items-center text-sm" href="/help">
                <HelpCircle className="mr-3 size-4" />
                Help
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="flex items-center text-sm" href="/contact">
                <HeadphonesIcon className="mr-3 size-4" />
                Contact Renegade
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Sign Out */}
            <DropdownMenuItem
              className="text-destructive text-sm focus:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 size-4" />
              Log out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link
                className="flex items-center text-sm"
                href={`/sign-in?redirect_url=${encodeURIComponent(pathname || "/")}`}
              >
                Sign In
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="flex items-center text-sm" href="/sign-up">
                Sign Up
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
