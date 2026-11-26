import type { UserIdentity } from "convex/server"
import type Stripe from "stripe"
import { internal } from "./_generated/api"
import type { ActionCtx } from "./_generated/server"
import { ErrorCode, throwError } from "./errors"

export const EXPRESS_SIGN_IN_URL = "https://connect.stripe.com/express_login"

// Recheck at the provider mutation and response boundaries, since actions can
// await customer/ledger work after their initial ownership verification.
export async function assertPayoutAccountNotRevoked(ctx: ActionCtx, stripeAccountId: string) {
  if (await ctx.runQuery(internal.stripeRevocations.getByAccount, { stripeAccountId })) {
    throwError(
      ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
      "Payments are on hold because Stripe account access was revoked. Contact support."
    )
  }
}

// Historically the platform created Express accounts without owner metadata.
// Owners of older accounts can still check their status and sign in through Stripe.
async function retrieveLinkedAccount(
  ctx: ActionCtx,
  stripe: Stripe,
  {
    stripeAccountId,
    ownerId,
    requireAccess,
  }: {
    stripeAccountId: string
    ownerId: string
    requireAccess: boolean
  }
): Promise<Stripe.Account> {
  const user = await ctx.runQuery(internal.users.getByStripeAccountId, { stripeAccountId })
  if (user?.externalId !== ownerId) {
    throwError(
      ErrorCode.FORBIDDEN,
      "Stripe account ownership could not be verified. Contact support."
    )
  }
  if (requireAccess) await assertPayoutAccountNotRevoked(ctx, stripeAccountId)
  const account = await stripe.accounts.retrieve(stripeAccountId)
  // A revocation may arrive while the provider request is in flight.
  if (requireAccess) await assertPayoutAccountNotRevoked(ctx, stripeAccountId)
  const stripeOwner = account.metadata?.renegadeUserId
  if (account.type !== "express" || (stripeOwner !== undefined && stripeOwner !== ownerId)) {
    throwError(
      ErrorCode.FORBIDDEN,
      "Stripe account ownership could not be verified. Contact support."
    )
  }
  return account
}

export function retrieveLinkedConnectAccount(
  ctx: ActionCtx,
  stripe: Stripe,
  stripeAccountId: string,
  ownerId: string
): Promise<Stripe.Account> {
  return retrieveLinkedAccount(ctx, stripe, { stripeAccountId, ownerId, requireAccess: true })
}

// Read-only settlement/payout evidence can survive a hold. This helper conveys
// no permission to onboard, log in, charge, transfer, or expose a payment link.
export function retrieveLinkedConnectAccountForEvidence(
  ctx: ActionCtx,
  stripe: Stripe,
  stripeAccountId: string,
  ownerId: string
): Promise<Stripe.Account> {
  return retrieveLinkedAccount(ctx, stripe, { stripeAccountId, ownerId, requireAccess: false })
}

// Every new destination charge must match both the unique local link and Stripe's owner tag.
export async function verifiedPaymentDestination(
  ctx: ActionCtx,
  stripe: Stripe,
  stripeAccountId: string,
  ownerId: string
): Promise<Stripe.Account> {
  await ctx.runQuery(internal.payoutRecovery.assertPaymentAllowed, { subject: ownerId })
  const account = await retrieveLinkedConnectAccount(ctx, stripe, stripeAccountId, ownerId)
  await ctx.runQuery(internal.payoutRecovery.assertPaymentAllowed, { subject: ownerId })
  if (account.metadata?.renegadeUserId !== ownerId) {
    throwError(
      ErrorCode.STRIPE_ACCOUNT_INCOMPLETE,
      "Payments are on hold until the payout account owner is verified. Please contact support."
    )
  }
  return account
}

export async function retrieveOwnedCustomer(stripe: Stripe, customerId: string, userId: string) {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted || customer.metadata?.userId !== userId) {
    throwError(
      ErrorCode.FORBIDDEN,
      "Stripe customer ownership could not be verified. Contact support."
    )
  }
  return customer
}

export async function billingCustomerId(
  ctx: ActionCtx,
  stripe: Stripe,
  identity: UserIdentity,
  componentCustomer?: () => Promise<{ customerId: string; isNew: boolean }>
): Promise<string> {
  const user = await ctx.runQuery(internal.users.getByExternalIdInternal, {
    externalId: identity.subject,
  })
  if (!user) throwError(ErrorCode.NOT_FOUND, "User not found")
  if (user.stripeCustomerId) {
    return (await retrieveOwnedCustomer(stripe, user.stripeCustomerId, identity.subject)).id
  }

  let customerId: string
  if (componentCustomer) {
    const customer = await componentCustomer()
    if (!customer.isNew) await retrieveOwnedCustomer(stripe, customer.customerId, identity.subject)
    customerId = customer.customerId
  } else {
    const customer = await stripe.customers.create(
      {
        email: identity.email || undefined,
        name: identity.name || undefined,
        metadata: { userId: identity.subject },
      },
      { idempotencyKey: `create_customer_${identity.subject}` }
    )
    customerId = customer.id
  }
  await ctx.runMutation(internal.users.setStripeCustomerId, {
    userId: identity.subject,
    stripeCustomerId: customerId,
  })
  return customerId
}
