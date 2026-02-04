"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useQuery } from "convex/react"
import { format } from "date-fns"
import {
  ArrowRight,
  CheckCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Pagination } from "@/components/pagination"
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

  // Reset to page 1 when filters change
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-600" variant="default">
            <Clock className="mr-1 size-3" />
            Pending
          </Badge>
        )
      case "succeeded":
        return (
          <Badge className="bg-green-600" variant="default">
            <CheckCircle className="mr-1 size-3" />
            Succeeded
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 size-3" />
            Failed
          </Badge>
        )
      case "refunded":
        return (
          <Badge variant="secondary">
            <RefreshCw className="mr-1 size-3" />
            Refunded
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100)

  // Calculate totals
  const totalRevenue = payments
    .filter((p: any) => p.status === "succeeded")
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  const totalRefunded = payments
    .filter((p: any) => p.status === "refunded")
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  const pendingAmount = payments
    .filter((p: any) => p.status === "pending")
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  const totalPages = Math.ceil((payments.length || 0) / 50) || 1

  if (result === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading payments...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Payments & Transactions</h1>
        <p className="mt-2 text-muted-foreground">View and monitor all platform payments</p>
      </div>

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Payments</CardTitle>
              <CardDescription>
                {payments.length} payment(s) found
                {hasMore && " (showing first page)"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <div className="relative">
                <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-64 pl-8"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search payments..."
                  value={searchQuery}
                />
              </div>
              <Select
                onValueChange={(value) =>
                  setStatusFilter(
                    value === "all"
                      ? undefined
                      : (value as "pending" | "succeeded" | "failed" | "refunded")
                  )
                }
                value={statusFilter || "all"}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <>
              <div className="space-y-4">
                {payments.map((payment: any) => {
                  const primaryImage =
                    payment.vehicle?.images?.find((img: any) => img.isPrimary) ||
                    payment.vehicle?.images?.[0]

                  return (
                    <Link className="block" href={`/payments/${payment._id}`} key={payment._id}>
                      <Card className="transition-colors hover:bg-accent">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-1 gap-4">
                              {primaryImage && (
                                <div className="flex-shrink-0">
                                  <img
                                    alt={`${payment.vehicle?.make} ${payment.vehicle?.model}`}
                                    className="h-20 w-32 rounded-lg object-cover"
                                    src={primaryImage.cardUrl || primaryImage.imageUrl}
                                  />
                                </div>
                              )}
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(payment.status)}
                                  <span className="font-medium">
                                    {formatCurrency(payment.amount || 0)}
                                  </span>
                                </div>
                                <div className="grid gap-2 text-sm md:grid-cols-2">
                                  <div>
                                    <p className="text-muted-foreground">
                                      <strong>Renter:</strong> {payment.renter?.name || "Unknown"}
                                    </p>
                                    <p className="text-muted-foreground">
                                      <strong>Owner:</strong> {payment.owner?.name || "Unknown"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      <strong>Vehicle:</strong> {payment.vehicle?.year}{" "}
                                      {payment.vehicle?.make} {payment.vehicle?.model}
                                    </p>
                                    <p className="text-muted-foreground">
                                      <strong>Payment ID:</strong>{" "}
                                      {payment.stripePaymentIntentId || "N/A"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-4 text-muted-foreground text-xs">
                                  <span>
                                    <strong>Created:</strong>{" "}
                                    {new Date(payment.createdAt).toLocaleString()}
                                  </span>
                                  {payment.updatedAt && (
                                    <span>
                                      <strong>Updated:</strong>{" "}
                                      {new Date(payment.updatedAt).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ArrowRight className="text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
              {hasMore && (
                <div className="mt-4">
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
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <DollarSign className="mx-auto mb-4 size-12 opacity-50" />
              <p>No payments found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
