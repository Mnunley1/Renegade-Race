import { StripeSubscriptions } from "@convex-dev/stripe"
import { v } from "convex/values"
import Stripe from "stripe"
import { api, components, internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { assertAccountsAvailable } from "./accountDeletionGuards"
import { withAccountOperation } from "./accountOperations"
import {
  getCustomInvoicePaidEmailTemplate,
  getCustomInvoiceSentEmailTemplate,
  getDepositRefundedEmailTemplate,
  sendTransactionalEmail,
} from "./emails"
import { ErrorCode, throwError } from "./errors"
import { getWebUrl } from "./helpers"
import { buildDestinationChargeAmounts, estimateStripeCardProcessingFee } from "./pricing"

import {
  assertPayoutAccountNotRevoked,
  billingCustomerId,
  retrieveOwnedCustomer,
  verifiedPaymentDestination,
} from "./stripeOwnership"
import { publicUserProfile } from "./userProfile"

const stripeClient = new StripeSubscriptions(components.stripe, {})

const MIN_INVOICE_AMOUNT = 100
const MAX_INVOICE_AMOUNT = 250_000_00

const lineItemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitAmount: v.number(),
  amount: v.number(),
})

const relatedEntityValidator = v.optional(
  v.object({
    type: v.union(
      v.literal("vehicle"),
      v.literal("rental"),
      v.literal("coaching"),
      v.literal("damage"),
      v.literal("contract"),
      v.literal("sponsorship"),
      v.literal("other")
    ),
    id: v.string(),
  })
)

const paymentMethodValidator = v.union(
  v.literal("stripe_card"),
  v.literal("stripe_ach"),
  v.literal("external")
)

type InvoiceLineItem = {
  description: string
  quantity: number
  unitAmount: number
  amount: number
}

export function normalizeInvoiceLineItems(lineItems: InvoiceLineItem[]): InvoiceLineItem[] {
  if (lineItems.length === 0) {
    throw new Error("At least one line item is required")
  }

  return lineItems.map((item) => {
    const description = item.description.trim()
    if (!description) {
      throw new Error("Line item description is required")
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error("Line item quantity must be positive")
    }
    if (!Number.isInteger(item.unitAmount) || item.unitAmount < 0) {
      throw new Error("Line item unit amount must be a non-negative cent amount")
    }

    const amount = Math.round(item.quantity * item.unitAmount)
    if (amount !== item.amount) {
      throw new Error("Line item amount does not match quantity and unit amount")
    }

    return {
      description,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      amount,
    }
  })
}

export function calculateInvoiceSubtotal(lineItems: InvoiceLineItem[]): number {
  return normalizeInvoiceLineItems(lineItems).reduce((total, item) => total + item.amount, 0)
}

export function calculateInvoiceTotal(args: {
  lineItems: InvoiceLineItem[]
  taxAmount?: number
  discountAmount?: number
}): number {
  const subtotal = calculateInvoiceSubtotal(args.lineItems)
  const taxAmount = args.taxAmount ?? 0
  const discountAmount = args.discountAmount ?? 0
  const total = subtotal + taxAmount - discountAmount

  if (
    !(Number.isSafeInteger(taxAmount) && Number.isSafeInteger(discountAmount)) ||
    taxAmount < 0 ||
    discountAmount < 0
  ) {
    throw new Error("Tax and discount amounts must be non-negative cent amounts")
  }
  if (total < MIN_INVOICE_AMOUNT || total > MAX_INVOICE_AMOUNT) {
    throw new Error("Invoice total must be between $1.00 and $250,000.00")
  }

  return total
}

export function calculatePaymentAmount(args: {
  invoiceTotal: number
  selectedPaymentMethod: "stripe_card" | "stripe_ach"
  damageDepositAmount?: number
}): { amountDue: number; damageDepositAmount: number; depositStatus: "not_required" | "pending" } {
  const damageDepositAmount =
    args.selectedPaymentMethod === "stripe_ach" ? Math.max(args.damageDepositAmount || 0, 0) : 0

  return {
    amountDue: args.invoiceTotal + damageDepositAmount,
    damageDepositAmount,
    depositStatus: damageDepositAmount > 0 ? "pending" : "not_required",
  }
}

/**
 * Settlement for a custom invoice once the payer picks card or ACH.
 *
 * Card matches destination charges used by rentals and damage invoices:
 * the payer covers Stripe's estimated US card fee, the sender nets
 * invoice total − Renegade platform fee, and `application_fee_amount`
 * is the platform fee plus that processing fee.
 *
 * ACH has no card-processing pass-through in the rest of the billing code.
 * The payer owes the invoice total plus any refundable damage deposit, and
 * the platform fee (capped for early adopters) is taken only from the
 * invoice total — the deposit is not fee'd.
 */
export function resolveInvoiceSettlement(args: {
  invoiceTotal: number
  selectedPaymentMethod: "stripe_card" | "stripe_ach"
  damageDepositAmount?: number
  platformFee: number
}): {
  amountDue: number
  damageDepositAmount: number
  depositStatus: "not_required" | "pending"
  platformFee: number
  processingFee: number
  applicationFeeAmount: number
  senderAmount: number
} {
  if (
    !Number.isInteger(args.platformFee) ||
    args.platformFee < 0 ||
    args.platformFee > args.invoiceTotal
  ) {
    throw new Error("Platform fee must be an integer between 0 and the invoice total")
  }

  const payment = calculatePaymentAmount({
    invoiceTotal: args.invoiceTotal,
    selectedPaymentMethod: args.selectedPaymentMethod,
    damageDepositAmount: args.damageDepositAmount,
  })

  if (args.selectedPaymentMethod === "stripe_card") {
    const charge = buildDestinationChargeAmounts({
      listingAmountCents: args.invoiceTotal,
      platformFeeCents: args.platformFee,
    })
    return {
      amountDue: charge.chargeAmountCents,
      damageDepositAmount: 0,
      depositStatus: "not_required",
      platformFee: args.platformFee,
      processingFee: charge.processingFeeCents,
      applicationFeeAmount: charge.applicationFeeCents,
      senderAmount: charge.ownerAmountCents,
    }
  }

  return {
    amountDue: payment.amountDue,
    damageDepositAmount: payment.damageDepositAmount,
    depositStatus: payment.depositStatus,
    platformFee: args.platformFee,
    processingFee: 0,
    applicationFeeAmount: args.platformFee,
    senderAmount: payment.amountDue - args.platformFee,
  }
}

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throwError(ErrorCode.STRIPE_ERROR, "STRIPE_SECRET_KEY environment variable is not set")
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  })
}

export const createDraft = mutation({
  args: {
    recipientId: v.string(),
    senderTeamId: v.optional(v.id("teams")),
    title: v.string(),
    description: v.optional(v.string()),
    lineItems: v.array(lineItemValidator),
    taxAmount: v.optional(v.number()),
    discountAmount: v.optional(v.number()),
    paymentMethods: v.array(paymentMethodValidator),
    relatedEntity: relatedEntityValidator,
    depositVehicleId: v.optional(v.id("vehicles")),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }
    if (args.recipientId === identity.subject) {
      throwError(ErrorCode.INVALID_INPUT, "Cannot send an invoice to yourself")
    }
    if (args.paymentMethods.length === 0) {
      throwError(ErrorCode.INVALID_INPUT, "At least one payment method is required")
    }

    const recipient = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.recipientId))
      .first()
    if (!recipient) {
      throwError(ErrorCode.NOT_FOUND, "Recipient not found")
    }

    if (args.depositVehicleId) {
      const vehicle = await ctx.db.get(args.depositVehicleId)
      if (!vehicle) {
        throwError(ErrorCode.NOT_FOUND, "Deposit vehicle not found")
      }
      if (vehicle.ownerId !== identity.subject) {
        throwError(ErrorCode.FORBIDDEN, "Only the vehicle owner can use its damage deposit")
      }
    }

    const lineItems = normalizeInvoiceLineItems(args.lineItems)
    const subtotal = calculateInvoiceSubtotal(lineItems)
    const total = calculateInvoiceTotal({
      lineItems,
      taxAmount: args.taxAmount,
      discountAmount: args.discountAmount,
    })
    const now = Date.now()
    await assertAccountsAvailable(ctx, identity.subject, args.recipientId)
    const invoiceId = await ctx.db.insert("invoices", {
      senderId: identity.subject,
      recipientId: args.recipientId,
      senderTeamId: args.senderTeamId,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      lineItems,
      subtotal,
      taxAmount: args.taxAmount,
      discountAmount: args.discountAmount,
      total,
      currency: "usd",
      paymentMethods: args.paymentMethods,
      relatedEntity: args.relatedEntity,
      depositVehicleId: args.depositVehicleId,
      status: "draft",
      dueDate: args.dueDate,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "invoice",
      entityId: invoiceId,
      action: "create_invoice_draft",
      userId: identity.subject,
      newState: { total, recipientId: args.recipientId },
    })

    return invoiceId
  },
})

