"use client"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { Archive, MoreVertical, Trash2 } from "lucide-react"

interface VehicleInfo {
  year?: number
  make?: string
  model?: string
}

interface ParticipantInfo {
  name?: string | null
}

interface ChatHeaderProps {
  participant: ParticipantInfo | null | undefined
  vehicle: VehicleInfo | null | undefined
  isPending: boolean
  onArchive: () => void
  onDelete: () => void
}

export function ChatHeader({
  participant,
  vehicle,
  isPending,
  onArchive,
  onDelete,
}: ChatHeaderProps) {
  const name = participant?.name || "Unknown User"
  const vehicleLabel = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    : "Vehicle conversation"

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <UserAvatar name={name} size="md" />
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-foreground">{name}</h2>
          <p className="truncate text-muted-foreground text-sm">{vehicleLabel}</p>
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
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
