"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { useAction, useMutation, useQuery } from "convex/react"
import { Banknote, CreditCard, ExternalLink, Loader2, RotateCcw } from "lucide-react"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PageHeader, PageShell } from "@/components/page-layout"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

const statusLabel = (status: string) => status.replace(/_/g, " ")

export default function InvoiceDetailPage() {
  const params = useParams()
  const invoiceId = params.id as Id<"invoices">
  const { user } = useUser()
  const invoice = useQuery(api.invoices.getById, { invoiceId })
  const markViewed = useMutation(api.invoices.markViewed)
  const choosePaymentMethod = useAction(api.invoices.choosePaymentMethod)
  const openHostedInvoice = useAction(api.invoices.openHostedInvoice)
  const [isOpening, setIsOpening] = useState(false)
  const refundDeposit = useAction(api.invoices.refundDeposit)
  const [isChoosing, setIsChoosing] = useState<"stripe_card" | "stripe_ach" | null>(null)
  const [refundAmount, setRefundAmount] = useState("")
  const [isRefunding, setIsRefunding] = useState(false)

  useEffect(() => {
    if (invoice?._id && invoice.recipientId === user?.id) {
      markViewed({ invoiceId }).catch(() => undefined)
    }
  }, [invoice?._id, invoice?.recipientId, invoiceId, markViewed, user?.id])

  if (invoice === undefined) {
    return (
      <PageShell>
        <PageHeader backLink={{ href: "/deals/invoices", label: "Invoices" }} title="Invoice" />
        <div
          aria-label="Loading invoice"
          className="flex items-center justify-center gap-2 py-12"
          role="status"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span>Loading invoice…</span>
        </div>
      </PageShell>
    )
  }

  if (!invoice) {
    return (
      <PageShell>
        <PageHeader
          backLink={{ href: "/deals/invoices", label: "Invoices" }}
          description="This invoice is unavailable or you do not have access to it."
          title="Invoice not found"
        />
      </PageShell>
    )
  }

  const isRecipient = invoice.recipientId === user?.id
  const isSender = invoice.senderId === user?.id
  const achDeposit = invoice.depositVehicle?.damageDepositAmount || 0
  const achTotal = invoice.total + achDeposit
  const cardProcessingFee = invoice.estimatedCardProcessingFee || 0
  const cardTotal = invoice.total + cardProcessingFee
  const canPay = isRecipient && ["sent", "viewed", "payment_pending"].includes(invoice.status)
  const canRefundDeposit =
    isSender &&
    invoice.status === "paid" &&
    (invoice.damageDepositAmount || 0) > 0 &&
    invoice.depositStatus !== "refunded" &&
    (invoice.damageDepositAmount || 0) >
      (invoice.depositRefundAmount || 0) + (invoice.depositRefundPendingAmount || 0)
  const remainingDeposit =
    (invoice.damageDepositAmount || 0) -
    (invoice.depositRefundAmount || 0) -
    (invoice.depositRefundPendingAmount || 0)

  const handleChoosePayment = async (paymentMethod: "stripe_card" | "stripe_ach") => {
    setIsChoosing(paymentMethod)
    try {
      const result = await choosePaymentMethod({ invoiceId, paymentMethod })
      if (result.url) {
        window.location.href = result.url
      } else {
        toast.success("Payment link created")
      }
    } catch (error) {
      handleErrorWithContext(error, { action: "create invoice payment link" })
    } finally {
      setIsChoosing(null)
    }
  }

  const handleOpenInvoice = async () => {
    setIsOpening(true)
    try {
      const url = await openHostedInvoice({ invoiceId })
      if (url) window.location.href = url
      else toast.error("Stripe has not provided an invoice link yet.")
    } catch (error) {
      handleErrorWithContext(error, { action: "open Stripe invoice" })
    } finally {
      setIsOpening(false)
    }
  }

  const handleRefundDeposit = async () => {
    setIsRefunding(true)
    try {
      const amount = refundAmount ? Math.round(Number(refundAmount) * 100) : undefined
      const key = `deposit-refund:${invoiceId}:${amount ?? "remaining"}`
      const requestId = sessionStorage.getItem(key) || crypto.randomUUID()
      sessionStorage.setItem(key, requestId)
      const result = await refundDeposit({ invoiceId, amount, requestId })
      sessionStorage.removeItem(key)
      if (result.status === "failed" || result.status === "canceled") {
        toast.error("Stripe declined this refund. You can try again.")
        return
      }
      toast.success(result.status === "succeeded" ? "Deposit refunded" : "Deposit refund pending")
      setRefundAmount("")
    } catch (error) {
      handleErrorWithContext(error, { action: "refund deposit" })
    } finally {
      setIsRefunding(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        actions={<Badge variant="outline">{statusLabel(invoice.status)}</Badge>}
        backLink={{ href: "/deals/invoices", label: "Invoices" }}
        description={`${invoice.sender?.name || "Provider"} to ${invoice.recipient?.name || "Recipient"}`}
        title={invoice.title}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
            {invoice.description && (
              <CardDescription className="break-words">{invoice.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {invoice.lineItems.map((item, index) => (
                <div
                  className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  key={index}
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{item.description}</p>
                    <p className="text-muted-foreground text-sm">
                      {item.quantity} × {formatCurrency(item.unitAmount)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatCurrency(item.amount)}</p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.taxAmount ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(invoice.taxAmount)}</span>
                </div>
              ) : null}
              {invoice.discountAmount ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold">
                <span>Invoice total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.selectedPaymentMethod === "stripe_card" &&
              (invoice.processingFee || 0) > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Card processing fee</span>
                  <span>{formatCurrency(invoice.processingFee || 0)}</span>
                </div>
              ) : null}
              {invoice.amountDue !== undefined && invoice.amountDue !== null ? (
                <div className="flex justify-between font-semibold">
                  <span>Amount due</span>
                  <span>{formatCurrency(invoice.amountDue)}</span>
                </div>
              ) : null}
            </div>

            {invoice.hasHostedInvoice && (
              <Button disabled={isOpening} onClick={handleOpenInvoice} variant="outline">
                <ExternalLink className="mr-2 size-4" />
                Open Stripe invoice
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {canPay && (
            <Card>
              <CardHeader>
                <CardTitle>Choose payment method</CardTitle>
                <CardDescription>
                  Card payments include Stripe&apos;s standard US card processing fee. ACH Direct
                  Debit does not add that fee, but can take several business days to settle.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.paymentMethods.includes("stripe_card") && (
                  <Button
                    className="h-auto w-full justify-start whitespace-normal p-4"
                    disabled={isChoosing !== null || invoice.selectedPaymentMethod === "stripe_ach"}
                    onClick={() => handleChoosePayment("stripe_card")}
                    variant="outline"
                  >
                    {isChoosing === "stripe_card" ? (
                      <Loader2 className="mr-3 size-5 animate-spin" />
                    ) : (
                      <CreditCard className="mr-3 size-5" />
                    )}
                    <span className="min-w-0 break-words text-left">
                      <span className="block font-semibold">Pay by card</span>
                      <span className="text-muted-foreground text-sm">
                        {formatCurrency(cardTotal)}
                        {cardProcessingFee > 0
                          ? ` includes ${formatCurrency(cardProcessingFee)} card processing fee`
                          : ""}
                      </span>
                    </span>
                  </Button>
                )}

                {invoice.paymentMethods.includes("stripe_ach") && (
                  <Button
                    className="h-auto w-full justify-start whitespace-normal p-4"
                    disabled={
                      isChoosing !== null || invoice.selectedPaymentMethod === "stripe_card"
                    }
                    onClick={() => handleChoosePayment("stripe_ach")}
                    variant="outline"
                  >
                    {isChoosing === "stripe_ach" ? (
                      <Loader2 className="mr-3 size-5 animate-spin" />
                    ) : (
                      <Banknote className="mr-3 size-5" />
                    )}
                    <span className="min-w-0 break-words text-left">
                      <span className="block font-semibold">Pay by ACH Direct Debit</span>
                      <span className="text-muted-foreground text-sm">
                        {formatCurrency(achTotal)}
                        {achDeposit > 0
                          ? ` includes ${formatCurrency(achDeposit)} refundable deposit`
                          : " no deposit required"}
                      </span>
                    </span>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {(invoice.damageDepositAmount || achDeposit > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Damage deposit</CardTitle>
                <CardDescription>
                  Deposits are collected only for ACH/debit invoice payments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Configured deposit</span>
                  <span>{formatCurrency(invoice.damageDepositAmount || achDeposit)}</span>
                </div>
                {invoice.depositStatus && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span>{statusLabel(invoice.depositStatus)}</span>
                  </div>
                )}
                {invoice.depositRefundAmount ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Refunded</span>
                    <span>{formatCurrency(invoice.depositRefundAmount)}</span>
                  </div>
                ) : null}

                {["failed", "canceled"].includes(invoice.depositLatestRefundStatus || "") && (
                  <p className="text-muted-foreground text-sm">The latest deposit refund failed.</p>
                )}
                {!!invoice.depositRefundPendingAmount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Refund pending</span>
                    <span>{formatCurrency(invoice.depositRefundPendingAmount)}</span>
                  </div>
                )}
                {canRefundDeposit && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="refundAmount">Refund amount</Label>
                    <Input
                      id="refundAmount"
                      max={remainingDeposit / 100}
                      min="0"
                      onChange={(event) => setRefundAmount(event.target.value)}
                      placeholder={`${formatCurrency(remainingDeposit)} remaining`}
                      type="number"
                      value={refundAmount}
                    />
                    <Button disabled={isRefunding} onClick={handleRefundDeposit} variant="outline">
                      {isRefunding ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 size-4" />
                      )}
                      Refund deposit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  )
}