export const updateDraft = mutation({
  args: {
    invoiceId: v.id("invoices"),
    title: v.string(),
    description: v.optional(v.string()),
    lineItems: v.array(lineItemValidator),
    taxAmount: v.optional(v.number()),
    discountAmount: v.optional(v.number()),
    paymentMethods: v.array(paymentMethodValidator),
    relatedEntity: relatedEntityValidator,
    depositVehicleId: v.optional(v.id("vehicles")),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) {
      throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    }
    if (invoice.senderId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to edit this invoice")
    }
    if (invoice.status !== "draft") {
      throwError(ErrorCode.INVALID_STATUS, "Only draft invoices can be edited")
    }

    if (args.depositVehicleId) {
      const vehicle = await ctx.db.get(args.depositVehicleId)
      if (!vehicle || vehicle.ownerId !== identity.subject) {
        throwError(ErrorCode.FORBIDDEN, "Not authorized to use this vehicle deposit")
      }
    }

    const lineItems = normalizeInvoiceLineItems(args.lineItems)
    const subtotal = calculateInvoiceSubtotal(lineItems)
    const total = calculateInvoiceTotal({
      lineItems,
      taxAmount: args.taxAmount,
      discountAmount: args.discountAmount,
    })

    await assertAccountsAvailable(ctx, identity.subject, invoice.senderId, invoice.recipientId)
    await ctx.db.patch(args.invoiceId, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      lineItems,
      subtotal,
      taxAmount: args.taxAmount,
      discountAmount: args.discountAmount,
      total,
      paymentMethods: args.paymentMethods,
      relatedEntity: args.relatedEntity,
      depositVehicleId: args.depositVehicleId,
      dueDate: args.dueDate,
      notes: args.notes,
      updatedAt: Date.now(),
    })

    return args.invoiceId
  },
})

export const send = mutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) {
      throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    }
    if (invoice.senderId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to send this invoice")
    }
    if (invoice.status !== "draft") {
      throwError(ErrorCode.INVALID_STATUS, "Only draft invoices can be sent")
    }

    await assertAccountsAvailable(ctx, identity.subject, invoice.senderId, invoice.recipientId)
    const [recipient, sender] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.recipientId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.senderId))
        .first(),
    ])

    const now = Date.now()
    await ctx.db.patch(args.invoiceId, {
      status: "sent",
      sentAt: now,
      updatedAt: now,
    })

    const invoiceUrl = `${getWebUrl()}/deals/invoices/${args.invoiceId}`

    await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
      userId: invoice.recipientId,
      type: "invoice",
      title: "New invoice received",
      message: `${sender?.name || "A provider"} sent you an invoice for $${(invoice.total / 100).toFixed(2)}.`,
      link: `/deals/invoices/${args.invoiceId}`,
      metadata: { invoiceId: args.invoiceId },
    })

    await ctx.runMutation(internal.auditLog.create, {
      entityType: "invoice",
      entityId: args.invoiceId,
      action: "send_invoice",
      userId: identity.subject,
      metadata: { recipientId: invoice.recipientId },
    })

    if (recipient?.email) {
      await sendTransactionalEmail(
        ctx,
        recipient.email,
        getCustomInvoiceSentEmailTemplate({
          recipientName: recipient.name,
          senderName: sender?.name || "Renegade Race provider",
          title: invoice.title,
          amount: invoice.total,
          invoiceUrl,
        })
      )
    }

    return args.invoiceId
  },
})

export const markViewed = mutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice || invoice.recipientId !== identity.subject || invoice.viewedAt) return

    await ctx.db.patch(args.invoiceId, {
      status: invoice.status === "sent" ? "viewed" : invoice.status,
      viewedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// Hosted links and PDFs can authorize payment. Serve them only after checking Stripe.
function invoiceView(invoice: Doc<"invoices">) {
  const { stripeCheckoutUrl, stripeInvoicePdf, ...visible } = invoice
  return { ...visible, hasHostedInvoice: Boolean(invoice.stripeInvoiceId && stripeCheckoutUrl) }
}

export const getById = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) return null
    if (invoice.senderId !== identity.subject && invoice.recipientId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to view this invoice")
    }

    const [sender, recipient, depositVehicle] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.senderId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.recipientId))
        .first(),
      invoice.depositVehicleId ? ctx.db.get(invoice.depositVehicleId) : Promise.resolve(null),
    ])

    return {
      ...invoiceView(invoice),
      sender: publicUserProfile(sender),
      recipient: publicUserProfile(recipient),
      depositVehicle,
      // Preview of the card pass-through before a method is chosen. ACH does not add this.
      estimatedCardProcessingFee: estimateStripeCardProcessingFee(invoice.total),
    }
  },
})

export const getMine = query({
  args: { role: v.optional(v.union(v.literal("sent"), v.literal("received"))) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const sent =
      args.role === "received"
        ? []
        : await ctx.db
            .query("invoices")
            .withIndex("by_sender", (q) => q.eq("senderId", identity.subject))
            .order("desc")
            .collect()
    const received =
      args.role === "sent"
        ? []
        : await ctx.db
            .query("invoices")
            .withIndex("by_recipient", (q) => q.eq("recipientId", identity.subject))
            .order("desc")
            .collect()

    return [...sent, ...received].sort((a, b) => b.createdAt - a.createdAt).map(invoiceView)
  },
})

export const getRawById = internalQuery({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => await ctx.db.get(args.invoiceId),
})

export const findByStripeInvoiceId = internalQuery({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .unique(),
})

export const findByStripePaymentIntent = internalQuery({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("invoices")
      .withIndex("by_stripe_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .unique(),
})

const stripeMethod = v.union(v.literal("stripe_card"), v.literal("stripe_ach"))

export const claimStripePayment = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    method: stripeMethod,
    amountDue: v.number(),
    damageDepositAmount: v.number(),
    platformFee: v.number(),
    processingFee: v.number(),
    senderAmount: v.number(),
  },
  handler: async (ctx, { invoiceId, method, ...amounts }): Promise<Doc<"invoices">> => {
    const current = await ctx.db.get(invoiceId)
    if (!(current && ["sent", "viewed", "payment_pending"].includes(current.status)))
      throwError(ErrorCode.INVALID_STATUS, "Invoice is not payable")
    await assertAccountsAvailable(ctx, current.senderId, current.recipientId)
    if (current.selectedPaymentMethod) {
      if (current.selectedPaymentMethod !== method)
        throwError(ErrorCode.INVALID_STATUS, "Payment method has already been selected")
      return current
    }
    const fields = {
      ...amounts,
      paymentSyncVersion: (current.paymentSyncVersion ?? 0) + 1,
      selectedPaymentMethod: method,
      depositStatus:
        amounts.damageDepositAmount > 0 ? ("pending" as const) : ("not_required" as const),
      updatedAt: Date.now(),
    }
    await ctx.db.patch(invoiceId, fields)
    return { ...current, ...fields }
  },
})

export const releaseRejectedMethod = internalMutation({
  args: { invoiceId: v.id("invoices"), method: stripeMethod },
  handler: async (ctx, { invoiceId, method }) => {
    const local = await ctx.db.get(invoiceId)
    if (local?.selectedPaymentMethod === method && !local.stripeInvoiceId)
      await ctx.db.patch(invoiceId, {
        paymentSyncVersion: (local.paymentSyncVersion ?? 0) + 1,
        selectedPaymentMethod: undefined,
        amountDue: undefined,
        damageDepositAmount: undefined,
        depositStatus: undefined,
        platformFee: undefined,
        processingFee: undefined,
        senderAmount: undefined,
        updatedAt: Date.now(),
      })
  },
})

