"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useMutation, useQuery } from "convex/react"
import { Ban, CheckCircle, Eye, Loader2, MoreHorizontal, XCircle } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar, type FilterConfig } from "@/components/data-table/data-table-toolbar"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { StatusBadge } from "@/components/status-badge"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

function getVehicleStatus(vehicle: any): string {
  if (vehicle.isSuspended === true) return "suspended"
  if (vehicle.isApproved === true) return "approved"
  if (vehicle.isApproved === false) return "denied"
  return "pending"
}

export default function VehiclesPage() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "denied" | undefined>(
    undefined
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  // Map frontend "denied" to backend "rejected" status
  const backendStatus = statusFilter === "denied" ? ("rejected" as const) : statusFilter

  const result = useQuery(api.admin.getAllVehicles, {
    status: backendStatus,
    limit: 50,
    search: searchQuery || undefined,
    cursor,
  })

  const vehicles = result?.vehicles || []
  const hasMore = result?.hasMore

  const approveVehicle = useMutation(api.vehicles.approveVehicle)
  const rejectVehicle = useMutation(api.vehicles.rejectVehicle)
  const suspendVehicle = useMutation(api.admin.suspendVehicle)
  const [processingId, setProcessingId] = useState<Id<"vehicles"> | null>(null)

  useMemo(() => {
    if (statusFilter !== undefined || searchQuery) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [statusFilter, searchQuery])

  const handleApprove = async (vehicleId: Id<"vehicles">) => {
    setProcessingId(vehicleId)
    try {
      await approveVehicle({ vehicleId })
      toast.success("Vehicle approved successfully")
    } catch (error) {
      handleErrorWithContext(error, { action: "approve vehicle", entity: "vehicle" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeny = async (vehicleId: Id<"vehicles">) => {
    setProcessingId(vehicleId)
    try {
      await rejectVehicle({ vehicleId })
      toast.success("Vehicle denied")
    } catch (error) {
      handleErrorWithContext(error, { action: "deny vehicle", entity: "vehicle" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleSuspend = async (vehicleId: Id<"vehicles">, suspend: boolean) => {
    setProcessingId(vehicleId)
    try {
      await suspendVehicle({ vehicleId, isSuspended: suspend })
      toast.success(`Vehicle ${suspend ? "suspended" : "unsuspended"} successfully`)
    } catch (error) {
      handleErrorWithContext(error, { action: "suspend vehicle", entity: "vehicle" })
    } finally {
      setProcessingId(null)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setCursor(undefined)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)

  const columns: Column<any>[] = [
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={getVehicleStatus(row)} />,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <span className="font-medium">
          {row.year} {row.make} {row.model}
        </span>
      ),
      sortable: true,
      sortValue: (row) => `${row.year ?? ""} ${row.make ?? ""} ${row.model ?? ""}`,
    },
    {
      key: "track",
      header: "Track",
      cell: (row) => row.track?.name || "Unknown",
      sortable: true,
      sortValue: (row) => row.track?.name ?? "",
    },
    {
      key: "owner",
      header: "Owner",
      cell: (row) => row.owner?.name || "Unknown",
      sortable: true,
      sortValue: (row) => row.owner?.name ?? "",
    },
    {
      key: "dailyRate",
      header: "Daily Rate",
      cell: (row) => <span className="font-semibold">{formatCurrency(row.dailyRate)}</span>,
      sortable: true,
      sortValue: (row) => row.dailyRate || 0,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        const isProcessing = processingId === row._id
        const status = getVehicleStatus(row)
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isProcessing} size="sm" variant="outline">
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/vehicles/${row._id}`}>
                  <Eye className="mr-2 size-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {status !== "approved" && (
                <DropdownMenuItem onClick={() => handleApprove(row._id)}>
                  <CheckCircle className="mr-2 size-4" />
                  Approve
                </DropdownMenuItem>
              )}
              {status !== "denied" && (
                <DropdownMenuItem onClick={() => handleDeny(row._id)}>
                  <XCircle className="mr-2 size-4" />
                  Deny
                </DropdownMenuItem>
              )}
              {status !== "suspended" && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleSuspend(row._id, true)}
                >
                  <Ban className="mr-2 size-4" />
                  Suspend
                </DropdownMenuItem>
              )}
              {status === "suspended" && (
                <DropdownMenuItem onClick={() => handleSuspend(row._id, false)}>
                  <CheckCircle className="mr-2 size-4" />
                  Unsuspend
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Denied", value: "denied" },
      ],
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as "pending" | "approved" | "denied" | undefined),
    },
  ]

  const totalPages = Math.ceil((vehicles.length || 0) / 50) || 1

  return (
    <div className="space-y-6">
      <PageHeader description="View and manage all platform vehicles" title="Vehicle Management" />

      <Card>
        <CardHeader>
          <CardTitle>All Vehicles</CardTitle>
          <CardDescription>
            {vehicles.length} vehicle(s) found
            {hasMore && " (showing first page)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={vehicles}
            emptyMessage="No vehicles found"
            getRowId={(row) => row._id}
            isLoading={result === undefined}
            pagination={
              hasMore ? (
                <Pagination
                  currentPage={currentPage}
                  hasMore={hasMore}
                  onLoadMore={() => {
                    if (result?.nextCursor) {
                      setCursor(result.nextCursor)
                      setCurrentPage(currentPage + 1)
                    }
                  }}
                  onPageChange={handlePageChange}
                  totalPages={totalPages}
                />
              ) : undefined
            }
            toolbar={
              <DataTableToolbar
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    vehicles as any[],
                    [
                      {
                        key: "status",
                        header: "Status",
                        value: (r) => getVehicleStatus(r),
                      },
                      {
                        key: "vehicle",
                        header: "Vehicle",
                        value: (r) => `${r.year ?? ""} ${r.make ?? ""} ${r.model ?? ""}`.trim(),
                      },
                      {
                        key: "track",
                        header: "Track",
                        value: (r) => r.track?.name ?? "Unknown",
                      },
                      {
                        key: "owner",
                        header: "Owner",
                        value: (r) => r.owner?.name ?? "Unknown",
                      },
                      {
                        key: "dailyRate",
                        header: "Daily Rate",
                        value: (r) => ((r.dailyRate || 0) / 100).toFixed(0),
                      },
                    ],
                    "vehicles"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search vehicles..."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
