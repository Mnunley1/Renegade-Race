"use client"

import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation, useQuery } from "convex/react"
import { UserMinus, Users } from "lucide-react"
import { toast } from "sonner"

interface TeamRosterProps {
  teamId: Id<"teams">
  isOwner: boolean
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  driver: "Driver",
  crew: "Crew",
}

export function TeamRoster({ teamId, isOwner }: TeamRosterProps) {
  const members = useQuery(api.teamMembers.getByTeam, { teamId })
  const removeMember = useMutation(api.teamMembers.removeMember)
  const updateRole = useMutation(api.teamMembers.updateRole)

  const handleRemove = async (memberId: Id<"teamMembers">) => {
    try {
      await removeMember({ memberId })
      toast.success("Member removed from team")
    } catch {
      toast.error("Failed to remove member")
    }
  }

  const handleRoleUpdate = async (
    memberId: Id<"teamMembers">,
    newRole: "driver" | "crew" | "manager"
  ) => {
    try {
      await updateRole({ memberId, role: newRole })
      toast.success("Member role updated")
    } catch {
      toast.error("Failed to update role")
    }
  }

  if (members === undefined) {
    return null
  }

  if (members.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" />
          Team Roster ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => (
          <div
            key={member._id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{member.user?.name || "Unknown"}</span>
                <Badge variant="secondary">
                  {ROLE_LABELS[member.role] || member.role}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Joined {new Date(member.joinedAt).toLocaleDateString()}
              </p>
            </div>

            {isOwner && member.role !== "owner" && (
              <div className="flex items-center gap-2">
                <Select
                  value={member.role}
                  onValueChange={(value) =>
                    handleRoleUpdate(
                      member._id,
                      value as "driver" | "crew" | "manager"
                    )
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="crew">Crew</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(member._id)}
                >
                  <UserMinus className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
