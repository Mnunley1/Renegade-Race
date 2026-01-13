"use client"

import { useQuery, useMutation } from "convex/react"
import { useState, useMemo } from "react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
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
import { Input } from "@workspace/ui/components/input"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Car,
  Search,
  Ban,
  CheckCircle,
  Eye,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { Pagination } from "@/components/pagination"
import type { Id } from "@/lib/convex"

export default function VehiclesPage() {
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "approved" | "rejected" | undefined
  >(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<Id<"vehicles">>>(new Set())
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const result = useQuery(api.admin.getAllVehicles, {
    status: statusFilter,
    limit: 50,
    search: searchQuery || undefined,
    cursor,
  })

  const vehicles = result?.vehicles || []
  const hasMore = result?.hasMore || false

  const suspendVehicle = useMutation(api.admin.suspendVehicle)
  const bulkSuspendVehicles = useMutation(api.admin.bulkSuspendVehicles)
  const [processingId, setProcessingId] = useState<Id<"vehicles"> | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // Reset to page 1 when filters change
  useMemo(() => {
    if (statusFilter !== undefined || searchQuery) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [statusFilter, searchQuery])

  const handleSuspend = async (vehicleId: Id<"vehicles">, currentStatus: boolean) => {
    setProcessingId(vehicleId)
    try {
      await suspendVehicle({ vehicleId, isActive: !currentStatus })
      toast.success(`Vehicle ${!currentStatus ? "activated" : "suspended"} successfully`)
      setSelectedIds(new Set())
    } catch (error) {
      console.error("Failed to suspend vehicle:", error)
      toast.error("An error occurred")
    } finally {
      setProcessingId(null)
    }
  }

  const handleBulkSuspend = async (isActive: boolean) => {
    if (selectedIds.size === 0) return

    setIsBulkProcessing(true)
    try {
      await bulkSuspendVehicles({
        vehicleIds: Array.from(selectedIds),
        isActive,
      })
      toast.success(
        `${selectedIds.size} vehicle(s) ${isActive ? "activated" : "suspended"} successfully`
      )
      setSelectedIds(new Set())
    } catch (error) {
      console.error("Failed to bulk suspend vehicles:", error)
      toast.error("An error occurred")
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === vehicles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(vehicles.map((v) => v._id)))
    }
  }

  const handleSelectOne = (id: Id<"vehicles">) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setCursor(undefined)
  }

  const getStatusBadge = (status: string, isActive?: boolean) => {
    if (isActive === false) {
      return <Badge variant="destructive">Suspended</Badge>
    }
    switch (status) {
      case "pending":
        return <Badge variant="default">Pending</Badge>
      case "approved":
        return <Badge variant="default" className="bg-green-600">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)
  }

  const totalPages = Math.ceil((vehicles.length || 0) / 50) || 1
  const approvedVehicles = vehicles.filter((v) => v.status === "approved")

  if (result === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading vehicles...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Vehicle Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all platform vehicles
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Vehicles</CardTitle>
              <CardDescription>
                {vehicles.length} vehicle(s) found
                {hasMore && " (showing first page)"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-64 pl-8"
                  placeholder="Search vehicles..."
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted p-3">
              <span className="text-sm font-medium">
                {selectedIds.size} vehicle(s) selected
              </span>
              <div className="flex gap-2">
                {approvedVehicles.some((v) => selectedIds.has(v._id)) && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const selectedApproved = vehicles.filter(
                          (v) => selectedIds.has(v._id) && v.status === "approved"
                        )
                        const allActive = selectedApproved.every((v) => v.isActive !== false)
                        handleBulkSuspend(!allActive)
                      }}
                      disabled={isBulkProcessing}
                    >
                      {isBulkProcessing ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Ban className="mr-2 size-4" />
                          Suspend Selected
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const selectedApproved = vehicles.filter(
                          (v) => selectedIds.has(v._id) && v.status === "approved"
                        )
                        const allSuspended = selectedApproved.every((v) => v.isActive === false)
                        if (allSuspended) {
                          handleBulkSuspend(true)
                        }
                      }}
                      disabled={isBulkProcessing}
                    >
                      <CheckCircle className="mr-2 size-4" />
                      Activate Selected
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {vehicles && vehicles.length > 0 ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Checkbox
                    checked={selectedIds.size === vehicles.length && vehicles.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-muted-foreground text-sm">Select all</span>
                </div>
                {vehicles.map((vehicle) => {
                  const isProcessing = processingId === vehicle._id
                  const isSelected = selectedIds.has(vehicle._id)
                  const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]

                  return (
                    <Card key={vehicle._id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div className="flex items-start pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectOne(vehicle._id)}
                            />
                          </div>
                          <div className="flex gap-6 flex-1">
                            {primaryImage && (
                              <div className="flex-shrink-0">
                                <img
                                  src={primaryImage.cardUrl || primaryImage.imageUrl}
                                  alt={`${vehicle.make} ${vehicle.model}`}
                                  className="h-32 w-48 rounded-lg object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 space-y-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(vehicle.status, vehicle.isActive)}
                                    <h3 className="font-bold text-lg">
                                      {vehicle.year} {vehicle.make} {vehicle.model}
                                    </h3>
                                  </div>
                                  <p className="text-muted-foreground mt-1">
                                    Track: {vehicle.track?.name || "Unknown"} | Owner:{" "}
                                    {vehicle.owner?.name || "Unknown"}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  {vehicle.status === "approved" && (
                                    <Button
                                      onClick={() => handleSuspend(vehicle._id, vehicle.isActive !== false)}
                                      disabled={isProcessing}
                                      variant={vehicle.isActive === false ? "default" : "destructive"}
                                      size="sm"
                                    >
                                      {isProcessing ? (
                                        <>
                                          <Loader2 className="mr-2 size-4 animate-spin" />
                                          Processing...
                                        </>
                                      ) : vehicle.isActive === false ? (
                                        <>
                                          <CheckCircle className="mr-2 size-4" />
                                          Activate
                                        </>
                                      ) : (
                                        <>
                                          <Ban className="mr-2 size-4" />
                                          Suspend
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  <Link href={`/vehicles/${vehicle._id}`}>
                                    <Button variant="outline" size="sm">
                                      <Eye className="mr-2 size-4" />
                                      View Details
                                    </Button>
                                  </Link>
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Daily Rate:</strong> {formatCurrency(vehicle.dailyRate)}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Horsepower:</strong> {vehicle.horsepower || "N/A"}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Transmission:</strong> {vehicle.transmission || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-sm">
                                    <strong>Drivetrain:</strong> {vehicle.drivetrain || "N/A"}
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
                                  <p className="text-muted-foreground mt-1 text-sm line-clamp-2">
                                    {vehicle.description}
                                  </p>
                                </div>
                              )}

                              <div className="flex gap-4 text-muted-foreground text-xs">
                                <span>
                                  <strong>Created:</strong>{" "}
                                  {new Date(vehicle.createdAt).toLocaleDateString()}
                                </span>
                                {vehicle.updatedAt && (
                                  <span>
                                    <strong>Updated:</strong>{" "}
                                    {new Date(vehicle.updatedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {hasMore && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    hasMore={hasMore}
                    onLoadMore={() => {
                      if (result?.nextCursor) {
                        setCursor(result.nextCursor)
                        setCurrentPage(currentPage + 1)
                      }
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Car className="mx-auto mb-4 size-12 opacity-50" />
              <p>No vehicles found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