export const registerStripeDraft = internalMutation({
  args: { invoiceId: v.id("invoices"), method: stripeMethod, stripeInvoiceId: v.string() },
  handler: async (ctx, { invoiceId, method, stripeInvoiceId }) => {
    const local = await ctx.db.get(invoiceId)
    if (
      local?.selectedPaymentMethod !== method ||
      (local.stripeInvoiceId && local.stripeInvoiceId !== stripeInvoiceId)
    )
      throwError(ErrorCode.INVALID_STATUS, "Invoice payment has already been configured")
    if (!local.stripeInvoiceId)
      await ctx.db.patch(invoiceId, {
        stripeInvoiceId,
        paymentSyncVersion: (local.paymentSyncVersion ?? 0) + 1,
        updatedAt: Date.now(),
      })
  },
})

export const updateWithStripeInvoice = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    stripeInvoiceId: v.string(),
    stripeCheckoutUrl: v.optional(v.string()),
    stripeInvoicePdf: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, { invoiceId, stripeInvoiceId, stripePaymentIntentId, ...links }) => {
    const local = await ctx.db.get(invoiceId)
    if (local?.stripeInvoiceId !== stripeInvoiceId)
      throwError(ErrorCode.INVALID_STATUS, "Invoice payment has changed")
    await ctx.db.patch(invoiceId, {
      ...links,
      paymentSyncVersion: (local.paymentSyncVersion ?? 0) + 1,
      stripePaymentIntentId: local.stripePaymentIntentId ?? stripePaymentIntentId,
      status: ["sent", "viewed"].includes(local.status) ? "payment_pending" : local.status,
      updatedAt: Date.now(),
    })
  },
})

function stripeId(object: string | { id?: string } | null | undefined) {
  return typeof object === "string" ? object : object?.id
}

function verifyStripeInvoice(local: Doc<"invoices">, remote: Stripe.Invoice) {
  if (
    remote.id !== local.stripeInvoiceId ||
    remote.metadata?.type !== "custom_invoice" ||
    remote.metadata.invoiceId !== local._id ||
    remote.metadata.senderId !== local.senderId ||
    remote.metadata.recipientId !== local.recipientId
  ) {
    throwError(ErrorCode.FORBIDDEN, "Stripe invoice does not match this invoice")
  }
}

export async function verifyPayableInvoice(
  ctx: ActionCtx,
  stripe: Stripe,
  local: Doc<"invoices">,
  remote: Stripe.Invoice
): Promise<string> {
  verifyStripeInvoice(local, remote)
  if (!["sent", "viewed", "payment_pending", "processing", "overdue"].includes(local.status)) {
    throwError(ErrorCode.INVALID_STATUS, "Invoice is not payable")
  }
  const expected =
    local.amountDue ?? local.total + (local.damageDepositAmount ?? 0) + (local.processingFee ?? 0)
  if (
    remote.currency !== local.currency ||
    (remote.status !== "draft" && remote.amount_due !== expected)
  ) {
    throwError(
      ErrorCode.INVALID_AMOUNT,
      "Stripe invoice currency or amount does not match the agreed total"
    )
  }
  const customer = stripeId(remote.customer)
  if (!(customer && remote.id))
    throwError(ErrorCode.FORBIDDEN, "Invoice customer could not be verified")
  await retrieveOwnedCustomer(stripe, customer, local.recipientId)
  const destinations = new Set<string>()
  let foundDefault = false
  for await (const p of stripe.invoicePayments.list({
    invoice: remote.id,
    status: "open",
    limit: 100,
    expand: ["data.payment.payment_intent"],
  })) {
    const ref = p.payment.payment_intent
    if (p.payment.type !== "payment_intent" || !ref)
      throwError(ErrorCode.FORBIDDEN, "Invoice payment could not be verified")
    const intent = typeof ref === "string" ? await stripe.paymentIntents.retrieve(ref) : ref
    const dest = stripeId(intent.transfer_data?.destination)
    if (!dest || stripeId(intent.customer) !== customer)
      throwError(ErrorCode.FORBIDDEN, "Invoice payment parties do not match")
    destinations.add(dest)
    if (p.is_default) foundDefault = true
  }
  if (!foundDefault) {
    // Basil exposes transfer_data on the PaymentIntent. When Stripe has not
    // materialized the default intent, request the invoice's Acacia representation.
    const prior = (await stripe.invoices.retrieve(
      remote.id,
      {},
      { apiVersion: "2024-10-28.acacia" }
    )) as Stripe.Invoice & { transfer_data?: { destination: string | Stripe.Account } }
    verifyStripeInvoice(local, prior)
    const dest = stripeId(prior.transfer_data?.destination)
    if (!dest || stripeId(prior.customer) !== customer)
      throwError(ErrorCode.FORBIDDEN, "Invoice payment parties could not be verified")
    destinations.add(dest)
  }
  if (destinations.size !== 1)
    throwError(ErrorCode.FORBIDDEN, "Invoice payout destinations do not match")
  for (const destination of destinations) {
    await verifiedPaymentDestination(ctx, stripe, destination, local.senderId)
    return destination
  }
  throwError(ErrorCode.FORBIDDEN, "Invoice payout destination could not be verified")
}

async function hostedInvoiceUrl(ctx: ActionCtx, invoice: Doc<"invoices">): Promise<string | null> {
  if (!invoice.stripeInvoiceId) throwError(ErrorCode.INVALID_STATUS, "No hosted invoice available")
  const stripe = getStripe()
  const remote = await stripe.invoices.retrieve(invoice.stripeInvoiceId)
  if (remote.status === "draft") return null
  if (remote.status === "paid" || remote.status === "void") {
    // These pages cannot collect another payment. Keep historical receipts available.
    verifyStripeInvoice(invoice, remote)
    const customer = stripeId(remote.customer)
    if (!customer) throwError(ErrorCode.FORBIDDEN, "Invoice customer could not be verified")
    await retrieveOwnedCustomer(stripe, customer, invoice.recipientId)
  } else {
    const destination = await verifyPayableInvoice(ctx, stripe, invoice, remote)
    await assertPayoutAccountNotRevoked(ctx, destination)
  }
  return remote.hosted_invoice_url ?? null
}

export const openHostedInvoice = action({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, { invoiceId }): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    const invoice = await ctx.runQuery(internal.invoices.getRawById, { invoiceId })
    if (
      !invoice ||
      (identity.subject !== invoice.senderId && identity.subject !== invoice.recipientId)
    ) {
      throwError(ErrorCode.FORBIDDEN, "Not authorized to view this invoice")
    }
    return hostedInvoiceUrl(ctx, invoice)
  },
})

