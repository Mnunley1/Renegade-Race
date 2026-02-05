import { Resend as ResendComponent } from "@convex-dev/resend"
import { v } from "convex/values"
import { Resend } from "resend"
import { components, internal } from "./_generated/api"
import { type MutationCtx, mutation, query } from "./_generated/server"
import { checkAdmin } from "./admin"
import { rateLimiter } from "./rateLimiter"

// Initialize Resend client (legacy - for sendMassEmail)
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set")
  }
  return new Resend(apiKey)
}

// Initialize Convex Resend component
// testMode defaults to true for safety - set RESEND_TEST_MODE=false in production
export const resendComponent = new ResendComponent(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
})

// Helper function to get user email from Clerk identity or database
async function _getUserEmail(ctx: MutationCtx, userId: string): Promise<string | null> {
  // First try to get from database
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", userId))
    .first()

  if (user?.email) {
    return user.email
  }

  // If not in database, try to get from Clerk identity
  // Note: This requires the identity to be available in context
  // For webhook-triggered emails, we'll need to pass email explicitly
  return null
}

// Helper function to check if test mode is enabled
function isTestMode(): boolean {
  return process.env.RESEND_TEST_MODE !== "false"
}

// Helper function to get test domain
// Note: @convex-dev/resend library only accepts @resend.dev addresses in test mode
// Use @resend.dev for test mode, then configure Resend to forward to your custom domain
function _getTestDomain(): string {
  // Library requires @resend.dev in test mode - use that and forward to custom domain
  return "resend.dev"
}

// Helper function to log email failures to audit log
async function logEmailFailure(ctx: any, error: unknown, context: string) {
  try {
    await ctx.runMutation(internal.auditLog.create, {
      entityType: "user",
      action: "send_failed",
      metadata: { error: String(error), context },
    })
  } catch {
    // Don't fail the parent operation
  }
}

// Helper function to get from email address
// In test mode, uses Resend test address (library only accepts @resend.dev addresses)
function getFromEmail(): string {
  if (isTestMode()) {
    // Library requires @resend.dev addresses in test mode
    // Use delivered@resend.dev which simulates successful delivery
    return "delivered@resend.dev"
  }
  return process.env.RESEND_FROM_EMAIL || "Renegade Rentals <support@renegaderace.com>"
}

// Helper function to get support email
// In test mode, returns a Resend test address
export function getSupportEmail(): string {
  if (isTestMode()) {
    // Library requires @resend.dev addresses in test mode
    // Use delivered@resend.dev which simulates successful delivery
    // Configure Resend to forward this to your custom domain if needed
    return "delivered@resend.dev"
  }
  return process.env.SUPPORT_EMAIL || "support@renegaderace.com"
}

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

