"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { AlertTriangle, Calendar, Loader2, MessageSquare } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"

export default function DisputesPage() {
  const { user } = useUser()

  // Fetch user's disputes
  const disputes = useQuery(api.disputes.getByUser, user?.id ? { userId: user.id } : "skip")

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="size-3" />
            Open
          </Badge>
        )
      case "resolved":
        return (
          <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
            Resolved
          </Badge>
        )
      case "closed":
        return (
          <Badge className="gap-1.5 bg-gray-500/10 text-gray-700 dark:text-gray-400">Closed</Badge>
        )
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (disputes === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">My Disputes</h1>
        <p className="text-muted-foreground">View and manage your rental disputes</p>
      </div>

      {disputes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="mb-2 font-semibold text-lg">No Disputes</p>
            <p className="mb-6 text-muted-foreground">You don't have any disputes at this time.</p>
            <Link href="/trips">
              <Button>View Trips</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const vehicle = dispute.vehicle
            const reservation = dispute.reservation
            if (!(vehicle && reservation)) return null

            const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
            const vehicleImage =
              vehicle.images?.[0]?.cardUrl ||
              vehicle.images?.[0]?.cardUrl ||
              "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400"

            return (
              <Card key={dispute._id}>
                <div className="flex flex-col md:flex-row">
                  {/* Vehicle Image */}
                  <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-auto md:w-64">
                    <img alt={vehicleName} className="size-full object-cover" src={vehicleImage} />
                  </div>

                  {/* Dispute Details */}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <h2 className="font-bold text-xl">{vehicleName}</h2>
                          {getStatusBadge(dispute.status)}
                        </div>
                        <div className="mb-3 flex items-center gap-3 text-muted-foreground text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4" />
                            <span>
                              {formatDate(reservation.startDate)} -{" "}
                              {formatDate(reservation.endDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 space-y-2">
                      <div>
                        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Reason
                        </p>
                        <p className="font-semibold capitalize">
                          {dispute.reason.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Description
                        </p>
                        <p className="line-clamp-2 text-muted-foreground text-sm">
                          {dispute.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">
                        Created {formatDate(new Date(dispute.createdAt).toISOString())}
                      </p>
                      <Link href={`/trips/disputes/${dispute._id}`}>
                        <Button size="sm" variant="outline">
                          <MessageSquare className="mr-2 size-4" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