export const choosePaymentMethod = action({
  args: {
    invoiceId: v.id("invoices"),
    paymentMethod: v.union(v.literal("stripe_card"), v.literal("stripe_ach")),
  },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    }

    const invoice = await ctx.runQuery(internal.invoices.getRawById, {
      invoiceId: args.invoiceId,
    })
    if (!invoice) {
      throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    }
    if (invoice.recipientId !== identity.subject) {
      throwError(ErrorCode.FORBIDDEN, "Only the recipient can choose a payment method")
    }
    if (!["sent", "viewed", "payment_pending"].includes(invoice.status)) {
      throwError(ErrorCode.INVALID_STATUS, "Invoice is not payable")
    }
    if (!invoice.paymentMethods.includes(args.paymentMethod)) {
      throwError(ErrorCode.INVALID_INPUT, "Payment method is not available for this invoice")
    }
    if (invoice.selectedPaymentMethod && invoice.selectedPaymentMethod !== args.paymentMethod) {
      throwError(ErrorCode.INVALID_STATUS, "Payment method has already been selected")
    }
    if (invoice.stripeInvoiceId && invoice.stripeCheckoutUrl)
      return { url: await hostedInvoiceUrl(ctx, invoice) }

    const [sender, depositVehicle] = await Promise.all([
      ctx.runQuery(internal.users.getByExternalIdInternal, { externalId: invoice.senderId }),
      invoice.depositVehicleId
        ? ctx.runQuery(api.vehicles.getById, { id: invoice.depositVehicleId })
        : Promise.resolve(null),
    ])
    if (!sender?.stripeAccountId)
      throwError(ErrorCode.STRIPE_ACCOUNT_INCOMPLETE, "Provider must complete Stripe onboarding")
    const destinationAccountId = sender.stripeAccountId
    const result = await withAccountOperation(
      ctx,
      `invoice-payment:${invoice._id}`,
      [identity.subject, invoice.senderId, invoice.recipientId],
      async (beforeProviderMutation) => {
        const stripe = getStripe()
        const connectAccount = await verifiedPaymentDestination(
          ctx,
          stripe,
          destinationAccountId,
          invoice.senderId
        )
        if (!(connectAccount.details_submitted && connectAccount.charges_enabled)) {
          throwError(ErrorCode.STRIPE_ACCOUNT_DISABLED, "Provider Stripe account is not ready")
        }

        // Fee is on the invoice total (not the ACH deposit). Early-adopter caps apply to the sender.
        const { platformFee } = await ctx.runMutation(api.stripe.calculatePlatformFee, {
          amount: invoice.total,
          providerExternalId: invoice.senderId,
        })
        const settlement = resolveInvoiceSettlement({
          invoiceTotal: invoice.total,
          selectedPaymentMethod: args.paymentMethod,
          damageDepositAmount: depositVehicle?.damageDepositAmount,
          platformFee,
        })

        if (
          calculateInvoiceTotal(invoice) !== invoice.total ||
          !Number.isSafeInteger(settlement.amountDue)
        ) {
          throwError(ErrorCode.INVALID_AMOUNT, "Invoice line items do not match the agreed total")
        }
        const dueDateTimestamp = invoice.dueDate
          ? Math.floor(new Date(`${invoice.dueDate}T23:59:59.000Z`).getTime() / 1000)
          : undefined

        if (
          !invoice.stripeInvoiceId &&
          dueDateTimestamp !== undefined &&
          (!Number.isFinite(dueDateTimestamp) || dueDateTimestamp <= Date.now() / 1000)
        ) {
          throwError(ErrorCode.INVALID_INPUT, "Invoice due date has passed or is invalid")
        }
        beforeProviderMutation()
        const customerId = await billingCustomerId(ctx, stripe, identity, () =>
          stripeClient.getOrCreateCustomer(ctx, {
            userId: identity.subject,
            email: identity.email || "",
            name: identity.name || "",
          })
        )

        const local = await ctx.runMutation(internal.invoices.claimStripePayment, {
          invoiceId: invoice._id,
          method: args.paymentMethod,
          amountDue: settlement.amountDue,
          damageDepositAmount: settlement.damageDepositAmount,
          platformFee: settlement.platformFee,
          processingFee: settlement.processingFee,
          senderAmount: settlement.senderAmount,
        })
        if (local.stripeInvoiceId && local.stripeCheckoutUrl)
          return { url: await hostedInvoiceUrl(ctx, local) }
        const processingFee = local.processingFee ?? 0
        const deposit = local.damageDepositAmount ?? 0
        let draft: Stripe.Invoice
        if (local.stripeInvoiceId) {
          draft = await stripe.invoices.retrieve(local.stripeInvoiceId)
          if (draft.status === "paid" || draft.status === "void")
            return { url: await hostedInvoiceUrl(ctx, local) }
          await verifyPayableInvoice(ctx, stripe, local, draft)
        } else {
          try {
            await assertPayoutAccountNotRevoked(ctx, destinationAccountId)
            draft = await stripe.invoices.create(
              {
                customer: customerId,
                currency: local.currency,
                collection_method: "send_invoice",
                auto_advance: false,
                pending_invoice_items_behavior: "exclude",
                days_until_due: dueDateTimestamp ? undefined : 14,
                due_date: dueDateTimestamp,
                description: local.description,
                metadata: {
                  type: "custom_invoice",
                  invoiceId: local._id,
                  senderId: local.senderId,
                  recipientId: local.recipientId,
                  paymentMethod: args.paymentMethod,
                  damageDepositAmount: String(deposit),
                  platformFee: String(local.platformFee),
                  processingFee: String(processingFee),
                  senderAmount: String(local.senderAmount),
                },
                application_fee_amount: (local.platformFee ?? 0) + processingFee,
                transfer_data: { destination: destinationAccountId },
                payment_settings: {
                  payment_method_types: [
                    args.paymentMethod === "stripe_ach" ? "us_bank_account" : "card",
                  ],
                },
              },
              { idempotencyKey: `invoice_create_${local._id}_${args.paymentMethod}` }
            )
          } catch (error) {
            // A Stripe validation rejection creates no object. Keep ambiguous transport
            // failures bound to the same method so the original request can be retried.
            if ((error as { type?: string })?.type === "StripeInvalidRequestError") {
              await ctx.runMutation(internal.invoices.releaseRejectedMethod, {
                invoiceId: local._id,
                method: args.paymentMethod,
              })
            }
            throw error
          }
          if (!draft.id)
            throwError(ErrorCode.STRIPE_ERROR, "Stripe invoice was created without an ID")
          await ctx.runMutation(internal.invoices.registerStripeDraft, {
            invoiceId: local._id,
            method: args.paymentMethod,
            stripeInvoiceId: draft.id,
          })
        }
        if (!draft.id) throwError(ErrorCode.STRIPE_ERROR, "Missing Stripe invoice ID")
        const linkedInvoice = { ...local, stripeInvoiceId: draft.id }
        if (draft.status === "draft") {
          const lines = [
            ...local.lineItems.map((item, index) => ({
              key: `line_${index}`,
              description: item.description,
              amount: item.amount,
            })),
            { key: "tax", description: "Tax", amount: local.taxAmount ?? 0 },
            { key: "discount", description: "Discount", amount: -(local.discountAmount ?? 0) },
            { key: "processing", description: "Card processing fee", amount: processingFee },
            { key: "deposit", description: "Refundable damage deposit", amount: deposit },
          ].filter((item) => item.amount !== 0)
          const missing = new Map(lines.map((item) => [item.key, item]))
          for await (const line of stripe.invoices.listLineItems(draft.id, { limit: 100 })) {
            const key = line.metadata?.invoiceLineKey
            const expected = key && missing.get(key)
            if (!expected || expected.amount !== line.amount || line.currency !== local.currency)
              throwError(ErrorCode.INVALID_AMOUNT, "Unexpected Stripe invoice line item")
            missing.delete(expected.key)
          }
          for (const item of missing.values()) {
            await stripe.invoiceItems.create(
              {
                customer: customerId,
                invoice: draft.id,
                currency: local.currency,
                description: item.description,
                amount: item.amount,
                metadata: { invoiceId: local._id, invoiceLineKey: item.key },
              },
              { idempotencyKey: `invoice_item_${draft.id}_${item.key}` }
            )
          }
          const completeDraft = await stripe.invoices.retrieve(draft.id)
          verifyStripeInvoice(linkedInvoice, completeDraft)
          if (
            completeDraft.currency !== local.currency ||
            completeDraft.amount_due !== local.amountDue
          )
            throwError(
              ErrorCode.INVALID_AMOUNT,
              "Stripe draft total does not match the agreed total"
            )
          await assertPayoutAccountNotRevoked(ctx, destinationAccountId)
          draft = await stripe.invoices.finalizeInvoice(
            draft.id,
            { auto_advance: false },
            { idempotencyKey: `invoice_finalize_${draft.id}` }
          )
        }
        const finalized = draft
        if (!finalized.id || finalized.status !== "open")
          throwError(ErrorCode.INVALID_STATUS, "Stripe invoice is not open")
        await verifyPayableInvoice(ctx, stripe, linkedInvoice, finalized)
        await assertPayoutAccountNotRevoked(ctx, destinationAccountId)
        const sent = await stripe.invoices.sendInvoice(
          finalized.id,
          { expand: ["payments"] },
          {
            idempotencyKey: `invoice_send_${args.invoiceId}_${args.paymentMethod}`,
          }
        )
        if (!sent.id) {
          throwError(ErrorCode.STRIPE_ERROR, "Stripe invoice was sent without an ID")
        }
        const defaultPayment = sent.payments?.data.find((payment) => payment.is_default)
        const stripePaymentIntentId =
          stripeId(defaultPayment?.payment.payment_intent) ??
          stripeId(
            (sent as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent })
              .payment_intent
          )

        await ctx.runMutation(internal.invoices.updateWithStripeInvoice, {
          invoiceId: args.invoiceId,
          stripeInvoiceId: sent.id,
          stripeCheckoutUrl: sent.hosted_invoice_url || undefined,
          stripeInvoicePdf: sent.invoice_pdf || undefined,
          stripePaymentIntentId,
        })

        await assertPayoutAccountNotRevoked(ctx, destinationAccountId)
        return { url: await hostedInvoiceUrl(ctx, linkedInvoice) }
      }
    )
    await assertPayoutAccountNotRevoked(ctx, destinationAccountId)
    return result
  },
})

