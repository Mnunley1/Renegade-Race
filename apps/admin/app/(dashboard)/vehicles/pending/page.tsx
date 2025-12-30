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
import { CheckCircle, XCircle, Loader2, Car } from "lucide-react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"

export default function VehicleApprovalsPage() {
  const pendingVehicles = useQuery(api.vehicles.getPendingVehicles, { limit: 100 })
  const approveVehicle = useMutation(api.vehicles.approveVehicle)
  const rejectVehicle = useMutation(api.vehicles.rejectVehicle)
  const [processingId, setProcessingId] = useState<Id<"vehicles"> | null>(null)

  const handleApprove = async (vehicleId: Id<"vehicles">) => {
    setProcessingId(vehicleId)
    try {
      await approveVehicle({ vehicleId })
      toast.success("Vehicle approved successfully")
    } catch (error) {
      console.error("Failed to approve vehicle:", error)
      toast.error("An error occurred")
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (vehicleId: Id<"vehicles">) => {
    setProcessingId(vehicleId)
    try {
      await rejectVehicle({ vehicleId })
      toast.success("Vehicle rejected")
    } catch (error) {
      console.error("Failed to reject vehicle:", error)
      toast.error("An error occurred")
    } finally {
      setProcessingId(null)
    }
  }

  if (pendingVehicles === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading pending vehicles...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Vehicle Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve pending vehicle listings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Vehicles</CardTitle>
          <CardDescription>
            {pendingVehicles?.length || 0} vehicle(s) awaiting approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingVehicles && pendingVehicles.length > 0 ? (
            <div className="space-y-4">
              {pendingVehicles.map((vehicle) => {
                const isProcessing = processingId === vehicle._id
                const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]

                return (
                  <Card key={vehicle._id} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex gap-6">
                        {primaryImage && (
                          <div className="flex-shrink-0">
                            <img
                              src={primaryImage.imageUrl}
                              alt={`${vehicle.make} ${vehicle.model}`}
                              className="h-32 w-48 rounded-lg object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 space-y-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg">
                                {vehicle.make} {vehicle.model} {vehicle.year}
                              </h3>
                              <Badge variant="outline">Pending</Badge>
                            </div>
                            <p className="text-muted-foreground mt-1">
                              Track: {vehicle.track?.name || "Unknown"} | Owner:{" "}
                              {vehicle.owner?.name || "Unknown"}
                            </p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-muted-foreground text-sm">
                                <strong>Daily Rate:</strong> ${vehicle.dailyRate}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                <strong>Horsepower:</strong>{" "}
                                {vehicle.horsepower || "N/A"}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                <strong>Transmission:</strong>{" "}
                                {vehicle.transmission || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-sm">
                                <strong>Drivetrain:</strong>{" "}
                                {vehicle.drivetrain || "N/A"}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                <strong>Engine:</strong> {vehicle.engineType || "N/A"}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                <strong>Mileage:</strong>{" "}
                                {vehicle.mileage?.toLocaleString() || "N/A"}
                              </p>
                            </div>
                          </div>

                          {vehicle.description && (
                            <div>
                              <p className="text-muted-foreground text-sm">
                                <strong>Description:</strong>
                              </p>
                              <p className="text-muted-foreground mt-1 text-sm line-clamp-3">
                                {vehicle.description}
                              </p>
                            </div>
                          )}

                          {vehicle.amenities && vehicle.amenities.length > 0 && (
                            <div>
                              <p className="text-muted-foreground text-sm">
                                <strong>Amenities:</strong>{" "}
                                {vehicle.amenities.join(", ")}
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2 pt-4">
                            <Button
                              onClick={() => handleApprove(vehicle._id)}
                              disabled={isProcessing}
                              variant="default"
                              size="sm"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 size-4" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleReject(vehicle._id)}
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
                                  <XCircle className="mr-2 size-4" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Car className="mx-auto mb-4 size-12 opacity-50" />
              <p>No pending vehicles to review</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

