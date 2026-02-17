"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useQuery } from "convex/react"
import { AlertTriangle, DollarSign, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { api } from "@/lib/convex"

type StatusFilter =
  | undefined
  | "pending_review"
  | "payment_pending"
  | "paid"
  | "rejected"
  | "cancelled"

function getStatusBadge(status: string) {
  switch (status) {
    case "pending_review":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          Pending Review
        </Badge>
      )
    case "payment_pending":
      return (
        <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
          Payment Pending
        </Badge>
      )
    case "paid":
      return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">Paid</Badge>
    case "rejected":
      return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">Rejected</Badge>
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function DamageInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined)

  const invoices = useQuery(api.admin.getAllDamageInvoices, {
    status: statusFilter,
  })

  if (invoices === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const pendingCount = invoices.filter((i) => i.status === "pending_review").length
  const paymentPendingCount = invoices.filter((i) => i.status === "payment_pending").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Damage Claims</h1>
        <p className="mt-2 text-muted-foreground">Review and manage post-rental damage claims</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger onClick={() => setStatusFilter(undefined)} value="all">
            All ({invoices.length})
          </TabsTrigger>
          <TabsTrigger onClick={() => setStatusFilter("pending_review")} value="pending_review">
            Pending Review {pendingCount > 0 && `(${pendingCount})`}
          </TabsTrigger>
          <TabsTrigger onClick={() => setStatusFilter("payment_pending")} value="payment_pending">
            Payment Pending {paymentPendingCount > 0 && `(${paymentPendingCount})`}
          </TabsTrigger>
          <TabsTrigger onClick={() => setStatusFilter("paid")} value="paid">
            Paid
          </TabsTrigger>
          <TabsTrigger onClick={() => setStatusFilter("rejected")} value="rejected">
            Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="all">
          <InvoiceList invoices={invoices} />
        </TabsContent>
        <TabsContent className="mt-6" value="pending_review">
          <InvoiceList invoices={invoices} />
        </TabsContent>
        <TabsContent className="mt-6" value="payment_pending">
          <InvoiceList invoices={invoices} />
        </TabsContent>
        <TabsContent className="mt-6" value="paid">
          <InvoiceList invoices={invoices} />
        </TabsContent>
        <TabsContent className="mt-6" value="rejected">
          <InvoiceList invoices={invoices} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type DamageInvoice = NonNullable<
  ReturnType<typeof useQuery<typeof api.admin.getAllDamageInvoices>>
>[number]

function InvoiceList({ invoices }: { invoices: DamageInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
          <p className="mb-2 font-semibold text-lg">No damage claims found</p>
          <p className="text-muted-foreground">
            Damage claims will appear here when submitted by hosts
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <Link href={`/damage-invoices/${invoice._id}`} key={invoice._id}>
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">
                      {invoice.vehicle?.year} {invoice.vehicle?.make} {invoice.vehicle?.model}
                    </h3>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-sm">
                    <span>Host: {invoice.owner?.name || "Unknown"}</span>
                    <span>Renter: {invoice.renter?.name || "Unknown"}</span>
                    <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <DollarSign className="size-5 text-muted-foreground" />
                  <span className="font-bold text-xl">${(invoice.amount / 100).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
