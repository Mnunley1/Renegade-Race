import type { UserIdentity } from "convex/server"
import type Stripe from "stripe"
import { internal } from "./_generated/api"
import type { ActionCtx } from "./_generated/server"
import { ErrorCode, throwError } from "./errors"

export const EXPRESS_SIGN_IN_URL = "https://connect.stripe.com/express_login"

// Historically the platform created Express accounts without owner metadata.
// Keep established, unique destinations usable, but never mint a bearer link
// for one without independent ownership evidence from Stripe.
export async function retrieveLinkedConnectAccount(
  ctx: ActionCtx,
  stripe: Stripe,
  stripeAccountId: string,
  ownerId: string
): Promise<Stripe.Account> {
  const user = await ctx.runQuery(internal.users.getByStripeAccountId, { stripeAccountId })
  if (user?.externalId !== ownerId) {
    throwError(
      ErrorCode.FORBIDDEN,
      "Stripe account ownership could not be verified. Contact support."
    )
  }
  const account = await stripe.accounts.retrieve(stripeAccountId)
  const stripeOwner = account.metadata?.renegadeUserId
  if (account.type !== "express" || (stripeOwner !== undefined && stripeOwner !== ownerId)) {
    throwError(
      ErrorCode.FORBIDDEN,
      "Stripe account ownership could not be verified. Contact support."
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
