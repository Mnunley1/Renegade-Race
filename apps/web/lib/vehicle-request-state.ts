/** This is request readiness, not a promise of dates or successful payment. */
export function vehicleRequestState(hostStripeReady: boolean | undefined) {
  if (hostStripeReady === true) {
    return {
      ready: true,
      label: "Ready to request",
      action: "Request rental",
      explanation: "Send a request for host approval. Payment follows approval.",
    }
  }
  if (hostStripeReady === false) {
    return {
      ready: false,
      label: "Coming soon",
      action: "Coming soon",
      explanation: "This listing is not accepting rental requests yet.",
    }
  }
  return {
    ready: false,
    label: "Booking status unavailable",
    action: "Booking unavailable",
    explanation:
      "We cannot confirm whether this listing is accepting requests. Please try again later.",
  }
}
