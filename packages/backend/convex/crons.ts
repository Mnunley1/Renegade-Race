import { cronJobs } from "convex/server"
import { api } from "./_generated/api"

const crons = cronJobs()

// Clean up stale pending reservations every 5 minutes
// This cancels pending reservations without payment that are older than 15 minutes
// Prevents abandoned checkouts from permanently blocking vehicle availability
crons.interval(
  "cleanup stale pending reservations",
  { minutes: 5 },
  api.reservations.cleanupStalePendingReservations
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
