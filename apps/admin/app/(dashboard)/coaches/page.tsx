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
import { Ban, CheckCircle, ExternalLink, Loader2, MoreHorizontal, XCircle } from "lucide-react"
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

function getCoachStatus(row: { isSuspended?: boolean; isApproved?: boolean }): string {
  if (row.isSuspended === true) return "suspended"
  if (row.isApproved === true) return "approved"
  if (row.isApproved === false) return "denied"
  return "pending"
}

export default function AdminCoachesPage() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "denied" | undefined>(
    undefined
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const backendStatus = statusFilter === "denied" ? ("rejected" as const) : statusFilter

  const result = useQuery(api.admin.getAllCoachServices, {
    status: backendStatus,
    limit: 50,
    search: searchQuery || undefined,
    cursor,
  })

  const services = result?.coachServices || []
  const hasMore = result?.hasMore

  const approveCoachService = useMutation(api.coachServices.approveCoachService)
  const rejectCoachService = useMutation(api.coachServices.rejectCoachService)
  const suspendCoachService = useMutation(api.admin.suspendCoachService)
  const [processingId, setProcessingId] = useState<Id<"coachServices"> | null>(null)

  useMemo(() => {
    if (statusFilter !== undefined || searchQuery) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [statusFilter, searchQuery])

  const handleApprove = async (id: Id<"coachServices">) => {
    setProcessingId(id)
    try {
      await approveCoachService({ coachServiceId: id })
      toast.success("Coach program approved")
    } catch (error) {
      handleErrorWithContext(error, { action: "approve coach program" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeny = async (id: Id<"coachServices">) => {
    setProcessingId(id)
    try {
      await rejectCoachService({ coachServiceId: id })
      toast.success("Coach program rejected")
    } catch (error) {
      handleErrorWithContext(error, { action: "reject coach program" })
    } finally {
      setProcessingId(null)
    }
  }

  const handleSuspend = async (id: Id<"coachServices">, suspend: boolean) => {
    setProcessingId(id)
    try {
      await suspendCoachService({ coachServiceId: id, isSuspended: suspend })
      toast.success(`Program ${suspend ? "suspended" : "unsuspended"}`)
    } catch (error) {
      handleErrorWithContext(error, { action: "suspend coach program" })
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
      cell: (row) => <StatusBadge status={getCoachStatus(row)} />,
    },
    {
      key: "title",
      header: "Program",
      cell: (row) => <span className="font-medium">{row.title}</span>,
      sortable: true,
      sortValue: (row) => row.title ?? "",
    },
    {
      key: "track",
      header: "Track",
      cell: (row) => row.track?.name || "—",
    },
    {
      key: "coach",
      header: "Coach",
      cell: (row) => row.coach?.name || row.coach?.email || "—",
    },
    {
      key: "baseRate",
      header: "Base rate",
      cell: (row) => <span className="font-semibold">{formatCurrency(row.baseRate)}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        const isProcessing = processingId === row._id
        const status = getCoachStatus(row)
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
                <Link href={`/coaches/${row._id}`} rel="noreferrer" target="_blank">
                  <ExternalLink className="mr-2 size-4" />
                  Open public page
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
                  Reject
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

  const totalPages = Math.ceil((services.length || 0) / 50) || 1

  return (
    <div className="space-y-6">
      <PageHeader description="Approve or suspend coach marketplace listings." title="Coaches" />

      <Card>
        <CardHeader>
          <CardTitle>Coach programs</CardTitle>
          <CardDescription>
            {services.length} program(s) found
            {hasMore && " (more available — use load more)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={services}
            emptyMessage="No coach programs found"
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
                    services as any[],
                    [
                      {
                        key: "status",
                        header: "Status",
                        value: (r) => getCoachStatus(r),
                      },
                      {
                        key: "title",
                        header: "Program",
                        value: (r) => r.title ?? "",
                      },
                      {
                        key: "track",
                        header: "Track",
                        value: (r) => r.track?.name ?? "",
                      },
                      {
                        key: "coach",
                        header: "Coach",
                        value: (r) => r.coach?.name ?? r.coach?.email ?? "",
                      },
                      {
                        key: "baseRate",
                        header: "Base rate (cents)",
                        value: (r) => String(r.baseRate ?? 0),
                      },
                    ],
                    "coach-programs"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search programs..."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
