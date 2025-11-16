# Checkout and Reservation Flow Setup

This document outlines the complete reservation flow with Stripe payment integration.

## Flow Overview

1. **Booking Form** (`/vehicles/[id]`)
   - User selects pickup/dropoff dates and times
   - Creates reservation via Convex API
   - Creates Stripe Payment Intent
   - Redirects to checkout page

2. **Checkout Page** (`/checkout`)
   - Displays reservation summary
   - Stripe Elements for secure payment
   - Processes payment with Stripe
   - Redirects to success page

3. **Success Page** (`/checkout/success`)
   - Displays confirmation
   - Shows reservation details

## Environment Variables Required

Add these to your `.env.local`:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Dependencies

The following packages have been added:
- `convex` - Convex client library
- `@stripe/stripe-js` - Stripe.js library
- `@stripe/react-stripe-js` - React Stripe.js components
- `@renegade/backend` - Backend workspace package

## Setup Steps

1. Install dependencies:
```bash
pnpm install
```

2. Set up Convex backend:
```bash
cd packages/backend
pnpm convex dev
```

3. Configure Convex URL:
   - Get your Convex deployment URL
   - Add to `.env.local` as `NEXT_PUBLIC_CONVEX_URL`

4. Set up Stripe:
   - Create Stripe account
   - Get publishable and secret keys
   - Set up webhook endpoint: `/api/stripe/webhook`
   - Add webhook secret to `.env.local`

5. Run the app:
```bash
cd apps/web
pnpm dev
```

## API Integration

### Convex API Functions Used

- `api.reservations.create` - Creates a reservation
- `api.reservations.getById` - Gets reservation details
- `api.stripe.createPaymentIntent` - Creates Stripe payment intent
- `api.stripe.confirmPayment` - Confirms payment status

### Stripe Integration

- Payment Intents API for secure payment processing
- Stripe Elements for payment form
- Webhook handlers for payment status updates

## Files Created/Modified

- `apps/web/package.json` - Added dependencies
- `apps/web/convex.json` - Convex configuration
- `apps/web/lib/convex.ts` - Convex API exports
- `apps/web/components/providers.tsx` - Added ConvexProvider
- `apps/web/components/booking-form.tsx` - Integrated with Convex
- `apps/web/app/checkout/page.tsx` - Checkout page with Stripe
- `apps/web/app/checkout/success/page.tsx` - Success page

## Testing

Use Stripe test mode with test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

## Notes

- The reservation is created before payment to reserve the dates
- Payment is required to confirm the reservation
- Webhook handles payment confirmation automatically
- Reservation status updates based on payment status