const invoiceEventType = v.union(
  v.literal("payment_intent.processing"),
  v.literal("payment_intent.payment_failed"),
  v.literal("payment_intent.succeeded"),
  v.literal("invoice.paid"),
  v.literal("invoice.payment_failed"),
  v.literal("invoice.voided"),
  v.literal("invoice.marked_uncollectible")
)

// Events are wake-up signals, not ordered state changes. Resolve the provider's
// current invoice/attempt, including Basil's InvoicePayment relationship, before
// applying anything locally. Metadata alone never binds a payment to an invoice.
export const reconcilePaymentEvent = internalAction({
  args: {
    eventId: v.string(),
    eventType: invoiceEventType,
    stripeInvoiceId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    localInvoiceId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const stripe = getStripe()
    for (let retry = 0; retry < 3; retry++) {
      if (
        await ctx.runQuery(internal.webhookIdempotency.checkWebhookEvent, {
          eventId: args.eventId,
          source: "stripe",
        })
      )
        return true
      let invoiceId = args.stripeInvoiceId
      if (args.stripePaymentIntentId) {
        const linked = await ctx.runQuery(internal.invoices.findByStripePaymentIntent, {
          stripePaymentIntentId: args.stripePaymentIntentId,
        })
        const associations = new Set<string>()
        for await (const payment of stripe.invoicePayments.list({
          payment: { type: "payment_intent", payment_intent: args.stripePaymentIntentId },
          limit: 100,
        })) {
          if (
            payment.payment.type !== "payment_intent" ||
            stripeId(payment.payment.payment_intent) !== args.stripePaymentIntentId
          )
            throw new Error("Stripe invoice payment association does not match")
          const id = stripeId(payment.invoice)
          if (!id) throw new Error("Missing Stripe invoice association")
          associations.add(id)
        }
        if (!associations.size) {
          if (linked || args.localInvoiceId)
            throw new Error("Invoice payment registration is pending")
          return false
        }
        if (associations.size !== 1) throw new Error("Ambiguous Stripe invoice payment association")
        invoiceId = [...associations][0]
        if (linked?.stripeInvoiceId && linked.stripeInvoiceId !== invoiceId)
          throw new Error("Stripe payment points to a different invoice")
      }
      if (!invoiceId) throw new Error("Missing Stripe invoice event reference")
      // Capture the compare-and-retry version before any authoritative state read.
      const local = await ctx.runQuery(internal.invoices.findByStripeInvoiceId, {
        stripeInvoiceId: invoiceId,
      })
      const remote = await stripe.invoices.retrieve(invoiceId)
      if (remote.metadata?.type !== "custom_invoice") {
        if (local || args.localInvoiceId) throw new Error("Stripe invoice metadata does not match")
        return false
      }
      if (!local) {
        // A genuine invoice may be finalized before registerStripeDraft commits.
        // Retry delivery instead of permanently acknowledging an unmapped event.
        throw new Error("Invoice registration is pending")
      }
      verifyStripeInvoice(local, remote)
      if (args.localInvoiceId && args.localInvoiceId !== local._id)
        throw new Error("Invoice event participants do not match")
      const expected =
        local.amountDue ??
        local.total + (local.damageDepositAmount ?? 0) + (local.processingFee ?? 0)
      if (
        local.currency !== "usd" ||
        remote.currency !== "usd" ||
        !Number.isSafeInteger(expected) ||
        expected <= 0 ||
        remote.total !== expected ||
        (remote.status !== "void" && remote.amount_due !== expected) ||
        calculateInvoiceTotal(local) !== local.total
      )
        throw new Error("Stripe invoice amount or currency does not match")
      const customerId = stripeId(remote.customer)
      if (!customerId) throw new Error("Missing invoice customer")
      await retrieveOwnedCustomer(stripe, customerId, local.recipientId)
      const candidates: Stripe.InvoicePayment[] = []
      for await (const payment of stripe.invoicePayments.list({ invoice: invoiceId, limit: 100 })) {
        if (stripeId(payment.invoice) !== invoiceId)
          throw new Error("Stripe invoice payment association does not match")
        candidates.push(payment)
      }
      const applicable =
        remote.status === "paid"
          ? candidates.filter((p) => p.status === "paid")
          : candidates.filter((p) => p.is_default && ["open", "canceled"].includes(p.status))
      const unpaidTerminal =
        ["void", "uncollectible"].includes(remote.status ?? "") && remote.amount_paid === 0
      let intent: Stripe.PaymentIntent | undefined
      let destination: string | undefined
      let applicationFee: number | null | undefined
      if (unpaidTerminal && !applicable.length && !candidates.some((p) => p.status === "paid")) {
        // Stripe may void an issued invoice before materializing its default PI.
        // Acacia exposes the destination on that invoice, as in verifyPayableInvoice.
        const prior = (await stripe.invoices.retrieve(
          invoiceId,
          {},
          {
            apiVersion: "2024-10-28.acacia",
          }
        )) as Stripe.Invoice & {
          transfer_data?: { destination: string | Stripe.Account }
          application_fee_amount?: number | null
        }
        verifyStripeInvoice(local, prior)
        if (
          prior.status !== remote.status ||
          prior.total !== expected ||
          prior.currency !== "usd" ||
          prior.amount_paid !== 0 ||
          stripeId(prior.customer) !== customerId
        )
          throw new Error("Terminal invoice evidence changed")
        destination = stripeId(prior.transfer_data?.destination)
        applicationFee = prior.application_fee_amount
      } else {
        if (applicable.length !== 1)
          throw new Error("Current invoice payment registration is pending or ambiguous")
        const payment = applicable[0]
        if (!payment) throw new Error("Missing current invoice payment")
        if (
          payment.currency !== "usd" ||
          payment.amount_requested !== expected ||
          payment.payment.type !== "payment_intent" ||
          !payment.payment.payment_intent
        )
          throw new Error("Current invoice payment amount or type does not match")
        const intentId = stripeId(payment.payment.payment_intent)
        if (!intentId) throw new Error("Missing current invoice intent")
        intent = await stripe.paymentIntents.retrieve(intentId)
        if (
          intent.id !== intentId ||
          stripeId(intent.customer) !== customerId ||
          intent.currency !== "usd" ||
          intent.amount !== expected
        )
          throw new Error("Current invoice payment parties or amount do not match")
        if (remote.status === "paid" && payment.amount_paid !== expected)
          throw new Error("Invoice paid allocation does not match")
        destination = stripeId(intent.transfer_data?.destination)
        applicationFee = intent.application_fee_amount
      }
      if (!destination) throw new Error("Missing invoice payout destination")
      // Reconciliation concerns an already-issued payment. Preserve its original
      // verified owner even if the sender has since linked a different account.
      const account = await stripe.accounts.retrieve(destination)
      if (account.type !== "express" || account.metadata?.renegadeUserId !== local.senderId)
        throw new Error("Invoice payout owner does not match")
      if (
        local.platformFee !== undefined &&
        applicationFee !== local.platformFee + (local.processingFee ?? 0)
      )
        throw new Error("Invoice application fee does not match")
      let status: "paid" | "processing" | "payment_pending" | "cancelled" | "overdue"
      let chargeId: string | undefined
      if (remote.status === "paid") {
        chargeId = stripeId(intent?.latest_charge)
        if (
          remote.amount_paid !== expected ||
          intent?.status !== "succeeded" ||
          intent.amount_received !== expected ||
          !chargeId
        )
          throw new Error("Invoice capture proof is incomplete")
        const charge = await stripe.charges.retrieve(chargeId)
        if (
          !(charge.paid && charge.captured) ||
          charge.amount_captured !== expected ||
          charge.currency !== "usd" ||
          stripeId(charge.customer) !== customerId ||
          stripeId(charge.payment_intent) !== intent.id ||
          stripeId(charge.transfer_data?.destination) !== destination
        )
          throw new Error("Invoice charge proof does not match")
        status = "paid"
      } else if (remote.status === "void") status = "cancelled"
      else if (remote.status === "uncollectible") status = "overdue"
      else if (remote.status === "open") {
        if (!intent || intent.status === "succeeded")
          throw new Error("Invoice settlement is pending")
        status = intent.status === "processing" ? "processing" : "payment_pending"
      } else throw new Error("Invoice finalization is pending")
      if (
        await ctx.runMutation(internal.invoices.applyPaymentReconciliation, {
          invoiceId: local._id,
          stripeInvoiceId: invoiceId,
          senderId: local.senderId,
          recipientId: local.recipientId,
          amount: expected,
          expectedVersion: local.paymentSyncVersion ?? 0,
          stripePaymentIntentId: intent?.id,
          stripeChargeId: chargeId,
          status,
          eventId: args.eventId,
          eventType: args.eventType,
          failureReason:
            status === "payment_pending" ? intent?.last_payment_error?.message : undefined,
        })
      )
        return true
      // Another writer committed while Stripe was being read. Fetch current
      // provider evidence again; never reuse the stale snapshot after a conflict.
    }
    throw new Error("Invoice changed during payment reconciliation; retry delivery")
  },
})

