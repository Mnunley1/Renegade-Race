"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { Eye } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar, type FilterConfig } from "@/components/data-table/data-table-toolbar"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { api } from "@/lib/convex"

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

  const columns: Column<any>[] = [
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <span className="font-medium">
          {row.vehicle?.make} {row.vehicle?.model}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (row) => (
        <span className="inline-block max-w-[200px] truncate" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      key: "renter",
      header: "Renter",
      cell: (row) => row.renter?.name || "Unknown",
    },
    {
      key: "owner",
      header: "Owner",
      cell: (row) => row.owner?.name || "Unknown",
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Link href={`/disputes/${row._id}`}>
          <Button size="sm" variant="outline">
            <Eye className="mr-2 size-4" />
            View Details
          </Button>
        </Link>
      ),
    },
  ]

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Open", value: "open" },
        { label: "Resolved", value: "resolved" },
        { label: "Closed", value: "closed" },
      ],
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as "open" | "resolved" | "closed" | undefined),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader description="Manage and resolve rental disputes" title="Disputes Management" />

      <Card>
        <CardHeader>
          <CardTitle>All Disputes</CardTitle>
          <CardDescription>{filteredDisputes?.length || 0} dispute(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredDisputes ?? []}
            emptyMessage="No disputes found"
            getRowId={(row) => row._id}
            isLoading={disputes === undefined}
            toolbar={
              <DataTableToolbar
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    filteredDisputes ?? [],
                    [
                      { key: "status", header: "Status", value: (r) => r.status },
                      {
                        key: "vehicle",
                        header: "Vehicle",
                        value: (r) => `${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""}`.trim(),
                      },
                      { key: "reason", header: "Reason", value: (r) => r.reason ?? "" },
                      {
                        key: "renter",
                        header: "Renter",
                        value: (r) => r.renter?.name ?? "Unknown",
                      },
                      {
                        key: "owner",
                        header: "Owner",
                        value: (r) => r.owner?.name ?? "Unknown",
                      },
                      {
                        key: "date",
                        header: "Date",
                        value: (r) => new Date(r.createdAt).toLocaleDateString(),
                      },
                    ],
                    "disputes"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search disputes..."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
