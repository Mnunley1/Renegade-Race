"use client"

import { useAuth, useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useQuery } from "convex/react"
import {
  Calendar,
  Car,
  ChevronDown,
  GraduationCap,
  Heart,
  LogOut,
  MessageSquare,
  Settings,
  User,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AuthLink } from "@/components/auth-link"
import { api } from "@/lib/convex"

function HostMenuItem({
  status,
  pathname,
}: {
  status: string | undefined
  pathname: string | null
}) {
  if (status === "completed") {
    return (
      <DropdownMenuItem asChild className={pathname?.startsWith("/host") ? "bg-accent" : ""}>
        <Link className="flex items-center text-sm" href="/host/dashboard">
          <Car className="mr-3 size-4" />
          Host Dashboard
        </Link>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem asChild>
      <Link className="flex items-center text-sm" href="/host/onboarding">
        <Car className="mr-3 size-4" />
        {status === "in_progress" ? "Continue Host Setup" : "Become a Host"}
        {status === "in_progress" && <span className="ml-auto size-2 rounded-full bg-amber-500" />}
      </Link>
    </DropdownMenuItem>
  )
}

function CoachMenuItem({ hasProfile, pathname }: { hasProfile: boolean; pathname: string | null }) {
  if (hasProfile) {
    return (
      <DropdownMenuItem asChild className={pathname?.startsWith("/coach") ? "bg-accent" : ""}>
        <Link className="flex items-center text-sm" href="/coach/dashboard">
          <GraduationCap className="mr-3 size-4" />
          Coach Dashboard
        </Link>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem asChild>
      <Link className="flex items-center text-sm" href="/coach/onboarding">
        <GraduationCap className="mr-3 size-4" />
        Become a Coach
      </Link>
    </DropdownMenuItem>
  )
}

export function UserMenu() {
  const { user, isSignedIn } = useUser()
  const { signOut } = useAuth()
  const pathname = usePathname()

  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, isSignedIn ? {} : "skip")
  const coachProfile = useQuery(api.coachProfiles.getByUser, isSignedIn ? {} : "skip")
  const unreadCount = useQuery(
    api.messages.getUnreadCount,
    isSignedIn && user?.id ? { userId: user.id } : "skip"
  )

  const handleSignOut = async () => {
    await signOut()
    // Use window.location for full page navigation to ensure auth state updates properly
    window.location.href = "/"
  }

  // Signed-out: show explicit auth actions instead of an empty avatar menu
  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild className="hidden sm:inline-flex" variant="ghost">
          <AuthLink
            fallbackHref={`/sign-in?redirect_url=${encodeURIComponent(pathname || "/")}`}
            path="/sign-in"
          >
            Log in
          </AuthLink>
        </Button>
        <Button asChild>
          <AuthLink fallbackHref="/sign-up" path="/sign-up">
            Sign up
          </AuthLink>
        </Button>
      </div>
    )
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "Account"
  const email = user?.emailAddresses?.[0]?.emailAddress
  const initial = (
    user?.firstName?.[0] ||
    user?.emailAddresses?.[0]?.emailAddress?.[0] ||
    "U"
  ).toUpperCase()

  const isActive = (href: string) => pathname === href

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="flex items-center gap-1.5 rounded-full pr-2 pl-1.5" variant="ghost">
          <Avatar className="size-8 ring-1 ring-border">
            <AvatarImage alt={user?.firstName || "User"} src={user?.imageUrl} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Account header */}
        <DropdownMenuLabel className="flex items-center gap-3 py-2.5">
          <Avatar className="size-9">
            <AvatarImage alt={user?.firstName || "User"} src={user?.imageUrl} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{displayName}</p>
            {email && <p className="truncate font-normal text-muted-foreground text-xs">{email}</p>}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Activity */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className={isActive("/trips") ? "bg-accent" : ""}>
            <Link className="flex items-center text-sm" href="/trips">
              <Calendar className="mr-3 size-4" />
              Trips
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={isActive("/favorites") ? "bg-accent" : ""}>
            <Link className="flex items-center text-sm" href="/favorites">
              <Heart className="mr-3 size-4" />
              Favorites
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={isActive("/messages") ? "bg-accent" : ""}>
            <Link className="flex items-center text-sm" href="/messages">
              <MessageSquare className="mr-3 size-4" />
              Messages
              {unreadCount !== undefined && unreadCount > 0 && (
                <span className="ml-auto flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 py-0.5 font-semibold text-primary-foreground text-xs leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Hosting & coaching */}
        <DropdownMenuGroup>
          <HostMenuItem pathname={pathname} status={onboardingStatus?.status} />
          <CoachMenuItem hasProfile={!!coachProfile} pathname={pathname} />
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Account */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className={isActive("/profile") ? "bg-accent" : ""}>
            <Link className="flex items-center text-sm" href="/profile">
              <User className="mr-3 size-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={isActive("/settings") ? "bg-accent" : ""}>
            <Link className="flex items-center text-sm" href="/settings">
              <Settings className="mr-3 size-4" />
              Account
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive text-sm focus:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="mr-3 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