export const applyPaymentReconciliation = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    stripeInvoiceId: v.string(),
    senderId: v.string(),
    recipientId: v.string(),
    amount: v.number(),
    expectedVersion: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    status: v.union(
      v.literal("paid"),
      v.literal("processing"),
      v.literal("payment_pending"),
      v.literal("cancelled"),
      v.literal("overdue")
    ),
    eventId: v.string(),
    eventType: invoiceEventType,
  },
  handler: async (ctx, args): Promise<boolean> => {
    if (
      await ctx.runQuery(internal.webhookIdempotency.checkWebhookEvent, {
        eventId: args.eventId,
        source: "stripe",
      })
    )
      return true
    const local = await ctx.db.get(args.invoiceId)
    if (
      !local ||
      local.stripeInvoiceId !== args.stripeInvoiceId ||
      local.senderId !== args.senderId ||
      local.recipientId !== args.recipientId ||
      local.currency !== "usd" ||
      (local.amountDue ??
        local.total + (local.damageDepositAmount ?? 0) + (local.processingFee ?? 0)) !== args.amount
    )
      throw new Error("Invoice changed during payment reconciliation")
    if ((local.paymentSyncVersion ?? 0) !== args.expectedVersion) return false
    if (local.status === "paid" && args.status === "paid") {
      if (
        (local.stripePaymentIntentId &&
          local.stripePaymentIntentId !== args.stripePaymentIntentId) ||
        (local.stripeChargeId && local.stripeChargeId !== args.stripeChargeId)
      )
        throw new Error("Settled invoice payment binding does not match")
      await ctx.runMutation(internal.invoices.handleStripeInvoicePaid, {
        stripeInvoiceId: args.stripeInvoiceId,
        localInvoiceId: local._id,
        capturedAmount: args.amount,
        currency: "usd",
        stripePaymentIntentId: args.stripePaymentIntentId,
        stripeChargeId: args.stripeChargeId,
      })
    } else if (!["paid", "refunded", "cancelled"].includes(local.status)) {
      if (!["sent", "viewed", "payment_pending", "processing", "overdue"].includes(local.status))
        throw new Error("Invoice is not issued")
      if (args.status === "paid") {
        if (!args.stripeChargeId) throw new Error("Missing verified invoice charge")
        await ctx.runMutation(internal.invoices.handleStripeInvoicePaid, {
          stripeInvoiceId: args.stripeInvoiceId,
          localInvoiceId: local._id,
          capturedAmount: args.amount,
          currency: "usd",
          stripePaymentIntentId: args.stripePaymentIntentId,
          stripeChargeId: args.stripeChargeId,
        })
      } else {
        await ctx.db.patch(local._id, {
          status: args.status,
          stripePaymentIntentId: args.stripePaymentIntentId ?? local.stripePaymentIntentId,
          paymentFailureReason: args.failureReason,
          updatedAt: Date.now(),
        })
        if (
          args.failureReason &&
          args.status === "payment_pending" &&
          (local.status !== "payment_pending" ||
            local.stripePaymentIntentId !== args.stripePaymentIntentId ||
            local.paymentFailureReason !== args.failureReason)
        ) {
          await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
            userId: local.recipientId,
            type: "invoice",
            title: "Invoice payment failed",
            message: `Payment failed for "${local.title}". Please try again.`,
            link: `/deals/invoices/${local._id}`,
            metadata: { invoiceId: local._id },
          })
        }
      }
    }
    await ctx.db.patch(local._id, { paymentSyncVersion: args.expectedVersion + 1 })
    await ctx.runMutation(internal.webhookIdempotency.recordWebhookEvent, {
      eventId: args.eventId,
      source: "stripe",
      eventType: args.eventType,
    })
    return true
  },
})

export const handleStripeInvoicePaid = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    localInvoiceId: v.optional(v.string()),
    capturedAmount: v.number(),
    currency: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .unique()
    if (!invoice) {
      // Stripe may deliver invoice.paid before sendInvoice has returned its ID.
      const localId = args.localInvoiceId && ctx.db.normalizeId("invoices", args.localInvoiceId)
      const local = localId ? await ctx.db.get(localId) : null
      if (local && !local.stripeInvoiceId) throw new Error("Invoice registration is pending")
      return
    }
    if (args.localInvoiceId && args.localInvoiceId !== invoice._id) return
    const amountDue =
      invoice.amountDue ??
      invoice.total + (invoice.damageDepositAmount ?? 0) + (invoice.processingFee ?? 0)
    if (args.currency !== invoice.currency || args.capturedAmount !== amountDue) return
    if (invoice.status === "paid" || invoice.status === "refunded") {
      // The invoice and intent webhooks may deliver the charge reference separately.
      if (
        invoice.status === "paid" &&
        !invoice.stripeChargeId &&
        args.stripeChargeId &&
        (!invoice.stripePaymentIntentId ||
          invoice.stripePaymentIntentId === args.stripePaymentIntentId)
      ) {
        await ctx.db.patch(invoice._id, {
          stripeChargeId: args.stripeChargeId,
          stripePaymentIntentId: args.stripePaymentIntentId ?? invoice.stripePaymentIntentId,
        })
      }
      return
    }

    if (!["sent", "viewed", "payment_pending", "processing", "overdue"].includes(invoice.status))
      return
    const now = Date.now()
    await ctx.db.patch(invoice._id, {
      status: "paid",
      paymentFailureReason: undefined,
      stripePaymentIntentId: args.stripePaymentIntentId || invoice.stripePaymentIntentId,
      stripeChargeId: args.stripeChargeId || invoice.stripeChargeId,
      depositStatus:
        invoice.damageDepositAmount && invoice.damageDepositAmount > 0
          ? "held"
          : invoice.depositStatus || "not_required",
      paidAt: now,
      updatedAt: now,
    })

    await Promise.all([
      ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: invoice.senderId,
        type: "invoice",
        title: "Invoice paid",
        message: `Your invoice "${invoice.title}" has been paid.`,
        link: `/deals/invoices/${invoice._id}`,
        metadata: { invoiceId: invoice._id },
      }),
      ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: invoice.recipientId,
        type: "invoice",
        title: "Payment received",
        message: `Your payment for "${invoice.title}" has been received.`,
        link: `/deals/invoices/${invoice._id}`,
        metadata: { invoiceId: invoice._id },
      }),
      ctx.runMutation(internal.auditLog.create, {
        entityType: "invoice",
        entityId: invoice._id,
        action: "invoice_paid",
        metadata: args,
      }),
    ])

    const [sender, recipient] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.senderId))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.recipientId))
        .first(),
    ])
    if (sender?.email) {
      await sendTransactionalEmail(
        ctx,
        sender.email,
        getCustomInvoicePaidEmailTemplate({
          recipientName: sender.name,
          title: invoice.title,
          amount: invoice.amountDue || invoice.total,
          invoiceUrl: `${getWebUrl()}/deals/invoices/${invoice._id}`,
        })
      )
    }
    if (recipient?.email) {
      await sendTransactionalEmail(
        ctx,
        recipient.email,
        getCustomInvoicePaidEmailTemplate({
          recipientName: recipient.name,
          title: invoice.title,
          amount: invoice.amountDue || invoice.total,
          invoiceUrl: `${getWebUrl()}/deals/invoices/${invoice._id}`,
        })
      )
    }
  },
})

