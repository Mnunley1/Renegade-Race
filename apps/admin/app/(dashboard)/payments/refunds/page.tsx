"use client"

import { api } from "@renegade/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { useQuery } from "convex/react"
import { format, formatDistanceToNow } from "date-fns"
import { Download, RefreshCcw, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type { Column } from "@/components/data-table"
import { DataTable, exportToCSV } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { LoadingState } from "@/components/loading-state"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"

export default function RefundsPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const result = useQuery(api.admin.getAllPayments, {
    limit: 500,
  })

  const refundedPayments = useMemo(() => {
    const payments = result?.payments ?? []
    return payments.filter(
      (p: { status: string; refundAmount?: number }) => p.status === "refunded" || p.refundAmount
    )
  }, [result])

  const filteredPayments = useMemo(() => {
    if (!search) return refundedPayments

    const searchLower = search.toLowerCase()
    return refundedPayments.filter((p: any) => {
      const renterName = p.renter?.name?.toLowerCase() || ""
      const ownerName = p.owner?.name?.toLowerCase() || ""
      const reason = p.refundReason?.toLowerCase() || ""
      const id = p._id.toLowerCase()

      return (
        renterName.includes(searchLower) ||
        ownerName.includes(searchLower) ||
        reason.includes(searchLower) ||
        id.includes(searchLower)
      )
    })
  }, [refundedPayments, search])

  const columns: Column<(typeof refundedPayments)[0]>[] = [
    {
      key: "id",
      header: "Payment ID",
      cell: (row) => (
        <Button
          className="h-auto p-0 font-mono text-sm"
          onClick={() => router.push(`/payments/${row._id}`)}
          variant="link"
        >
          {row._id.slice(0, 8)}
        </Button>
      ),
    },
    {
      key: "renter",
      header: "Renter",
      sortable: true,
      sortValue: (row) => row.renter?.name || "",
      cell: (row) => {
        if (!row.renter) return <span className="text-muted-foreground">N/A</span>
        return <UserAvatar email={row.renter.email} name={row.renter.name} />
      },
    },
    {
      key: "owner",
      header: "Owner",
      sortable: true,
      sortValue: (row) => row.owner?.name || "",
      cell: (row) => {
        if (!row.owner) return <span className="text-muted-foreground">N/A</span>
        return <UserAvatar email={row.owner.email} name={row.owner.name} />
      },
    },
    {
      key: "amount",
      header: "Original Amount",
      sortable: true,
      sortValue: (row) => row.amount,
      cell: (row) => <span className="font-semibold">${(row.amount / 100).toFixed(2)}</span>,
    },
    {
      key: "refundAmount",
      header: "Refund Amount",
      sortable: true,
      sortValue: (row) => row.refundAmount || 0,
      cell: (row) => {
        if (!row.refundAmount) return <span className="text-muted-foreground">N/A</span>
        return (
          <span className="font-semibold text-red-600">${(row.refundAmount / 100).toFixed(2)}</span>
        )
      },
    },
    {
      key: "refundReason",
      header: "Reason",
      cell: (row) => {
        if (!row.refundReason) return <span className="text-muted-foreground">N/A</span>
        return (
          <span className="block max-w-xs truncate text-sm" title={row.refundReason}>
            {row.refundReason}
          </span>
        )
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (row) => row.createdAt,
      cell: (row) => (
        <span className="text-muted-foreground text-sm">
          {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
        </span>
      ),
    },
  ]

  const handleExport = () => {
    type PaymentType = (typeof filteredPayments)[0]
    const exportColumns = [
      { key: "id", header: "Payment ID", value: (p: PaymentType) => String(p._id) },
      { key: "renter", header: "Renter", value: (p: PaymentType) => p.renter?.name || "N/A" },
      { key: "owner", header: "Owner", value: (p: PaymentType) => p.owner?.name || "N/A" },
      {
        key: "originalAmount",
        header: "Original Amount",
        value: (p: PaymentType) => (p.amount / 100).toFixed(2),
      },
      {
        key: "refundAmount",
        header: "Refund Amount",
        value: (p: PaymentType) => (p.refundAmount ? (p.refundAmount / 100).toFixed(2) : "N/A"),
      },
      {
        key: "reason",
        header: "Reason",
        value: (p: PaymentType) => (p as { refundReason?: string }).refundReason || "N/A",
      },
      { key: "status", header: "Status", value: (p: PaymentType) => p.status },
      {
        key: "date",
        header: "Date",
        value: (p: PaymentType) => format(new Date(p.createdAt), "yyyy-MM-dd HH:mm"),
      },
    ]
    exportToCSV(filteredPayments, exportColumns, `refunds-${Date.now()}`)
  }

  if (!result) {
    return <LoadingState />
  }

  const totalRefundedAmount = refundedPayments.reduce(
    (sum: number, p: { refundAmount?: number }) => sum + (p.refundAmount || 0),
    0
  )

  return (
    <div className="space-y-6">
      <PageHeader description="View refund history and process new refunds" title="Refunds" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Refunds</CardTitle>
            <RefreshCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{refundedPayments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Refunded</CardTitle>
            <RefreshCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-red-600">
              ${(totalRefundedAmount / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Refund</CardTitle>
            <RefreshCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              $
              {refundedPayments.length > 0
                ? (totalRefundedAmount / 100 / refundedPayments.length).toFixed(2)
                : "0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Refund History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-md flex-1">
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search refunds..."
                    value={search}
                  />
                </div>
              </div>
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {filteredPayments.length === 0 ? (
              <EmptyState
                description={
                  search
                    ? "Try adjusting your search criteria"
                    : "No refunds have been processed yet"
                }
                icon={RefreshCcw}
                title="No refunds found"
              />
            ) : (
              <DataTable columns={columns} data={filteredPayments} getRowId={(row) => row._id} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
