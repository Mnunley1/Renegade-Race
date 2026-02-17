"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

function DamagePaymentSuccessContent() {
  const searchParams = useSearchParams()
  const damageInvoiceId = searchParams.get("damageInvoiceId")

  const invoice = useQuery(
    api.damageInvoices.getById,
    damageInvoiceId ? { id: damageInvoiceId as Id<"damageInvoices"> } : "skip"
  )

  if (!damageInvoiceId) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="mb-2 font-bold text-2xl">Invalid Request</h2>
            <p className="mb-6 text-muted-foreground">Damage invoice ID is missing</p>
            <Button asChild>
              <Link href="/trips">View My Trips</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invoice === undefined) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading payment details...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vehicleName = invoice?.vehicle
    ? `${invoice.vehicle.year} ${invoice.vehicle.make} ${invoice.vehicle.model}`
    : "Vehicle"

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardContent className="py-12">
          <div className="mx-auto max-w-2xl text-center">
            <CheckCircle2 className="mx-auto mb-4 size-16 text-green-500" />
            <h1 className="mb-2 font-bold text-4xl">Payment Confirmed!</h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Your damage charge payment has been processed successfully.
            </p>

            {invoice && (
              <div className="mb-8 rounded-lg border bg-muted/50 p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Vehicle</span>
                    <span>{vehicleName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Amount Paid</span>
                    <span className="font-bold text-2xl">${(invoice.amount / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/trips">View My Trips</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DamagePaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <DamagePaymentSuccessContent />
    </Suspense>
  )
}