// Resolve the *original* paid invoice's charge, even after the sender changes
// their payout account. A stale ledger charge must never refund an unrelated payment.
async function paidInvoiceCharge(stripe: Stripe, local: Doc<"invoices">): Promise<string> {
  if (!local.stripeInvoiceId) throwError(ErrorCode.INVALID_STATUS, "Missing Stripe invoice")
  const remote = await stripe.invoices.retrieve(local.stripeInvoiceId)
  verifyStripeInvoice(local, remote)
  if (remote.status !== "paid") throwError(ErrorCode.INVALID_STATUS, "Stripe invoice is not paid")
  const customer = stripeId(remote.customer)
  if (!customer)
    throwError(ErrorCode.FORBIDDEN, "The original invoice customer could not be verified")
  const legacy = remote as Stripe.Invoice & {
    charge?: string | Stripe.Charge
    payment_intent?: string | Stripe.PaymentIntent
  }
  let directCharge = legacy.charge
  let intentId = stripeId(legacy.payment_intent)
  let charge: string | undefined
  if (!directCharge) {
    const payments = await stripe.invoicePayments.list({
      invoice: remote.id,
      status: "paid",
      limit: 2,
      expand: ["data.payment.payment_intent"],
    })
    const paid = payments.data[0]
    const sourceInvoiceId = typeof paid?.invoice === "string" ? paid.invoice : paid?.invoice.id
    if (!paid || sourceInvoiceId !== remote.id || payments.data.length !== 1 || payments.has_more)
      throwError(ErrorCode.FORBIDDEN, "The original Stripe invoice payment could not be verified")
    const payment = paid.payment
    if (payment.type === "charge") directCharge = payment.charge ?? undefined
    else if (payment.type === "payment_intent" && payment.payment_intent) {
      const intent =
        typeof payment.payment_intent === "string"
          ? await stripe.paymentIntents.retrieve(payment.payment_intent)
          : payment.payment_intent
      if (stripeId(intent.customer) !== customer || (intentId && intent.id !== intentId))
        throwError(ErrorCode.FORBIDDEN, "The original Stripe invoice payment does not match")
      intentId = intent.id
      charge = stripeId(intent.latest_charge)
    }
  }
  if (directCharge) {
    const paidCharge =
      typeof directCharge === "string" ? await stripe.charges.retrieve(directCharge) : directCharge
    const chargeIntent = stripeId(paidCharge.payment_intent)
    if (stripeId(paidCharge.customer) !== customer || (intentId && chargeIntent !== intentId))
      throwError(ErrorCode.FORBIDDEN, "The original Stripe invoice charge does not match")
    intentId = chargeIntent
    charge = paidCharge.id
  }
  if (
    !charge ||
    (local.stripeChargeId && charge !== local.stripeChargeId) ||
    (local.stripePaymentIntentId && intentId !== local.stripePaymentIntentId)
  ) {
    throwError(ErrorCode.FORBIDDEN, "The original Stripe invoice charge could not be verified")
  }
  return charge
}

const depositRequestIdPattern = /^[a-zA-Z0-9_-]{1,90}$/

const depositRequestArgs = {
  invoiceId: v.id("invoices"),
  requestId: v.string(),
  amount: v.optional(v.number()),
  reason: v.optional(v.string()),
}

export const reserveDepositRefund = internalMutation({
  args: depositRequestArgs,
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice || invoice.status !== "paid")
      throwError(ErrorCode.INVALID_STATUS, "Invoice must be paid")
    const existing = await ctx.db
      .query("invoiceDepositRefundRequests")
      .withIndex("by_invoice_request", (q) =>
        q.eq("invoiceId", args.invoiceId).eq("requestId", args.requestId)
      )
      .unique()
    if (existing) {
      if (existing.requestedAmount !== args.amount || existing.reason !== args.reason)
        throwError(ErrorCode.CONFLICT, "Refund request changed")
      return existing
    }
    const unresolved = await ctx.db
      .query("invoiceDepositRefundRequests")
      .withIndex("by_invoice_state", (q) =>
        q.eq("invoiceId", args.invoiceId).eq("state", "reserved")
      )
      .first()
    if (unresolved)
      throwError(ErrorCode.CONFLICT, "A prior refund is still being submitted. Retry that request.")
    const remaining =
      (invoice.damageDepositAmount ?? 0) -
      (invoice.depositRefundAmount ?? 0) -
      (invoice.depositRefundPendingAmount ?? 0)
    const amount = args.amount ?? remaining
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > remaining)
      throwError(ErrorCode.INVALID_REFUND_AMOUNT, "Invalid deposit refund amount")
    await assertAccountsAvailable(ctx, invoice.senderId, invoice.recipientId)
    const id = await ctx.db.insert("invoiceDepositRefundRequests", {
      invoiceId: args.invoiceId,
      requestId: args.requestId,
      requestedAmount: args.amount,
      amount,
      reason: args.reason,
      state: "reserved",
    })
    // Recover if the calling action exits after reserving or after an ambiguous Stripe POST.
    await ctx.scheduler.runAfter(2 * 60_000, internal.invoices.recoverDepositRefund, {
      id,
      attempt: 0,
    })
    const request = await ctx.db.get(id)
    if (!request) throwError(ErrorCode.NOT_FOUND, "Refund request not found")
    return request
  },
})

export const rejectDepositRefund = internalMutation({
  args: { id: v.id("invoiceDepositRefundRequests") },
  handler: async (ctx, { id }) => {
    if ((await ctx.db.get(id))?.state === "reserved") await ctx.db.patch(id, { state: "rejected" })
  },
})

const depositRefundRow = v.object({
  refundId: v.string(),
  amount: v.number(),
  status: v.string(),
  requestId: v.optional(v.string()),
})

export const updateDepositRefund = internalMutation({
  args: { invoiceId: v.id("invoices"), version: v.number(), refunds: v.array(depositRefundRow) },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    if ((invoice.depositRefundSyncVersion ?? 0) !== args.version) return false
    let refunded = 0
    let pending = 0
    let reason: string | undefined
    for (const refund of args.refunds) {
      if (refund.status === "succeeded") refunded += refund.amount
      else if (refund.status !== "failed" && refund.status !== "canceled") pending += refund.amount
      const requestId = refund.requestId
      if (!requestId) continue // Earlier releases tagged only the invoice ID.
      const request = await ctx.db
        .query("invoiceDepositRefundRequests")
        .withIndex("by_invoice_request", (q) =>
          q.eq("invoiceId", invoice._id).eq("requestId", requestId)
        )
        .unique()
      if (
        !request ||
        request.amount !== refund.amount ||
        (request.stripeRefundId && request.stripeRefundId !== refund.refundId)
      )
        throwError(ErrorCode.CONFLICT, "Stripe refund does not match the recorded request")
      await ctx.db.patch(request._id, { state: "submitted", stripeRefundId: refund.refundId })
      if (!reason && refund.status === "succeeded") reason = request.reason
    }
    const deposit = invoice.damageDepositAmount ?? 0
    const difference = refunded - (invoice.depositRefundAmount ?? 0)
    const pendingChanged = pending !== (invoice.depositRefundPendingAmount ?? 0)
    await ctx.db.patch(invoice._id, {
      depositRefundSyncVersion: args.version + 1,
      depositRefundAmount: refunded,
      depositRefundPendingAmount: pending,
      ...(difference !== 0 && {
        depositRefundReason: reason ?? invoice.depositRefundReason,
        depositRefundedAt: Date.now(),
      }),
      ...(args.refunds[0] && {
        stripeDepositRefundId: args.refunds[0].refundId,
        depositLatestRefundStatus: args.refunds[0].status,
      }),
      ...(deposit > 0 && {
        depositStatus:
          refunded >= deposit ? "refunded" : refunded > 0 ? "partially_refunded" : "held",
      }),
      ...((difference !== 0 || pendingChanged) && { updatedAt: Date.now() }),
    })
    if (difference === 0 && !pendingChanged) return true
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "invoice",
      entityId: invoice._id,
      action: "refund_invoice_deposit",
      metadata: { totalRefunded: refunded, pending, change: difference },
    })
    if (difference > 0) {
      const recipient = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", invoice.recipientId))
        .first()
      if (recipient?.email)
        await sendTransactionalEmail(
          ctx,
          recipient.email,
          getDepositRefundedEmailTemplate({
            recipientName: recipient.name,
            title: invoice.title,
            amount: difference,
            invoiceUrl: `${getWebUrl()}/deals/invoices/${invoice._id}`,
          })
        )
    }
    return true
  },
})

