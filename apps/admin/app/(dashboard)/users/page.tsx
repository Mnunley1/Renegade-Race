"use client"

import { useQuery, useMutation } from "convex/react"
import { useState } from "react"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Search, Ban, UserCheck, Loader2, Users } from "lucide-react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const users = useQuery(api.admin.getAllUsers, {
    limit: 100,
    search: searchQuery,
  })
  const banUser = useMutation(api.admin.banUser)
  const unbanUser = useMutation(api.admin.unbanUser)
  const [processingId, setProcessingId] = useState<Id<"users"> | null>(null)

  const handleBan = async (userId: Id<"users">) => {
    if (!confirm("Are you sure you want to ban this user?")) {
      return
    }

    setProcessingId(userId)
    try {
      await banUser({ userId })
      toast.success("User banned successfully")
    } catch (error) {
      console.error("Failed to ban user:", error)
      toast.error("An error occurred")
    } finally {
      setProcessingId(null)
    }
  }

  const handleUnban = async (userId: Id<"users">) => {
    setProcessingId(userId)
    try {
      await unbanUser({ userId })
      toast.success("User unbanned successfully")
    } catch (error) {
      console.error("Failed to unban user:", error)
      toast.error("An error occurred")
    } finally {
      setProcessingId(null)
    }
  }

  if (users === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage users and ban/unban accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                {users?.length || 0} user(s) found
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-64 pl-8"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user) => {
                const isProcessing = processingId === user._id
                const isBanned = user.isBanned === true

                return (
                  <Card key={user._id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Users className="size-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{user.name}</h3>
                              {isBanned && (
                                <Badge variant="destructive">Banned</Badge>
                              )}
                              {user.role && (
                                <Badge variant="outline">{user.role}</Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {user.email || user.externalId}
                            </p>
                            <div className="mt-1 flex gap-4 text-muted-foreground text-xs">
                              {user.phone && <span>Phone: {user.phone}</span>}
                              {user.rating && (
                                <span>Rating: {user.rating}/5</span>
                              )}
                              {user.totalRentals !== undefined && (
                                <span>Rentals: {user.totalRentals}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          {isBanned ? (
                            <Button
                              onClick={() => handleUnban(user._id)}
                              disabled={isProcessing}
                              variant="outline"
                              size="sm"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 size-4" />
                                  Unban
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleBan(user._id)}
                              disabled={isProcessing}
                              variant="destructive"
                              size="sm"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Ban className="mr-2 size-4" />
                                  Ban
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-4 size-12 opacity-50" />
              <p>No users found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

