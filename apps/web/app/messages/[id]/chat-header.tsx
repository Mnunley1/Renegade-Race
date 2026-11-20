"use client"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { Archive, Calendar, Car, MoreVertical, Trash2 } from "lucide-react"
import Link from "next/link"
import Image from "@/components/public-image"
import { UserAvatar } from "@/components/user-avatar"
import { r2Url } from "@/lib/r2-url"
import { formatBookingDateRange, getReservationStatusMeta } from "@/lib/reservation-status"

interface VehicleInfo {
  year?: number
  make?: string
  model?: string
}

interface ParticipantInfo {
  name?: string | null
  profileImage?: string | null
  profileImageR2Key?: string | null
}

interface CoachProfileInfo {
  _id: string
}

interface ReservationInfo {
  status: string
  startDate: string
  endDate: string
}

interface ChatHeaderProps {
  participant: ParticipantInfo | null | undefined
  vehicle: VehicleInfo | null | undefined
  vehicleImageKey?: string | null
  vehicleHref?: string | null
  bookingHref?: string | null
  reservation?: ReservationInfo | null
  coachProfile?: CoachProfileInfo | null
  isPending: boolean
  onArchive: () => void
  onDelete: () => void
}

export function ChatHeader({
  participant,
  vehicle,
  vehicleImageKey,
  vehicleHref,
  bookingHref,
  reservation,
  coachProfile,
  isPending,
  onArchive,
  onDelete,
}: ChatHeaderProps) {
  const name = participant?.name || "Unknown User"
  const avatarUrl = r2Url(participant?.profileImageR2Key) ?? participant?.profileImage
  const statusMeta = getReservationStatusMeta(reservation?.status)
  const dateRange = formatBookingDateRange(reservation?.startDate, reservation?.endDate)

  const subtitle = (() => {
    if (coachProfile) {
      return (
        <Link className="underline-offset-2 hover:underline" href={`/coaches/${coachProfile._id}`}>
          Coaching session · view coach profile
        </Link>
      )
    }
    if (vehicle) {
      return `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    }
    return "Conversation"
  })()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center space-x-3">
          {/* Lead with the vehicle photo when present; person avatar as a badge */}
          {vehicleImageKey ? (
            <div className="relative flex-shrink-0">
              <Image
                alt={typeof subtitle === "string" ? subtitle : name}
                className="h-12 w-12 rounded-lg object-cover"
                height={48}
                src={r2Url(vehicleImageKey)}
                width={48}
              />
              <span className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-card">
                <UserAvatar
                  className="h-6 w-6 text-xs"
                  imageUrl={avatarUrl}
                  name={name}
                  size="sm"
                />
              </span>
            </div>
          ) : (
            <UserAvatar imageUrl={avatarUrl} name={name} size="md" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-semibold text-foreground">{name}</h2>
              {statusMeta && (
                <span
                  className={cn(
                    "flex-shrink-0 rounded-full px-1.5 py-0.5 font-medium text-[10px] leading-none",
                    statusMeta.className
                  )}
                >
                  {statusMeta.label}
                </span>
              )}
            </div>
            <p className="truncate text-muted-foreground text-sm">
              {subtitle}
              {dateRange && <span className="text-muted-foreground"> · {dateRange}</span>}
            </p>
          </div>
        </div>
        {!isPending && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Conversation options" size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archive Conversation
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Quick actions to the listing and booking */}
      {(vehicleHref || bookingHref) && (
        <div className="flex flex-wrap gap-2">
          {vehicleHref && (
            <Button asChild size="sm" variant="outline">
              <Link href={vehicleHref}>
                <Car className="mr-1.5 h-3.5 w-3.5" />
                View listing
              </Link>
            </Button>
          )}
          {bookingHref && (
            <Button asChild size="sm" variant="outline">
              <Link href={bookingHref}>
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                View booking
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
