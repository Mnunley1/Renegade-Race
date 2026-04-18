"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

export default function CoachInvoiceSuccessPage() {
  const params = useParams()
  const invoiceId = params.invoiceId as string

  const invoice = useQuery(
    api.coachInvoices.getById,
    invoiceId ? { id: invoiceId as Id<"coachInvoices"> } : "skip"
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="size-8" />
            <CardTitle>Payment received</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoice === undefined ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Confirming invoice…
            </div>
          ) : invoice === null ? (
            <p className="text-muted-foreground">
              We could not load this invoice. If you completed checkout, your payment is still
              processing.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{invoice.description}</p>
              <p className="font-semibold text-2xl">
                ${(invoice.amount / 100).toFixed(2)}{" "}
                <span className="font-normal text-base text-muted-foreground">
                  {invoice.status === "paid" ? "Paid" : "Processing"}
                </span>
              </p>
            </>
          )}
          <Button asChild className="w-full">
            <Link href="/profile">Back to profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
