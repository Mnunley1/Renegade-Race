"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction, useMutation, useQuery } from "convex/react"
import { ArrowLeft, CheckCircle, Loader2, XCircle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

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

export default function DamageInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as Id<"damageInvoices">

  const invoice = useQuery(api.damageInvoices.getById, { id: invoiceId })
  const adminApprove = useAction(api.damageInvoices.adminApprove)
  const adminReject = useMutation(api.damageInvoices.adminReject)

  const [adminNotes, setAdminNotes] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await adminApprove({
        damageInvoiceId: invoiceId,
        adminNotes: adminNotes || undefined,
      })
      toast.success("Damage claim approved. Payment link sent to renter.")
      router.push("/damage-invoices")
    } catch (error) {
      handleErrorWithContext(error, { action: "approve damage claim", entity: "damage invoice" })
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }

    setIsRejecting(true)
    try {
      await adminReject({
        damageInvoiceId: invoiceId,
        adminNotes,
      })
      toast.success("Damage claim rejected")
      router.push("/damage-invoices")
    } catch (error) {
      handleErrorWithContext(error, { action: "reject damage claim", entity: "damage invoice" })
    } finally {
      setIsRejecting(false)
    }
  }

  if (invoice === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (invoice === null) {
    return (
      <div className="space-y-6">
        <Link href="/damage-invoices">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Damage Claims
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Damage claim not found
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/damage-invoices">
            <Button className="mb-4" variant="ghost">
              <ArrowLeft className="mr-2 size-4" />
              Back to Damage Claims
            </Button>
          </Link>
          <h1 className="font-bold text-3xl">Damage Claim Details</h1>
          <p className="mt-2 text-muted-foreground">Claim ID: {invoice._id}</p>
        </div>
        {getStatusBadge(invoice.status)}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Claim Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Amount</Label>
              <p className="mt-1 font-bold text-2xl">${(invoice.amount / 100).toFixed(2)}</p>
            </div>
            <div>
              <Label>Description</Label>
              <p className="mt-1 whitespace-pre-wrap">{invoice.description}</p>
            </div>
            <div>
              <Label>Created</Label>
              <p className="mt-1">{new Date(invoice.createdAt).toLocaleString()}</p>
            </div>
            {invoice.paidAt && (
              <div>
                <Label>Paid At</Label>
                <p className="mt-1">{new Date(invoice.paidAt).toLocaleString()}</p>
              </div>
            )}
            {invoice.adminNotes && (
              <div>
                <Label>Admin Notes</Label>
                <p className="mt-1 whitespace-pre-wrap">{invoice.adminNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parties Involved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Host (Claimant)</Label>
              <p className="mt-1">{invoice.owner?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">{invoice.owner?.email || "N/A"}</p>
            </div>
            <div>
              <Label>Renter</Label>
              <p className="mt-1">{invoice.renter?.name || "Unknown"}</p>
              <p className="text-muted-foreground text-sm">{invoice.renter?.email || "N/A"}</p>
            </div>
            <div>
              <Label>Vehicle</Label>
              <p className="mt-1">
                {invoice.vehicle?.year} {invoice.vehicle?.make} {invoice.vehicle?.model}
              </p>
            </div>
            {invoice.reservation && (
              <div>
                <Label>Reservation</Label>
                <p className="mt-1">
                  {invoice.reservation.startDate} - {invoice.reservation.endDate}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evidence Photos */}
      {invoice.photos && invoice.photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evidence Photos ({invoice.photos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {invoice.photos.map((photo: string, index: number) => (
                <div
                  className="relative aspect-video overflow-hidden rounded-lg border"
                  key={index}
                >
                  <Image
                    alt={`Damage photo ${index + 1}`}
                    className="object-cover"
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    src={`https://ik.imagekit.io/renegaderace/${photo}?tr=w-400,h-300,q-80,f-auto`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Actions */}
      {invoice.status === "pending_review" && (
        <Card>
          <CardHeader>
            <CardTitle>Review Claim</CardTitle>
            <CardDescription>
              Approve to send a payment link to the renter, or reject with a reason
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adminNotes">Admin Notes</Label>
              <Textarea
                id="adminNotes"
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Optional notes for approval, required for rejection..."
                rows={4}
                value={adminNotes}
              />
            </div>
            <div className="flex gap-4">
              <Button
                className="flex-1"
                disabled={isApproving || isRejecting}
                onClick={handleApprove}
                size="lg"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 size-4" />
                    Approve Claim
                  </>
                )}
              </Button>
              <Button
                className="flex-1"
                disabled={isApproving || isRejecting}
                onClick={handleReject}
                size="lg"
                variant="destructive"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 size-4" />
                    Reject Claim
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stripe Info for payment_pending/paid */}
      {(invoice.status === "payment_pending" || invoice.status === "paid") && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoice.stripeCheckoutSessionId && (
              <div>
                <Label>Checkout Session ID</Label>
                <p className="mt-1 font-mono text-sm">{invoice.stripeCheckoutSessionId}</p>
              </div>
            )}
            {invoice.stripePaymentIntentId && (
              <div>
                <Label>Payment Intent ID</Label>
                <p className="mt-1 font-mono text-sm">{invoice.stripePaymentIntentId}</p>
              </div>
            )}
            {invoice.stripeChargeId && (
              <div>
                <Label>Charge ID</Label>
                <p className="mt-1 font-mono text-sm">{invoice.stripeChargeId}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
