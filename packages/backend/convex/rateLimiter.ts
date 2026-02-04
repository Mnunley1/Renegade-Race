import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter"
import { components } from "./_generated/api"

/**
 * Rate limiter configuration for the application
 *
 * Rate limits are defined per operation type with different strategies:
 * - "fixed window": Tokens granted all at once, resets every period
 * - "token bucket": Tokens accumulate over time, allows burst up to capacity
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // ============================================
  // Critical Operations (Strict Limits)
  // ============================================

  // Reservation creation: 10 per hour per user (prevents spam bookings)
  createReservation: {
    kind: "token bucket",
    rate: 10,
    period: HOUR,
    capacity: 3, // Allow up to 3 quick bookings if user hasn't booked recently
  },

  // Payment operations: 20 per hour per user (payment intents, confirmations)
  processPayment: {
    kind: "token bucket",
    rate: 20,
    period: HOUR,
    capacity: 5,
  },

  // Dispute creation: 5 per day per user (prevents abuse)
  createDispute: {
    kind: "fixed window",
    rate: 5,
    period: 24 * HOUR,
    capacity: 2,
  },

  // ============================================
  // Communication Operations
  // ============================================

  // Message sending: 20 per minute per user (allows conversation flow)
  sendMessage: {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5, // Allow burst of 5 messages
  },

  // Email sending (contact forms, etc.): 5 per hour per user
  sendEmail: {
    kind: "token bucket",
    rate: 5,
    period: HOUR,
    capacity: 2,
  },

  // ============================================
  // Content Creation Operations
  // ============================================

  // Vehicle creation: 5 per hour per user (prevents spam listings)
  createVehicle: {
    kind: "token bucket",
    rate: 5,
    period: HOUR,
    capacity: 2,
  },

  // Vehicle updates: 30 per hour per user (allows editing)
  updateVehicle: {
    kind: "token bucket",
    rate: 30,
    period: HOUR,
    capacity: 10,
  },

  // Profile updates: 30 per hour per user
  updateProfile: {
    kind: "token bucket",
    rate: 30,
    period: HOUR,
    capacity: 10,
  },

  // Review creation: 10 per hour per user (prevents review spam)
  createReview: {
    kind: "token bucket",
    rate: 10,
    period: HOUR,
    capacity: 3,
  },

  // Report creation: 5 per hour per user (prevents abuse)
  createReport: {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  // ============================================
  // HTTP Webhook Endpoints (IP-based)
  // ============================================

  // Webhook endpoints: 100 per minute per IP (for Stripe, Clerk, Resend)
  webhookEndpoint: {
    kind: "fixed window",
    rate: 100,
    period: MINUTE,
    shards: 10, // Use sharding for high throughput
  },

  // ============================================
  // Authentication & Security
  // ============================================

  // Failed login attempts: 10 per hour per IP (prevents brute force)
  failedLoginAttempts: {
    kind: "token bucket",
    rate: 10,
    period: HOUR,
    capacity: 3,
  },

  // Password reset requests: 5 per hour per email
  passwordReset: {
    kind: "token bucket",
    rate: 5,
    period: HOUR,
    capacity: 2,
  },
})
