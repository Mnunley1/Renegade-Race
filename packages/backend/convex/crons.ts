import { cronJobs } from "convex/server"
import { api } from "./_generated/api"

const crons = cronJobs()

// Clean up approved reservations that weren't paid within 48 hours
// This cancels approved reservations without payment to free up availability
crons.interval(
  "cleanup expired approved reservations",
  { hours: 1 },
  api.reservations.cleanupExpiredApprovedReservations
)

// Clean up old webhook events every 24 hours
// Removes webhook events older than 7 days to prevent table bloat
// Webhook idempotency only needs to track recent events
crons.daily(
  "cleanup old webhook events",
  { hourUTC: 3, minuteUTC: 0 }, // Run at 3 AM UTC daily
  api.webhookIdempotency.cleanupOldWebhookEvents
)

export default crons
