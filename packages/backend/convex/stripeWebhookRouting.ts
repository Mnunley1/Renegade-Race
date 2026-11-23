import type { StripeEventHandlers } from "@convex-dev/stripe"
import type { HttpRouter } from "convex/server"
import Stripe from "stripe"
import { components } from "./_generated/api"
import { httpAction, type ActionCtx } from "./_generated/server"

// Snapshot formats reviewed against both the preserved destination and pinned SDK.
export const STRIPE_WEBHOOK_VERSIONS = [
  "2022-11-15",
  "2024-10-28.acacia",
  "2025-08-27.basil",
] as const
export const PLATFORM_WEBHOOK_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.canceled",
  "checkout.session.completed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.dispute.created",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.voided",
  "invoice.marked_uncollectible",
] as const satisfies readonly Stripe.Event.Type[]
export const CONNECT_WEBHOOK_EVENTS = [
  "account.updated",
  "payout.failed",
] as const satisfies readonly Stripe.Event.Type[]
const CONNECT_ACCOUNT = /^acct_[a-zA-Z0-9_]+$/
const SECRET_KEY_MODE = /^sk_(test|live)_/

type Scope = "platform" | "connect"
type EventHandler = (context: ActionCtx, stripeEvent: Stripe.Event) => Promise<void>
export const STRIPE_WEBHOOK_ROUTES = {
  platform: {
    path: "/stripe/platform-webhook",
    secret: "STRIPE_PLATFORM_WEBHOOK_SECRET",
    scope: "platform",
  },
  legacyConnect: { path: "/stripe/webhook", secret: "STRIPE_WEBHOOK_SECRET", scope: "connect" },
  connect: {
    path: "/stripe/connect-webhook",
    secret: "STRIPE_CONNECT_WEBHOOK_SECRET",
    scope: "connect",
  },
} as const

function eventObjectId(event: Stripe.Event) {
  const object = event.data.object
  return "id" in object && typeof object.id === "string" ? object.id : undefined
}

function eventObjectType(type: string): string {
  if (type.startsWith("payment_intent.")) return "payment_intent"
  if (type.startsWith("checkout.session.")) return "checkout.session"
  if (type.startsWith("charge.dispute.")) return "dispute"
  if (type.startsWith("charge.")) return "charge"
  if (type.startsWith("refund.")) return "refund"
  if (type.startsWith("invoice.")) return "invoice"
  if (type === "account.application.deauthorized") return "application"
  if (type === "account.updated") return "account"
  return "payout"
}

/** These checks run before component mirrors, application writes, or receipts. */
function validateEnvelope(event: Stripe.Event, scope: Scope, live: boolean): boolean {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false
  if (
    event.object !== "event" ||
    typeof event.id !== "string" ||
    !event.id ||
    typeof event.type !== "string" ||
    typeof event.livemode !== "boolean" ||
    event.livemode !== live ||
    !event.data ||
    typeof event.data.object !== "object" ||
    !event.data.object ||
    Array.isArray(event.data.object) ||
    !STRIPE_WEBHOOK_VERSIONS.some((version) => version === event.api_version)
  )
    return false
  if ("livemode" in event.data.object && event.data.object.livemode !== event.livemode) return false
  if (scope === "platform") return event.account === undefined || event.account === null
  if (typeof event.account !== "string" || !CONNECT_ACCOUNT.test(event.account)) return false
  return event.type !== "account.updated" || event.data.object.id === event.account
}

function matchesProviderEvent(
  received: Stripe.Event,
  canonical: Stripe.Event,
  scope: Scope,
  live: boolean
) {
  return (
    validateEnvelope(canonical, scope, live) &&
    canonical.id === received.id &&
    canonical.type === received.type &&
    (canonical.account ?? null) === (received.account ?? null) &&
    canonical.livemode === received.livemode &&
    eventObjectId(canonical) === eventObjectId(received) &&
    canonical.data.object.object === eventObjectType(canonical.type)
  )
}

function routeConfiguration(route: keyof typeof STRIPE_WEBHOOK_ROUTES) {
  const secret = process.env[STRIPE_WEBHOOK_ROUTES[route].secret]
  const key = process.env.STRIPE_SECRET_KEY
  const mode = key?.match(SECRET_KEY_MODE)?.[1]
  if (!(secret && key && mode)) return
  // Bad optional additions must not disable the preserved legacy endpoint.
  if (route !== "legacyConnect") {
    const sameSecrets = Object.values(STRIPE_WEBHOOK_ROUTES).filter(
      (config) => process.env[config.secret] === secret
    )
    if (sameSecrets.length > 1) return
  }
  return { secret, key, live: mode === "live" }
}

function retrieveProviderEvent(stripe: Stripe, event: Stripe.Event, scope: Scope) {
  return scope === "platform"
    ? stripe.events.retrieve(event.id)
    : stripe.events.retrieve(event.id, {}, { stripeAccount: event.account })
}

