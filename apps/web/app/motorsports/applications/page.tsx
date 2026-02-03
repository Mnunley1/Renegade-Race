"use client"

import { api } from "@/lib/convex"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { useUser } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, Calendar, FileText, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

type ApplicationStatus = "pending" | "accepted" | "declined" | "withdrawn"

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "outline" },
}

export default function ApplicationsPage() {
  const { user } = useUser()
  const applications = useQuery(
    api.teamApplications.getByDriver,
    user ? {} : "skip"
  )
  const updateStatus = useMutation(api.teamApplications.updateStatus)
  const [activeFilter, setActiveFilter] = useState<"all" | ApplicationStatus>("all")

  const handleWithdraw = async (applicationId: string) => {
    try {
      await updateStatus({
        applicationId: applicationId as any,
        status: "withdrawn",
      })
      toast.success("Application withdrawn")
    } catch {
      toast.error("Failed to withdraw application")
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <p className="text-center text-muted-foreground">
          Please sign in to view your applications
        </p>
      </div>
    )
  }

  if (applications === undefined) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-6 font-bold text-3xl">My Applications</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const filteredApplications =
    activeFilter === "all"
      ? applications
      : applications.filter((app) => app.status === activeFilter)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <Link href="/motorsports">
        <Button className="mb-6" variant="outline">
          <ArrowLeft className="mr-2 size-4" />
          Back to Motorsports
        </Button>
      </Link>

      <h1 className="mb-2 font-bold text-3xl">My Applications</h1>
      <p className="mb-6 text-muted-foreground">
        Track your team applications and their status
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={activeFilter === "all" ? "default" : "outline"}
          onClick={() => setActiveFilter("all")}
        >
          All ({applications.length})
        </Button>
        {(["pending", "accepted", "declined", "withdrawn"] as const).map((status) => {
          const count = applications.filter((app) => app.status === status).length
          return (
            <Button
              key={status}
              size="sm"
              variant={activeFilter === status ? "default" : "outline"}
              onClick={() => setActiveFilter(status)}
            >
              {STATUS_CONFIG[status].label} ({count})
            </Button>
          )
        })}
      </div>

      {filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="mb-2 font-medium">No applications found</p>
            <p className="text-muted-foreground text-sm">
              {activeFilter === "all"
                ? "You haven't applied to any teams yet"
                : `No ${activeFilter} applications`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <Card key={application._id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="font-semibold text-lg">
                        {application.team?.name || "Unknown Team"}
                      </h3>
                      <Badge variant={STATUS_CONFIG[application.status as ApplicationStatus]?.variant || "secondary"}>
                        {STATUS_CONFIG[application.status as ApplicationStatus]?.label || application.status}
                      </Badge>
                    </div>

                    <div className="mb-3 flex items-center gap-1.5 text-muted-foreground text-sm">
                      <Calendar className="size-4" />
                      <span>
                        Applied {new Date(application.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {application.message && (
                      <p className="rounded-lg bg-muted/50 p-3 text-sm">
                        {application.message}
                      </p>
                    )}
                  </div>

                  {application.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleWithdraw(application._id)}
                    >
                      <X className="mr-1 size-4" />
                      Withdraw
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
