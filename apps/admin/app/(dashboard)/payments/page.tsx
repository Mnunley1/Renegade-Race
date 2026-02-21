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
import { format } from "date-fns"
import { Clock, DollarSign, Eye, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar, type FilterConfig } from "@/components/data-table/data-table-toolbar"
import { DateRangeFilter } from "@/components/date-range-filter"
import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { StatusBadge } from "@/components/status-badge"
import { api } from "@/lib/convex"

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "succeeded" | "failed" | "refunded" | undefined
  >(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined
  const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined

  const result = useQuery(api.admin.getAllPayments, {
    status: statusFilter,
    limit: 50,
    search: searchQuery || undefined,
    startDate,
    endDate,
    cursor,
  })

  const payments = result?.payments || []
  const hasMore = result?.hasMore

  useMemo(() => {
    if (statusFilter !== undefined || searchQuery || dateRange) {
      setCurrentPage(1)
      setCursor(undefined)
    }
  }, [statusFilter, searchQuery, dateRange])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setCursor(undefined)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100)

  const totalRevenue = payments
    .filter((p: any) => p.status === "succeeded")
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  const totalRefunded = payments
    .filter((p: any) => p.status === "refunded")
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  const pendingAmount = payments
    .filter((p: any) => p.status === "pending")
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  const columns: Column<any>[] = [
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => <span className="font-semibold">{formatCurrency(row.amount || 0)}</span>,
      sortable: true,
      sortValue: (row) => row.amount || 0,
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
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <span>
          {row.vehicle?.year} {row.vehicle?.make} {row.vehicle?.model}
        </span>
      ),
    },
    {
      key: "paymentId",
      header: "Payment ID",
      cell: (row) => (
        <span className="font-mono text-xs" title={row.stripePaymentIntentId}>
          {row.stripePaymentIntentId ? `${row.stripePaymentIntentId.slice(0, 16)}...` : "N/A"}
        </span>
      ),
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
        <Link href={`/payments/${row._id}`}>
          <Button size="sm" variant="outline">
            <Eye className="mr-2 size-4" />
            View
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
        { label: "Pending", value: "pending" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
      ],
      value: statusFilter,
      onChange: (value) =>
        setStatusFilter(value as "pending" | "succeeded" | "failed" | "refunded" | undefined),
    },
  ]

  const totalPages = Math.ceil((payments.length || 0) / 50) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        description="View and monitor all platform payments"
        title="Payments & Transactions"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Revenue</CardTitle>
            <DollarSign className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{formatCurrency(totalRevenue)}</div>
            <p className="mt-1 text-muted-foreground text-xs">
              {payments.filter((p: any) => p.status === "succeeded").length} successful transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Refunded</CardTitle>
            <RefreshCw className="size-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{formatCurrency(totalRefunded)}</div>
            <p className="mt-1 text-muted-foreground text-xs">
              {payments.filter((p: any) => p.status === "refunded").length} refunded transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending</CardTitle>
            <Clock className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{formatCurrency(pendingAmount)}</div>
            <p className="mt-1 text-muted-foreground text-xs">
              {payments.filter((p: any) => p.status === "pending").length} pending transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
          <CardDescription>
            {payments.length} payment(s) found
            {hasMore && " (showing first page)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={payments}
            emptyMessage="No payments found"
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
                actions={<DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />}
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    payments,
                    [
                      { key: "status", header: "Status", value: (r) => r.status },
                      {
                        key: "amount",
                        header: "Amount",
                        value: (r) => ((r.amount || 0) / 100).toFixed(2),
                      },
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
                        key: "vehicle",
                        header: "Vehicle",
                        value: (r) =>
                          `${r.vehicle?.year ?? ""} ${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""}`.trim(),
                      },
                      {
                        key: "paymentId",
                        header: "Payment ID",
                        value: (r) => r.stripePaymentIntentId ?? "N/A",
                      },
                      {
                        key: "date",
                        header: "Date",
                        value: (r) => new Date(r.createdAt).toLocaleDateString(),
                      },
                    ],
                    "payments"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search payments..."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
