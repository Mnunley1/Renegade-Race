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

type StatusFilter =
  | undefined
  | "pending_review"
  | "payment_pending"
  | "paid"
  | "rejected"
  | "cancelled"

export default function DamageInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined)

  const invoices = useQuery(api.admin.getAllDamageInvoices, {
    status: statusFilter,
  })

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100)

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
          {row.vehicle?.year} {row.vehicle?.make} {row.vehicle?.model}
        </span>
      ),
    },
    {
      key: "host",
      header: "Host",
      cell: (row) => row.owner?.name || "Unknown",
    },
    {
      key: "renter",
      header: "Renter",
      cell: (row) => row.renter?.name || "Unknown",
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span>,
      sortable: true,
      sortValue: (row) => row.amount,
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
        <Link href={`/damage-invoices/${row._id}`}>
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
        { label: "Pending Review", value: "pending_review" },
        { label: "Payment Pending", value: "payment_pending" },
        { label: "Paid", value: "paid" },
        { label: "Rejected", value: "rejected" },
        { label: "Cancelled", value: "cancelled" },
      ],
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as StatusFilter),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader description="Review and manage post-rental damage claims" title="Damage Claims" />

      <Card>
        <CardHeader>
          <CardTitle>All Damage Claims</CardTitle>
          <CardDescription>{invoices?.length || 0} claim(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={invoices ?? []}
            emptyMessage="No damage claims found"
            getRowId={(row) => row._id}
            isLoading={invoices === undefined}
            toolbar={
              <DataTableToolbar
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    invoices ?? [],
                    [
                      { key: "status", header: "Status", value: (r) => r.status },
                      {
                        key: "vehicle",
                        header: "Vehicle",
                        value: (r) =>
                          `${r.vehicle?.year ?? ""} ${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""}`.trim(),
                      },
                      {
                        key: "host",
                        header: "Host",
                        value: (r) => r.owner?.name ?? "Unknown",
                      },
                      {
                        key: "renter",
                        header: "Renter",
                        value: (r) => r.renter?.name ?? "Unknown",
                      },
                      {
                        key: "amount",
                        header: "Amount",
                        value: (r) => (r.amount / 100).toFixed(2),
                      },
                      {
                        key: "date",
                        header: "Date",
                        value: (r) => new Date(r.createdAt).toLocaleDateString(),
                      },
                    ],
                    "damage-claims"
                  )
                }
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
