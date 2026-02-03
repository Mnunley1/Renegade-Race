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

export default crons
