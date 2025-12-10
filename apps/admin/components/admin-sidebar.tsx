"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  Mail,
  MessageSquare,
  Shield,
  Users,
  Car,
  MapPin,
  LayoutDashboard,
  LogOut,
  User,
  Settings,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { useClerk, useUser } from "@clerk/nextjs"

const navigation = [
  { name: "User Management", href: "/users", icon: Users },
  { name: "Emails", href: "/mass-emails", icon: Mail },
  { name: "Direct Messages", href: "/messages", icon: MessageSquare },
  { name: "Vehicle Approvals", href: "/vehicles/pending", icon: Car },
  { name: "Track Management", href: "/tracks", icon: MapPin },
  { name: "Disputes", href: "/disputes", icon: Shield },
  { name: "Platform Settings", href: "/settings", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()

  const handleSignOut = () => {
    signOut({ redirectUrl: "/sign-in" })
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Renegade Logo"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="font-bold text-lg">Admin Portal</span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <User className="mr-2 size-4" />
              <span className="flex-1 text-left">
                {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "User"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || "Admin User"}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 size-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

