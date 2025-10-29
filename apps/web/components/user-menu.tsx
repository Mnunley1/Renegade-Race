"use client"

import { SignedIn, useAuth, useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Calendar,
  HeadphonesIcon,
  Heart,
  HelpCircle,
  Info,
  LogOut,
  MessageSquare,
  Settings,
  User,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

export function UserMenu() {
  const { user } = useUser()
  const { signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  return (
    <SignedIn>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="relative size-9 rounded-full" variant="ghost">
            <Avatar className="size-9">
              <AvatarImage alt={user?.firstName || "User"} src={user?.imageUrl} />
              <AvatarFallback>
                {(
                  user?.firstName?.[0] ||
                  user?.emailAddresses?.[0]?.emailAddress?.[0] ||
                  "U"
                ).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
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
              Inbox
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* User Account Section */}
          <DropdownMenuItem asChild>
            <Link className="flex items-center text-sm" href="/profile">
              <User className="mr-3 size-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={pathname === "/profile/settings" ? "bg-accent" : ""}>
            <Link className="flex items-center text-sm" href="/profile/settings">
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
            <Link className="flex items-center text-sm" href="/help">
              <Info className="mr-3 size-4" />
              Why choose Renegade
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link className="flex items-center text-sm" href="/contact">
              <HeadphonesIcon className="mr-3 size-4" />
              Contact support
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
        </DropdownMenuContent>
      </DropdownMenu>
    </SignedIn>
  )
}