async function reconcileDepositRefunds(
  ctx: ActionCtx,
  stripe: Stripe,
  local: Doc<"invoices">,
  charge: string
) {
  let invoice = local
  for (;;) {
    const refunds: Stripe.Refund[] = []
    for await (const r of stripe.refunds.list({ charge, limit: 100 })) {
      if (
        stripeId(r.charge) === charge &&
        r.metadata?.type === "invoice_damage_deposit_refund" &&
        r.metadata.invoiceId === invoice._id
      )
        refunds.push(r)
    }
    const applied: boolean = await ctx.runMutation(internal.invoices.updateDepositRefund, {
      invoiceId: invoice._id,
      version: invoice.depositRefundSyncVersion ?? 0,
      refunds: refunds.map((r) => ({
        refundId: r.id,
        amount: r.amount,
        status: r.status ?? "pending",
        requestId: r.metadata?.depositRequestId,
      })),
    })
    if (applied) return refunds
    const fresh: Doc<"invoices"> | null = await ctx.runQuery(internal.invoices.getRawById, {
      invoiceId: invoice._id,
    })
    if (!fresh) throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    invoice = fresh
  }
}

export const getDepositRefundInvoice = internalQuery({
  args: { invoiceId: v.string() },
  handler: (ctx, { invoiceId }) => {
    const id = ctx.db.normalizeId("invoices", invoiceId)
    return id ? ctx.db.get(id) : null
  },
})

export const syncDepositRefund = internalAction({
  args: { invoiceId: v.string(), chargeId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const local = await ctx.runQuery(internal.invoices.getDepositRefundInvoice, {
      invoiceId: args.invoiceId,
    })
    if (!local || local.status !== "paid") return
    const stripe = getStripe()
    const charge = await paidInvoiceCharge(stripe, local)
    if (charge === args.chargeId) await reconcileDepositRefunds(ctx, stripe, local, charge)
  },
})

export const refundDeposit = action({
  args: { ...depositRequestArgs, requestId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ id: string; status: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throwError(ErrorCode.AUTH_REQUIRED, "Not authenticated")
    const invoice = await ctx.runQuery(internal.invoices.getRawById, { invoiceId: args.invoiceId })
    if (!invoice) throwError(ErrorCode.NOT_FOUND, "Invoice not found")
    if (invoice.senderId !== identity.subject)
      throwError(ErrorCode.FORBIDDEN, "Only the invoice sender can refund the deposit")
    if (
      invoice.status !== "paid" ||
      !(invoice.damageDepositAmount && invoice.damageDepositAmount > 0)
    )
      throwError(ErrorCode.INVALID_STATUS, "No paid deposit to refund")
    const requestId = args.requestId ?? `legacy-${args.amount ?? "remaining"}`
    if (!depositRequestIdPattern.test(requestId))
      throwError(ErrorCode.INVALID_INPUT, "Invalid refund request ID")
    return withAccountOperation(
      ctx,
      `invoice-deposit-refund:${invoice._id}`,
      [identity.subject, invoice.senderId, invoice.recipientId],
      async (beforeProviderMutation) => {
        const stripe = getStripe()
        const charge = await paidInvoiceCharge(stripe, invoice)
        const refunds = await reconcileDepositRefunds(ctx, stripe, invoice, charge)
        const request = await ctx.runMutation(internal.invoices.reserveDepositRefund, {
          ...args,
          requestId,
        })
        beforeProviderMutation()
        return submitDepositRefund(ctx, stripe, { invoice, charge, request, refunds })
      }
    )
  },
})

async function submitDepositRefund(
  ctx: ActionCtx,
  stripe: Stripe,
  payment: {
    invoice: Doc<"invoices">
    charge: string
    request: Doc<"invoiceDepositRefundRequests">
    refunds: Stripe.Refund[]
  }
) {
  const { invoice, charge, request, refunds } = payment
  if (request.state === "rejected") return { id: request.requestId, status: "failed" }
  const previous = refunds.find((r) => r.metadata?.depositRequestId === request.requestId)
  if (previous) return { id: previous.id, status: previous.status ?? "pending" }
  if (request.stripeRefundId) {
    const existing = await stripe.refunds.retrieve(request.stripeRefundId)
    return { id: existing.id, status: existing.status ?? "pending" }
  }
  let refund: Stripe.Refund
  try {
    refund = await stripe.refunds.create(
      {
        charge,
        amount: request.amount,
        reverse_transfer: true,
        refund_application_fee: false,
        reason: "requested_by_customer",
        metadata: {
          type: "invoice_damage_deposit_refund",
          invoiceId: invoice._id,
          depositRequestId: request.requestId,
        },
      },
      { idempotencyKey: `invoice-deposit-${request._id}` }
    )
  } catch (error) {
    // A definitive invalid request never produced a refund. Network errors and
    // idempotency conflicts must keep the same request available for recovery.
    if (
      error instanceof Error &&
      "type" in error &&
      error.type === "StripeInvalidRequestError" &&
      "statusCode" in error &&
      error.statusCode === 400
    ) {
      await ctx.runMutation(internal.invoices.rejectDepositRefund, { id: request._id })
      return { id: request.requestId, status: "failed" }
    }
    throw error
  }
  const confirmed = await reconcileDepositRefunds(ctx, stripe, invoice, charge)
  const current = confirmed.find((r) => r.id === refund.id)
  if (!current)
    throwError(ErrorCode.CONFLICT, "Stripe refund is being reconciled. Retry this request.")
  return { id: refund.id, status: current.status ?? "pending" }
}

export const getDepositRequest = internalQuery({
  args: { id: v.id("invoiceDepositRefundRequests") },
  handler: (ctx, { id }) => ctx.db.get(id),
})

export const recoverDepositRefund = internalAction({
  args: { id: v.id("invoiceDepositRefundRequests"), attempt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const request = await ctx.runQuery(internal.invoices.getDepositRequest, { id: args.id })
    if (!request || request.state !== "reserved") return
    const invoice = await ctx.runQuery(internal.invoices.getRawById, {
      invoiceId: request.invoiceId,
    })
    if (!invoice || invoice.status !== "paid") return
    try {
      const stripe = getStripe()
      const charge = await paidInvoiceCharge(stripe, invoice)
      const refunds = await reconcileDepositRefunds(ctx, stripe, invoice, charge)
      await submitDepositRefund(ctx, stripe, { invoice, charge, request, refunds })
    } catch (error) {
      // The request remains durable; a manual retry or the next scheduled attempt reuses its key.
      if (args.attempt < 5)
        await ctx.scheduler.runAfter(
          60_000 * 2 ** args.attempt,
          internal.invoices.recoverDepositRefund,
          {
            id: args.id,
            attempt: args.attempt + 1,
          }
        )
      throw error
    }
  },
})
