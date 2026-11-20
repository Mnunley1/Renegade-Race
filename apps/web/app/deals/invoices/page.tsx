"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { Loader2, Plus, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader, PageShell } from "@/components/page-layout"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

type LineItem = {
  description: string
  quantity: number
  unitAmountDollars: string
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

const statusLabel = (status: string) => status.replace(/_/g, " ")

export default function InvoicesPage() {
  const { user } = useUser()
  const [isCreating, setIsCreating] = useState(false)
  const invoices = useQuery(api.invoices.getMine, {})
  const vehicles = useQuery(
    api.vehicles.getByOwner,
    isCreating && user?.id ? { ownerId: user.id } : "skip"
  )
  const [recipientSearch, setRecipientSearch] = useState("")
  const recipients = useQuery(
    api.users.searchForInvoiceRecipients,
    isCreating
      ? {
          search: recipientSearch,
          limit: 25,
        }
      : "skip"
  )
  const createDraft = useMutation(api.invoices.createDraft)
  const sendInvoice = useMutation(api.invoices.send)

  const [recipientId, setRecipientId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [depositVehicleId, setDepositVehicleId] = useState<string>("none")
  const [allowCard, setAllowCard] = useState(true)
  const [allowAch, setAllowAch] = useState(true)
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitAmountDollars: "" },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const invoiceTotal = lineItems.reduce((total, item) => {
    const unitAmount = Math.round(Number(item.unitAmountDollars || 0) * 100)
    return total + unitAmount * Number(item.quantity || 0)
  }, 0)

  const resetForm = () => {
    setRecipientId("")
    setTitle("")
    setDescription("")
    setDueDate("")
    setDepositVehicleId("none")
    setAllowCard(true)
    setAllowAch(true)
    setLineItems([{ description: "", quantity: 1, unitAmountDollars: "" }])
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!(recipientId && title.trim())) {
      toast.error("Choose a recipient and add a title")
      return
    }
    const paymentMethods = [
      ...(allowCard ? (["stripe_card"] as const) : []),
      ...(allowAch ? (["stripe_ach"] as const) : []),
    ]
    if (paymentMethods.length === 0) {
      toast.error("Enable at least one payment method")
      return
    }

    const normalizedLineItems = lineItems.map((item) => {
      const unitAmount = Math.round(Number(item.unitAmountDollars || 0) * 100)
      return {
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unitAmount,
        amount: unitAmount * Number(item.quantity || 0),
      }
    })

    setIsSubmitting(true)
    try {
      const invoiceId = await createDraft({
        recipientId,
        title,
        description: description || undefined,
        dueDate: dueDate || undefined,
        lineItems: normalizedLineItems,
        paymentMethods,
        depositVehicleId:
          depositVehicleId === "none" ? undefined : (depositVehicleId as Id<"vehicles">),
      })
      await sendInvoice({ invoiceId })
      toast.success("Invoice sent")
      resetForm()
      setIsCreating(false)
    } catch (error) {
      handleErrorWithContext(error, { action: "send invoice" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateLineItem = (index: number, patch: Partial<LineItem>) => {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <Button
            aria-controls="invoice-create"
            aria-expanded={isCreating}
            disabled={isSubmitting}
            onClick={() => setIsCreating((open) => !open)}
            type="button"
          >
            <Plus className="mr-2 size-4" />
            {isCreating ? "Close form" : "Create invoice"}
          </Button>
        }
        description="Manage invoices you have sent or received."
        title="Invoices"
      />
      <div className="space-y-6">
        {isCreating && (
          <Card id="invoice-create">
            <CardHeader>
              <h2 className="font-semibold text-xl tracking-tight">Create invoice</h2>
              <CardDescription>
                The recipient chooses card or ACH before the Stripe invoice is finalized.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form aria-label="Create invoice" className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="recipientSearch">Recipient</Label>
                  <Input
                    id="recipientSearch"
                    onChange={(event) => setRecipientSearch(event.target.value)}
                    placeholder="Search name or email"
                    value={recipientSearch}
                  />
                  <Select onValueChange={setRecipientId} value={recipientId}>
                    <SelectTrigger aria-label="Select recipient">
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {(recipients || []).map((recipient) => (
                        <SelectItem key={recipient.externalId} value={recipient.externalId}>
                          {recipient.name} {recipient.email ? `(${recipient.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Coaching package"
                      value={title}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due date</Label>
                    <Input
                      id="dueDate"
                      onChange={(event) => setDueDate(event.target.value)}
                      type="date"
                      value={dueDate}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional notes for the recipient"
                    value={description}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Line items</Label>
                    <Button
                      onClick={() =>
                        setLineItems((items) => [
                          ...items,
                          { description: "", quantity: 1, unitAmountDollars: "" },
                        ])
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus className="mr-2 size-4" />
                      Add item
                    </Button>
                  </div>
                  {lineItems.map((item, index) => (
                    <fieldset
                      className="grid min-w-0 gap-3 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_90px_140px_auto]"
                      key={index}
                    >
                      <legend className="px-1 font-medium text-sm">Line item {index + 1}</legend>
                      <div className="min-w-0 space-y-2">
                        <Label htmlFor={`item-description-${index}`}>Description</Label>
                        <Input
                          id={`item-description-${index}`}
                          onChange={(event) =>
                            updateLineItem(index, { description: event.target.value })
                          }
                          placeholder="Description"
                          value={item.description}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`item-quantity-${index}`}>Quantity</Label>
                        <Input
                          id={`item-quantity-${index}`}
                          min="1"
                          onChange={(event) =>
                            updateLineItem(index, { quantity: Number(event.target.value) })
                          }
                          type="number"
                          value={item.quantity}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`item-amount-${index}`}>Unit price ($)</Label>
                        <Input
                          id={`item-amount-${index}`}
                          min="0"
                          onChange={(event) =>
                            updateLineItem(index, { unitAmountDollars: event.target.value })
                          }
                          placeholder="Amount"
                          step="0.01"
                          type="number"
                          value={item.unitAmountDollars}
                        />
                      </div>
                      <Button
                        aria-label={`Remove line item ${index + 1}`}
                        className="self-end"
                        disabled={lineItems.length === 1}
                        onClick={() =>
                          setLineItems((items) =>
                            items.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </fieldset>
                  ))}
                  <p className="text-right font-semibold">Total: {formatCurrency(invoiceTotal)}</p>
                </div>

                <div className="space-y-3">
                  <Label>Payment methods</Label>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allowCard}
                        id="allow-card"
                        onCheckedChange={(checked) => setAllowCard(checked === true)}
                      />
                      <Label htmlFor="allow-card">Card</Label>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allowAch}
                        id="allow-ach"
                        onCheckedChange={(checked) => setAllowAch(checked === true)}
                      />
                      <Label htmlFor="allow-ach">ACH Direct Debit</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deposit-vehicle">Vehicle deposit rule</Label>
                  <Select onValueChange={setDepositVehicleId} value={depositVehicleId}>
                    <SelectTrigger id="deposit-vehicle">
                      <SelectValue placeholder="No vehicle deposit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No damage deposit</SelectItem>
                      {(vehicles || []).map((vehicle) => (
                        <SelectItem key={vehicle._id} value={vehicle._id}>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                          {vehicle.damageDepositAmount
                            ? ` (${formatCurrency(vehicle.damageDepositAmount)} deposit)`
                            : " (no deposit set)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Deposits are collected only when the recipient chooses ACH/debit.
                  </p>
                </div>

                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 size-4" />
                  )}
                  Send invoice
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-xl tracking-tight">Recent invoices</h2>
            <CardDescription>Invoices you have sent or received.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices === undefined ? (
              <div
                aria-label="Loading invoices"
                className="flex items-center justify-center gap-2 py-10"
                role="status"
              >
                <span>Loading invoices…</span>
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground text-sm">No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <Link
                    className="block rounded-lg"
                    href={`/deals/invoices/${invoice._id}`}
                    key={invoice._id}
                  >
                    <div className="rounded-lg border p-4 transition-colors hover:border-primary/50">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium">{invoice.title}</p>
                          <p className="text-muted-foreground text-sm">
                            {invoice.senderId === user?.id ? "Sent" : "Received"}
                          </p>
                        </div>
                        <Badge className="self-start" variant="outline">
                          {statusLabel(invoice.status)}
                        </Badge>
                      </div>
                      <p className="mt-3 font-semibold">
                        {formatCurrency(invoice.amountDue ?? invoice.total)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
