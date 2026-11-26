/** Only navigate to the Stripe-hosted URL returned by the authenticated action. */
export function stripeSetupUrl(target: string): string {
  const url = new URL(target)
  if (
    url.protocol !== "https:" ||
    url.hostname !== "connect.stripe.com" ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Invalid Stripe setup destination")
  }
  return url.toString()
}

export function openStripeSetup(target: string) {
  window.location.assign(stripeSetupUrl(target))
}