// Helper function to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Email template: Welcome email
export function getWelcomeEmailTemplate(userName: string): {
  subject: string
  html: string
  text: string
} {
  const subject = "Welcome to Renegade Race Rentals!"
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a;">Welcome to Renegade Race Rentals!</h1>
      </div>
      <p>Hi ${userName},</p>
      <p>Thank you for joining Renegade Race Rentals! We're excited to have you as part of our community of track car enthusiasts.</p>
      <p>Get started by:</p>
      <ul>
        <li>Browsing our selection of high-performance track cars</li>
        <li>Creating your driver or team profile</li>
        <li>Booking your first track day experience</li>
      </ul>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Happy racing!</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        The Renegade Race Rentals Team
      </p>
    </body>
    </html>
  `
  const text = `
Welcome to Renegade Race Rentals!

Hi ${userName},

Thank you for joining Renegade Race Rentals! We're excited to have you as part of our community of track car enthusiasts.

Get started by:
- Browsing our selection of high-performance track cars
- Creating your driver or team profile
- Booking your first track day experience

If you have any questions, feel free to reach out to our support team.

Happy racing!

Best regards,
The Renegade Race Rentals Team
  `.trim()

  return { subject, html, text }
}

// Email template: Reservation created (pending) - notify owner
export function getReservationPendingOwnerEmailTemplate(data: {
  ownerName: string
  renterName: string
  vehicleName: string
  startDate: string
  endDate: string
  totalAmount: number
  renterMessage?: string
  reservationUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `New Reservation Request: ${data.vehicleName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a;">New Reservation Request</h1>
      </div>
      <p>Hi ${data.ownerName},</p>
      <p>You have a new reservation request for your vehicle <strong>${data.vehicleName}</strong>.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Renter:</strong> ${data.renterName}</p>
        <p><strong>Dates:</strong> ${formatDate(data.startDate)} - ${formatDate(data.endDate)}</p>
        <p><strong>Total Amount:</strong> ${formatCurrency(data.totalAmount)}</p>
        ${data.renterMessage ? `<p><strong>Message from renter:</strong><br>${data.renterMessage}</p>` : ""}
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.reservationUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Reservation</a>
      </p>
      <p>Please review and respond to this request as soon as possible.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
New Reservation Request

Hi ${data.ownerName},

You have a new reservation request for your vehicle ${data.vehicleName}.

Renter: ${data.renterName}
Dates: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}
Total Amount: ${formatCurrency(data.totalAmount)}
${data.renterMessage ? `\nMessage from renter:\n${data.renterMessage}\n` : ""}

Review this reservation: ${data.reservationUrl}

Please review and respond to this request as soon as possible.

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Reservation confirmed - notify renter
export function getReservationConfirmedRenterEmailTemplate(data: {
  renterName: string
  vehicleName: string
  startDate: string
  endDate: string
  totalAmount: number
  ownerMessage?: string
  reservationUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `Reservation Confirmed: ${data.vehicleName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #28a745;">Reservation Confirmed!</h1>
      </div>
      <p>Hi ${data.renterName},</p>
      <p>Great news! Your reservation for <strong>${data.vehicleName}</strong> has been confirmed.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Vehicle:</strong> ${data.vehicleName}</p>
        <p><strong>Dates:</strong> ${formatDate(data.startDate)} - ${formatDate(data.endDate)}</p>
        <p><strong>Total Amount:</strong> ${formatCurrency(data.totalAmount)}</p>
        ${data.ownerMessage ? `<p><strong>Message from owner:</strong><br>${data.ownerMessage}</p>` : ""}
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.reservationUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Reservation</a>
      </p>
      <p>We're excited for your track day experience! If you have any questions, please don't hesitate to reach out.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
Reservation Confirmed!

Hi ${data.renterName},

Great news! Your reservation for ${data.vehicleName} has been confirmed.

Vehicle: ${data.vehicleName}
Dates: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}
Total Amount: ${formatCurrency(data.totalAmount)}
${data.ownerMessage ? `\nMessage from owner:\n${data.ownerMessage}\n` : ""}

View your reservation: ${data.reservationUrl}

We're excited for your track day experience! If you have any questions, please don't hesitate to reach out.

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Reservation declined - notify renter
export function getReservationDeclinedRenterEmailTemplate(data: {
  renterName: string
  vehicleName: string
  ownerMessage?: string
}): { subject: string; html: string; text: string } {
  const subject = `Reservation Declined: ${data.vehicleName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #dc3545;">Reservation Declined</h1>
      </div>
      <p>Hi ${data.renterName},</p>
      <p>Unfortunately, your reservation request for <strong>${data.vehicleName}</strong> has been declined by the owner.</p>
      ${data.ownerMessage ? `<div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;"><p><strong>Message from owner:</strong><br>${data.ownerMessage}</p></div>` : ""}
      <p>Don't worry - we have many other amazing vehicles available. Browse our selection to find your perfect track car!</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
Reservation Declined

Hi ${data.renterName},

Unfortunately, your reservation request for ${data.vehicleName} has been declined by the owner.
${data.ownerMessage ? `\nMessage from owner:\n${data.ownerMessage}\n` : ""}

Don't worry - we have many other amazing vehicles available. Browse our selection to find your perfect track car!

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Reservation cancelled - notify both parties
export function getReservationCancelledEmailTemplate(data: {
  userName: string
  vehicleName: string
  role: "renter" | "owner"
  cancellationReason?: string
}): { subject: string; html: string; text: string } {
  const subject = `Reservation Cancelled: ${data.vehicleName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #dc3545;">Reservation Cancelled</h1>
      </div>
      <p>Hi ${data.userName},</p>
      <p>The reservation for <strong>${data.vehicleName}</strong> has been cancelled${data.role === "renter" ? " by you" : " by the renter"}.</p>
      ${data.cancellationReason ? `<div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;"><p><strong>Reason:</strong><br>${data.cancellationReason}</p></div>` : ""}
      <p>If you have any questions or concerns, please contact our support team.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
Reservation Cancelled

Hi ${data.userName},

The reservation for ${data.vehicleName} has been cancelled${data.role === "renter" ? " by you" : " by the renter"}.
${data.cancellationReason ? `\nReason:\n${data.cancellationReason}\n` : ""}

If you have any questions or concerns, please contact our support team.

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Payment succeeded - receipt
export function getPaymentSucceededEmailTemplate(data: {
  renterName: string
  vehicleName: string
  totalAmount: number
  paymentDate: string
  reservationUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `Payment Receipt - ${formatCurrency(data.totalAmount)}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #28a745;">Payment Confirmed</h1>
      </div>
      <p>Hi ${data.renterName},</p>
      <p>Your payment has been successfully processed. Thank you for your reservation!</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Vehicle:</strong> ${data.vehicleName}</p>
        <p><strong>Amount Paid:</strong> ${formatCurrency(data.totalAmount)}</p>
        <p><strong>Payment Date:</strong> ${formatDate(data.paymentDate)}</p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.reservationUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Reservation</a>
      </p>
      <p>This email serves as your receipt. Please keep it for your records.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
Payment Confirmed

Hi ${data.renterName},

Your payment has been successfully processed. Thank you for your reservation!

Vehicle: ${data.vehicleName}
Amount Paid: ${formatCurrency(data.totalAmount)}
Payment Date: ${formatDate(data.paymentDate)}

View your reservation: ${data.reservationUrl}

This email serves as your receipt. Please keep it for your records.

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Payment failed
export function getPaymentFailedEmailTemplate(data: {
  renterName: string
  vehicleName: string
  totalAmount: number
  failureReason?: string
  reservationUrl: string
}): { subject: string; html: string; text: string } {
  const subject = "Payment Failed - Action Required"
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #dc3545;">Payment Failed</h1>
      </div>
      <p>Hi ${data.renterName},</p>
      <p>Unfortunately, your payment for the reservation of <strong>${data.vehicleName}</strong> could not be processed.</p>
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p><strong>Amount:</strong> ${formatCurrency(data.totalAmount)}</p>
        ${data.failureReason ? `<p><strong>Reason:</strong> ${data.failureReason}</p>` : ""}
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.reservationUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a>
      </p>
      <p>Please update your payment method to complete your reservation. If you continue to experience issues, please contact our support team.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
Payment Failed

Hi ${data.renterName},

Unfortunately, your payment for the reservation of ${data.vehicleName} could not be processed.

Amount: ${formatCurrency(data.totalAmount)}
${data.failureReason ? `Reason: ${data.failureReason}` : ""}

Update your payment method: ${data.reservationUrl}

Please update your payment method to complete your reservation. If you continue to experience issues, please contact our support team.

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Reservation completed - prompt for review
export function getReservationCompletedEmailTemplate(data: {
  userName: string
  vehicleName: string
  role: "renter" | "owner"
  reviewUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `How was your experience with ${data.vehicleName}?`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a;">Reservation Completed</h1>
      </div>
      <p>Hi ${data.userName},</p>
      <p>Your reservation for <strong>${data.vehicleName}</strong> has been marked as completed.</p>
      <p>We'd love to hear about your experience! Your feedback helps us improve and helps other members of our community.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.reviewUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Leave a Review</a>
      </p>
      <p>Thank you for being part of the Renegade Race Rentals community!</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
Reservation Completed

Hi ${data.userName},

Your reservation for ${data.vehicleName} has been marked as completed.

We'd love to hear about your experience! Your feedback helps us improve and helps other members of our community.

Leave a review: ${data.reviewUrl}

Thank you for being part of the Renegade Race Rentals community!

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: New review received
export function getNewReviewEmailTemplate(data: {
  reviewedName: string
  reviewerName: string
  vehicleName: string
  rating: number
  reviewUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `New Review: ${data.reviewerName} left you a ${data.rating}-star review`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a;">New Review Received</h1>
      </div>
      <p>Hi ${data.reviewedName},</p>
      <p><strong>${data.reviewerName}</strong> left you a ${data.rating}-star review for your rental of <strong>${data.vehicleName}</strong>.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.reviewUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Review</a>
      </p>
      <p>You can respond to this review from your dashboard.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
New Review Received

Hi ${data.reviewedName},

${data.reviewerName} left you a ${data.rating}-star review for your rental of ${data.vehicleName}.

View review: ${data.reviewUrl}

You can respond to this review from your dashboard.

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Review response
export function getReviewResponseEmailTemplate(data: {
  reviewerName: string
  reviewedName: string
  vehicleName: string
  reviewUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `${data.reviewedName} responded to your review`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a;">Review Response</h1>
      </div>
      <p>Hi ${data.reviewerName},</p>
      <p><strong>${data.reviewedName}</strong> has responded to your review for <strong>${data.vehicleName}</strong>.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.reviewUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Response</a>
      </p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
Review Response

Hi ${data.reviewerName},

${data.reviewedName} has responded to your review for ${data.vehicleName}.

View response: ${data.reviewUrl}

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Email template: Dispute created
export function getDisputeCreatedEmailTemplate(data: {
  userName: string
  vehicleName: string
  role: "renter" | "owner" | "admin"
  disputeUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `Dispute Created: ${data.vehicleName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #dc3545;">Dispute Created</h1>
      </div>
      <p>Hi ${data.userName},</p>
      <p>A dispute has been created for the rental of <strong>${data.vehicleName}</strong>.</p>
      ${data.role === "admin" ? "<p>As an administrator, please review and resolve this dispute as soon as possible.</p>" : "<p>Our support team will review this dispute and work to resolve it fairly. We will keep you updated on the status.</p>"}
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.disputeUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dispute</a>
      </p>
      <p>If you have any questions, please contact our support team.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals Support Team
      </p>
    </body>
    </html>
  `
  const text = `
Dispute Created

Hi ${data.userName},

A dispute has been created for the rental of ${data.vehicleName}.
${data.role === "admin" ? "\nAs an administrator, please review and resolve this dispute as soon as possible." : "\nOur support team will review this dispute and work to resolve it fairly. We will keep you updated on the status."}

View dispute: ${data.disputeUrl}

If you have any questions, please contact our support team.

Best regards,
Renegade Race Rentals Support Team
  `.trim()

  return { subject, html, text }
}

// Email template: Dispute resolved
export function getDisputeResolvedEmailTemplate(data: {
  userName: string
  vehicleName: string
  resolution: string
  disputeUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `Dispute Resolved: ${data.vehicleName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #28a745;">Dispute Resolved</h1>
      </div>
      <p>Hi ${data.userName},</p>
      <p>The dispute for the rental of <strong>${data.vehicleName}</strong> has been resolved.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Resolution:</strong></p>
        <p>${data.resolution}</p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.disputeUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Details</a>
      </p>
      <p>If you have any questions about this resolution, please contact our support team.</p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals Support Team
      </p>
    </body>
    </html>
  `
  const text = `
Dispute Resolved

Hi ${data.userName},

The dispute for the rental of ${data.vehicleName} has been resolved.

Resolution:
${data.resolution}

View details: ${data.disputeUrl}

If you have any questions about this resolution, please contact our support team.

Best regards,
Renegade Race Rentals Support Team
  `.trim()

  return { subject, html, text }
}

// Email template: Unread messages digest
export function getUnreadMessagesDigestEmailTemplate(data: {
  userName: string
  totalUnreadCount: number
  conversations: Array<{
    senderName: string
    vehicleName: string
    unreadCount: number
    lastMessagePreview: string
  }>
  messagesUrl: string
}): { subject: string; html: string; text: string } {
  const subject =
    data.totalUnreadCount === 1
      ? "You have 1 unread message"
      : `You have ${data.totalUnreadCount} unread messages`

  // Build conversation list HTML
  const conversationListHtml = data.conversations
    .map(
      (conv) => `
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
        <p style="margin: 0 0 5px 0;"><strong>${conv.senderName}</strong> about <strong>${conv.vehicleName}</strong></p>
        <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">${conv.unreadCount} unread message${conv.unreadCount > 1 ? "s" : ""}</p>
        <p style="margin: 0; color: #888; font-style: italic; font-size: 14px;">"${conv.lastMessagePreview.length > 100 ? `${conv.lastMessagePreview.substring(0, 100)}...` : conv.lastMessagePreview}"</p>
      </div>
    `
    )
    .join("")

  // Build conversation list text
  const conversationListText = data.conversations
    .map(
      (conv) =>
        `- ${conv.senderName} about ${conv.vehicleName} (${conv.unreadCount} unread)\n  "${conv.lastMessagePreview.length > 80 ? `${conv.lastMessagePreview.substring(0, 80)}...` : conv.lastMessagePreview}"`
    )
    .join("\n\n")

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a;">You Have Unread Messages</h1>
      </div>
      <p>Hi ${data.userName},</p>
      <p>You have <strong>${data.totalUnreadCount}</strong> unread message${data.totalUnreadCount > 1 ? "s" : ""} waiting for you:</p>
      <div style="margin: 20px 0;">
        ${conversationListHtml}
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.messagesUrl}" style="background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Messages</a>
      </p>
      <p style="margin-top: 30px;">
        Best regards,<br>
        Renegade Race Rentals
      </p>
    </body>
    </html>
  `
  const text = `
You Have Unread Messages

Hi ${data.userName},

You have ${data.totalUnreadCount} unread message${data.totalUnreadCount > 1 ? "s" : ""} waiting for you:

${conversationListText}

View your messages: ${data.messagesUrl}

Best regards,
Renegade Race Rentals
  `.trim()

  return { subject, html, text }
}

// Helper function to convert email to test address if in test mode
function getTestEmail(originalEmail: string): string {
  if (isTestMode()) {
    // Library requires @resend.dev addresses in test mode
    // Use delivered@resend.dev which simulates successful delivery
    // Configure Resend to forward this to your custom domain if needed
    return "delivered@resend.dev"
  }
  return originalEmail
}

// Helper function to send transactional email
export async function sendTransactionalEmail(
  ctx: MutationCtx,
  to: string,
  template: { subject: string; html: string; text: string }
): Promise<string | null> {
  try {
    // Convert to test address if in test mode
    const recipientEmail = getTestEmail(to)

    const emailId = await resendComponent.sendEmail(ctx, {
      from: getFromEmail(),
      to: [recipientEmail],
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
    return emailId
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logError } = require("./logger")
    logError(error, "Failed to send transactional email")

    // Log to audit log for admin visibility
    await logEmailFailure(ctx, error, `Transactional email to ${to}: ${template.subject}`)

    // Don't throw - email failures shouldn't break the main flow
    return null
  }
}

// Send mass email to users
export const sendMassEmail = mutation({
  args: {
    recipientType: v.union(
      v.literal("all"),
      v.literal("owners"),
      v.literal("renters"),
      v.literal("custom")
    ),
    customRecipients: v.optional(v.array(v.string())), // Array of email addresses
    subject: v.string(),
    htmlContent: v.string(),
    textContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkAdmin(ctx)

    const resend = getResendClient()

    // Get recipients based on type
    let recipients: string[] = []

    if (args.recipientType === "custom" && args.customRecipients) {
      recipients = args.customRecipients
    } else {
      // Fetch users from database
      const allUsers = await ctx.db.query("users").collect()

      if (args.recipientType === "all") {
        recipients = allUsers.map((user) => user.email).filter((email): email is string => !!email)
      } else if (args.recipientType === "owners") {
        // Get users who own vehicles
        const vehicles = await ctx.db.query("vehicles").collect()
        const ownerIds = new Set(vehicles.map((v) => v.ownerId))
        recipients = allUsers
          .filter((user) => ownerIds.has(user.externalId))
          .map((user) => user.email)
          .filter((email): email is string => !!email)
      } else if (args.recipientType === "renters") {
        // Get users who have made reservations
        const reservations = await ctx.db.query("reservations").collect()
        const renterIds = new Set(reservations.map((r) => r.renterId))
        recipients = allUsers
          .filter((user) => renterIds.has(user.externalId))
          .map((user) => user.email)
          .filter((email): email is string => !!email)
      }
    }

    if (recipients.length === 0) {
      throw new Error("No recipients found")
    }

    // Send emails using Resend
    // Resend supports batch sending, but we'll send individually for better error handling
    const results: Array<{ recipient: string; success: boolean; id: string | undefined }> = []
    const errors: Array<{ recipient: string; error: string }> = []

    for (const recipient of recipients) {
      try {
        // Convert to test address if in test mode
        const recipientEmail = isTestMode() ? getTestEmail(recipient) : recipient

        const result = await resend.emails.send({
          from: getFromEmail(), // Use getFromEmail() which handles test mode
          to: recipientEmail,
          subject: args.subject,
          html: args.htmlContent,
          text: args.textContent || args.htmlContent.replace(/<[^>]*>/g, ""), // Strip HTML for text version
        })

        results.push({ recipient, success: true, id: result.data?.id })
      } catch (error) {
        errors.push({
          recipient,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      success: true,
      totalRecipients: recipients.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    }
  },
})

// Get email sending history (stored in a simple log format)
// Note: For production, you might want to create a dedicated emails table
export const getEmailHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, _args) => {
    await checkAdmin(ctx)

    // This is a placeholder - in production you'd want to store email history in a table
    // For now, we'll return an empty array
    return []
  },
})

// Send contact form email to support inbox
// Public mutation - no authentication required
export const sendContactFormEmail = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Rate limit: 5 emails per hour per email address (prevents spam)
    await rateLimiter.limit(ctx, "sendEmail", {
      key: args.email.toLowerCase(),
      throws: true,
    })

    // Use getSupportEmail() which handles test mode automatically
    const supportEmail = getSupportEmail()
    const fromEmail = getFromEmail()
    // Convert replyTo to test address if in test mode
    const replyToEmail = getTestEmail(args.email)

    // Create HTML email content
    const htmlContent = `
      <h2>New Contact Form Submission</h2>
      <p><strong>From:</strong> ${args.name} (${args.email})</p>
      <p><strong>Subject:</strong> ${args.subject}</p>
      <hr>
      <p>${args.message.replace(/\n/g, "<br>")}</p>
    `

    // Create plain text version
    const textContent = `
New Contact Form Submission

From: ${args.name} (${args.email})
Subject: ${args.subject}

${args.message}
    `.trim()

    try {
      // Use the Convex Resend component for reliable email delivery
      const emailId = await resendComponent.sendEmail(ctx, {
        from: fromEmail,
        to: [supportEmail],
        replyTo: [replyToEmail], // Allow replying directly to the customer (converted to test address if needed)
        subject: `Contact Form: ${args.subject}`,
        html: htmlContent,
        text: textContent,
      })

      return {
        success: true,
        emailId,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to send email")
    }
  },
})