export function registerScopedStripeWebhook(
  http: HttpRouter,
  route: keyof typeof STRIPE_WEBHOOK_ROUTES,
  handlers: StripeEventHandlers
) {
  const { path, scope } = STRIPE_WEBHOOK_ROUTES[route]
  http.route({
    path,
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const configuration = routeConfiguration(route)
      if (!configuration) return new Response("Stripe webhook is not configured", { status: 500 })
      const { secret, key, live } = configuration
      const signature = request.headers.get("stripe-signature")
      if (!signature) return new Response("Invalid Stripe signature", { status: 400 })
      const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" })
      let event: Stripe.Event
      try {
        event = await stripe.webhooks.constructEventAsync(
          await request.text(),
          signature,
          secret,
          undefined,
          Stripe.createSubtleCryptoProvider()
        )
      } catch {
        return new Response("Invalid Stripe signature", { status: 400 })
      }
      if (!validateEnvelope(event, scope, live))
        return new Response("Stripe event does not match this endpoint", { status: 400 })
      const supported: readonly string[] =
        scope === "platform" ? PLATFORM_WEBHOOK_EVENTS : CONNECT_WEBHOOK_EVENTS
      // Preserved Connect subscriptions include legacy payment events. Acknowledge
      // those authenticated deliveries without ever touching the platform cache.
      if (!supported.includes(event.type)) return Response.json({ received: true, ignored: true })
      if (!eventObjectId(event) || event.data.object.object !== eventObjectType(event.type))
        return new Response("Invalid Stripe event object", { status: 400 })
      // An endpoint secret can be accidentally paired with a different same-mode
      // API key. Bind each supported event to the configured provider account
      // before any handler, receipt, or shared component mutation.
      let confirmed: Stripe.Event
      try {
        confirmed = await retrieveProviderEvent(stripe, event, scope)
      } catch {
        return new Response("Stripe event verification is unavailable", { status: 500 })
      }
      if (!matchesProviderEvent(event, confirmed, scope, live)) {
        return new Response("Stripe event does not match its provider record", { status: 400 })
      }
      const handler = handlers[event.type] as EventHandler | undefined
      if (!handler) return new Response("Stripe event handler is not configured", { status: 500 })
      try {
        await handler(ctx, confirmed)
        if (scope === "platform") await syncPlatformComponent(ctx, stripe, confirmed)
      } catch {
        // Keep provider retries active, without echoing payloads or provider errors.
        return new Response("Stripe event processing failed", { status: 500 })
      }
      return Response.json({ received: true })
    }),
  })
}

/** The component's registerRoutes writes before custom handlers. Mirror only the
 * reviewed platform subset, after ingress and authoritative handlers succeed.
 * A failed mirror returns 500; replay reruns the idempotent app handler + mirror. */
async function syncPlatformComponent(ctx: ActionCtx, stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent & {
        invoice?: string | Stripe.Invoice
      }
      if (intent.invoice) {
        const invoice =
          typeof intent.invoice === "string"
            ? await stripe.invoices.retrieve(intent.invoice)
            : intent.invoice
        if (
          (invoice as Stripe.Invoice & { subscription?: unknown }).subscription ||
          invoice.parent?.subscription_details
        )
          return
      }
      await ctx.runMutation(components.stripe.private.handlePaymentIntentSucceeded, {
        stripePaymentIntentId: intent.id,
        stripeCustomerId: stripeId(intent.customer),
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        created: intent.created,
        metadata: intent.metadata ?? {},
      })
      return
    }
    case "checkout.session.completed": {
      const session = event.data.object
      await ctx.runMutation(components.stripe.private.handleCheckoutSessionCompleted, {
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: stripeId(session.customer),
        mode: session.mode,
        metadata: session.metadata ?? undefined,
      })
      const customer = stripeId(session.customer)
      const intent = stripeId(session.payment_intent)
      if (session.mode === "payment" && customer && intent)
        await ctx.runMutation(components.stripe.private.updatePaymentCustomer, {
          stripePaymentIntentId: intent,
          stripeCustomerId: customer,
        })
      return
    }
    case "invoice.paid": {
      const invoiceId = event.data.object.id
      if (!invoiceId) throw new Error("Missing invoice ID")
      await ctx.runMutation(components.stripe.private.handleInvoicePaid, {
        stripeInvoiceId: invoiceId,
        amountPaid: event.data.object.amount_paid,
      })
      return
    }
    case "invoice.payment_failed": {
      const invoiceId = event.data.object.id
      if (!invoiceId) throw new Error("Missing invoice ID")
      await ctx.runMutation(components.stripe.private.handleInvoicePaymentFailed, {
        stripeInvoiceId: invoiceId,
      })
    }
  }
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id
}
