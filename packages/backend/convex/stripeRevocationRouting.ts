import type { HttpRouter } from "convex/server"
import Stripe from "stripe"
import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"
import { STRIPE_WEBHOOK_ROUTES, STRIPE_WEBHOOK_VERSIONS } from "./stripeWebhookRouting"

export const STRIPE_REVOCATION_WEBHOOK_PATH = "/stripe/connect-revocation-webhook"
const REVOCATION_EVENT = "account.application.deauthorized"
const ENDPOINT_VERSION = "2025-08-27.basil"
const ACCOUNT_ID = /^acct_[a-zA-Z0-9]+$/
const APPLICATION_ID = /^ca_[a-zA-Z0-9]+$/
const ENDPOINT_ID = /^we_[a-zA-Z0-9]+$/
const EVENT_ID = /^evt_[a-zA-Z0-9]+$/
const SECRET_KEY_MODE = /^sk_(test|live)_/
const SECRET_FINGERPRINT = /^[a-f0-9]{64}$/

type RevocationBinding = {
  platformAccountId: string
  applicationId: string
  webhookEndpointId: string
  secretSha256: string
}

function configuration() {
  const key = process.env.STRIPE_SECRET_KEY
  const secret = process.env.STRIPE_CONNECT_REVOCATION_WEBHOOK_SECRET
  const mode = key?.match(SECRET_KEY_MODE)?.[1]
  if (!(key && mode && secret?.startsWith("whsec_"))) return
  if (Object.values(STRIPE_WEBHOOK_ROUTES).some((route) => process.env[route.secret] === secret))
    return
  let value: unknown
  try {
    value = JSON.parse(process.env.STRIPE_CONNECT_REVOCATION_BINDING ?? "")
  } catch {
    return
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const binding = value as RevocationBinding
  if (
    Object.keys(binding).length !== 4 ||
    typeof binding.platformAccountId !== "string" ||
    !ACCOUNT_ID.test(binding.platformAccountId) ||
    typeof binding.applicationId !== "string" ||
    !APPLICATION_ID.test(binding.applicationId) ||
    typeof binding.webhookEndpointId !== "string" ||
    !ENDPOINT_ID.test(binding.webhookEndpointId) ||
    typeof binding.secretSha256 !== "string" ||
    !SECRET_FINGERPRINT.test(binding.secretSha256)
  )
    return
  return { key, secret, live: mode === "live", binding }
}

function validEvent(event: Stripe.Event, live: boolean, applicationId: string) {
  return (
    event &&
    event.object === "event" &&
    typeof event.id === "string" &&
    EVENT_ID.test(event.id) &&
    event.type === REVOCATION_EVENT &&
    typeof event.account === "string" &&
    ACCOUNT_ID.test(event.account) &&
    event.livemode === live &&
    Number.isSafeInteger(event.created) &&
    event.created > 0 &&
    STRIPE_WEBHOOK_VERSIONS.some((version) => version === event.api_version) &&
    event.data?.object?.object === "application" &&
    event.data.object.id === applicationId
  )
}

/** Revocation removes connected-account API access, including its event store.
 * This application-only lifecycle ingress therefore trusts the signed account
 * attribution, bound to a separately provisioned destination and its application.
 * It never treats a failed account/event read as proof, and never enables/relinks
 * an account. Possession of this destination's secret is signing authority; it
 * cannot independently disprove a payload re-signed with that genuine secret. */
export function registerStripeRevocationWebhook(http: HttpRouter) {
  http.route({
    path: STRIPE_REVOCATION_WEBHOOK_PATH,
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const config = configuration()
      if (!config)
        return new Response("Stripe revocation webhook is not configured", { status: 500 })
      const { key, secret, live, binding } = config
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))
      const fingerprint = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, "0")
      ).join("")
      if (fingerprint !== binding.secretSha256)
        return new Response("Stripe revocation binding is not configured", { status: 500 })
      const signature = request.headers.get("stripe-signature")
      if (!signature) return new Response("Invalid Stripe signature", { status: 400 })
      const stripe = new Stripe(key, { apiVersion: ENDPOINT_VERSION })
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
      if (!validEvent(event, live, binding.applicationId))
        return new Response("Stripe revocation event does not match this endpoint", { status: 400 })
      try {
        // Both reads use the platform credential without a Stripe-Account header.
        // The creation-time secret fingerprint ties the one-time secret to this
        // endpoint; endpoint retrieval alone does not return or prove its secret.
        const platform = await stripe.accounts.retrieve()
        const endpoint = await stripe.webhookEndpoints.retrieve(binding.webhookEndpointId)
        if (
          platform.object !== "account" ||
          platform.id !== binding.platformAccountId ||
          endpoint.object !== "webhook_endpoint" ||
          endpoint.id !== binding.webhookEndpointId ||
          endpoint.application !== binding.applicationId ||
          endpoint.url !== request.url ||
          endpoint.status !== "enabled" ||
          endpoint.livemode !== live ||
          endpoint.api_version !== ENDPOINT_VERSION ||
          endpoint.enabled_events.length !== 1 ||
          endpoint.enabled_events[0] !== REVOCATION_EVENT
        )
          return new Response("Stripe revocation destination binding is unavailable", {
            status: 500,
          })
        await ctx.runMutation(internal.stripeRevocations.recordVerifiedRevocation, {
          stripeAccountId: event.account as string,
          applicationId: binding.applicationId,
          platformAccountId: binding.platformAccountId,
          livemode: live,
          eventId: event.id,
          eventCreated: event.created,
        })
      } catch {
        // Provider/configuration outages retain retries, with no financial work.
        return new Response("Stripe revocation verification is unavailable", { status: 500 })
      }
      return Response.json({ received: true })
    }),
  })
}
