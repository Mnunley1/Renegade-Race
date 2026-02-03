"use client"

import { useQuery } from "convex/react"
import { useState } from "react"
import Link from "next/link"
import { api } from "@/lib/convex"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Badge } from "@workspace/ui/components/badge"
import { ArrowRight, Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"

export default function DisputesPage() {
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "closed" | undefined>(
    undefined
  )
  const [searchQuery, setSearchQuery] = useState("")
  const disputes = useQuery(api.admin.getAllDisputes, {
    status: statusFilter,
    limit: 100,
  })

  const filteredDisputes = disputes?.filter((dispute: any) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      dispute.renter?.name?.toLowerCase().includes(query) ||
      dispute.owner?.name?.toLowerCase().includes(query) ||
      dispute.reason?.toLowerCase().includes(query) ||
      dispute.description?.toLowerCase().includes(query)
    )
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>
      case "resolved":
        return <Badge variant="default">Resolved</Badge>
      case "closed":
        return <Badge variant="secondary">Closed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (disputes === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading disputes...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Disputes Management</h1>
        <p className="mt-2 text-muted-foreground">Manage and resolve rental disputes</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Disputes</CardTitle>
              <CardDescription>{filteredDisputes?.length || 0} dispute(s) found</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="-translate-y-1/2 absolute top-1/2 left-2 size-4 text-muted-foreground" />
                <Input
                  className="w-64 pl-8"
                  placeholder="Search disputes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) =>
                  setStatusFilter(value === "all" ? undefined : (value as any))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredDisputes && filteredDisputes.length > 0 ? (
            <div className="space-y-4">
              {filteredDisputes.map((dispute: any) => (
                <Link key={dispute._id} href={`/disputes/${dispute._id}`} className="block">
                  <Card className="transition-colors hover:bg-accent">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(dispute.status)}
                            <span className="font-medium">
                              {dispute.vehicle?.make} {dispute.vehicle?.model}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            <strong>Reason:</strong> {dispute.reason}
                          </p>
                          <p className="line-clamp-2 text-muted-foreground text-sm">
                            {dispute.description}
                          </p>
                          <div className="flex gap-4 text-muted-foreground text-xs">
                            <span>
                              <strong>Renter:</strong> {dispute.renter?.name || "Unknown"}
                            </span>
                            <span>
                              <strong>Owner:</strong> {dispute.owner?.name || "Unknown"}
                            </span>
                            <span>
                              <strong>Created:</strong>{" "}
                              {new Date(dispute.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">No disputes found</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
