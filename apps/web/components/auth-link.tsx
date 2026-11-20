"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { type ComponentProps, type MouseEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { authReturnLink } from "@/lib/auth-return"
import { loadRentalDraft } from "@/lib/rental-draft"

/** Preserve the active checkout query without adding a search-param Suspense boundary to the header. */
export function AuthLink({
  path,
  fallbackHref,
  className,
  children,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & {
  path: "/sign-in" | "/sign-up"
  fallbackHref: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [href, setHref] = useState(fallbackHref)
  const currentHref = () => {
    if (window.location.pathname !== "/checkout") return fallbackHref
    const params = new URLSearchParams(window.location.search)
    if (!params.get("vehicleId")) return fallbackHref
    params.set("resume", "1")
    return authReturnLink(path, `/checkout?${params}`)
  }
  useEffect(() => {
    setHref(currentHref())
  })
  const refreshLink = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.href = currentHref()
  }
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    const destination = currentHref()
    event.currentTarget.href = destination
    if (pathname === "/checkout") {
      const vehicleId = new URLSearchParams(window.location.search).get("vehicleId")
      if (vehicleId && !loadRentalDraft(vehicleId, null)) {
        event.preventDefault()
        toast.error(
          "Your rental choices could not be saved. Enable session storage before signing in."
        )
        return
      }
    }
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    router.push(destination)
  }
  return (
    <Link
      {...props}
      className={className}
      href={href}
      onAuxClick={refreshLink}
      onClick={navigate}
      onContextMenu={refreshLink}
    >
      {children}
    </Link>
  )
}
