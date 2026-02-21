"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useMutation, useQuery } from "convex/react"
import { Ban, Loader2, UserCheck } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { StatusBadge } from "@/components/status-badge"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const result = useQuery(api.admin.getAllUsers, {
    limit: 50,
    search: searchQuery || undefined,
    cursor,
  })

  const users = result?.users || []
  const hasMore = result?.hasMore

  const banUser = useMutation(api.admin.banUser)
  const unbanUser = useMutation(api.admin.unbanUser)
  const [processingId, setProcessingId] = useState<Id<"users"> | null>(null)

  useMemo(() => {
    if (searchQuery) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [searchQuery])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setCursor(undefined)
  }

  const handleBan = async (userId: Id<"users">) => {
    if (!confirm("Are you sure you want to ban this user?")) return

    setProcessingId(userId)
    try {
      await banUser({ userId })
      toast.success("User banned successfully")
    } catch (error) {
      handleErrorWithContext(error, { action: "ban user", entity: "user" })
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
      handleErrorWithContext(error, { action: "unban user", entity: "user" })
    } finally {
      setProcessingId(null)
    }
  }

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortable: true,
      sortValue: (row) => row.name ?? "",
    },
    {
      key: "email",
      header: "Email",
      cell: (row) => <span className="text-muted-foreground">{row.email || row.externalId}</span>,
      sortable: true,
      sortValue: (row) => row.email ?? "",
    },
    {
      key: "role",
      header: "Role",
      cell: (row) => (row.role ? <StatusBadge status={row.role} /> : "—"),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (row.isBanned ? <StatusBadge status="banned" /> : null),
    },
    {
      key: "rating",
      header: "Rating",
      cell: (row) => (row.rating ? `${row.rating}/5` : "—"),
      sortable: true,
      sortValue: (row) => row.rating ?? 0,
    },
    {
      key: "totalRentals",
      header: "Rentals",
      cell: (row) => row.totalRentals ?? 0,
      sortable: true,
      sortValue: (row) => row.totalRentals ?? 0,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        const isProcessing = processingId === row._id
        const isBanned = row.isBanned === true
        return (
          <div className="flex gap-2">
            <Link href={`/users/${row._id}`}>
              <Button size="sm" variant="outline">
                View Details
              </Button>
            </Link>
            {isBanned ? (
              <Button
                disabled={isProcessing}
                onClick={() => handleUnban(row._id)}
                size="sm"
                variant="outline"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <UserCheck className="mr-2 size-4" />
                )}
                {isProcessing ? "Processing..." : "Unban"}
              </Button>
            ) : (
              <Button
                disabled={isProcessing}
                onClick={() => handleBan(row._id)}
                size="sm"
                variant="destructive"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Ban className="mr-2 size-4" />
                )}
                {isProcessing ? "Processing..." : "Ban"}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const totalPages = Math.ceil((users.length || 0) / 50) || 1

  return (
    <div className="space-y-6">
      <PageHeader description="Manage users and ban/unban accounts" title="User Management" />

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} user(s) found
            {hasMore && " (showing first page)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={users}
            emptyMessage="No users found"
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
                onExport={() =>
                  exportToCSV(
                    users as any[],
                    [
                      { key: "name", header: "Name", value: (r) => r.name ?? "Unknown" },
                      { key: "email", header: "Email", value: (r) => r.email ?? "" },
                      { key: "role", header: "Role", value: (r) => r.role ?? "" },
                      {
                        key: "status",
                        header: "Status",
                        value: (r) => (r.isBanned ? "Banned" : "Active"),
                      },
                      { key: "rating", header: "Rating", value: (r) => r.rating ?? "" },
                      {
                        key: "totalRentals",
                        header: "Total Rentals",
                        value: (r) => r.totalRentals ?? 0,
                      },
                    ],
                    "users"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search users..."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
