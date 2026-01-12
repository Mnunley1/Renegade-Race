import type { WebhookEvent } from '@clerk/backend';
import { httpRouter } from 'convex/server';
import Stripe from 'stripe';
import { Webhook } from 'svix';
import { api, internal, components } from './_generated/api';
import { httpAction } from './_generated/server';
import { resendComponent } from './emails';
import { registerRoutes } from '@convex-dev/stripe';

// Helper function to get Stripe instance
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

const http = httpRouter();

// Register Stripe component webhook routes with custom event handlers
registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
  events: {
    // Custom handler for payment_intent.succeeded
    'payment_intent.succeeded': async (ctx, event: Stripe.PaymentIntentSucceededEvent) => {
      const paymentIntent = event.data.object;
      
      // Find payment by Stripe payment intent ID
      const payment = await ctx.runQuery(api.stripe.findPaymentByStripeIntent, {
        stripePaymentIntentId: paymentIntent.id,
      });

      if (payment) {
        // Update your custom payment record
        await ctx.runMutation(api.stripe.handlePaymentSuccess, {
          paymentId: payment._id,
          stripeChargeId: paymentIntent.latest_charge as string,
        });
      }
    },

    // Custom handler for payment_intent.payment_failed
    'payment_intent.payment_failed': async (ctx, event: Stripe.PaymentIntentPaymentFailedEvent) => {
      const paymentIntent = event.data.object;
      
      const payment = await ctx.runQuery(api.stripe.findPaymentByStripeIntent, {
        stripePaymentIntentId: paymentIntent.id,
      });

      if (payment) {
        await ctx.runMutation(api.stripe.handlePaymentFailure, {
          paymentId: payment._id,
          failureReason: paymentIntent.last_payment_error?.message,
        });
      }
    },

    // Handle charge.dispute.created
    'charge.dispute.created': async (ctx, event: Stripe.ChargeDisputeCreatedEvent) => {
      const charge = event.data.object;
      const paymentIntentId = charge.payment_intent as string;
      
      if (paymentIntentId) {
        const payment = await ctx.runQuery(api.stripe.findPaymentByStripeIntent, {
          stripePaymentIntentId: paymentIntentId,
        });

        if (payment) {
          // You can add dispute handling logic here
        }
      }
    },

    // Handle checkout.session.completed
    'checkout.session.completed': async (ctx, event: Stripe.CheckoutSessionCompletedEvent) => {
      const session = event.data.object;
      const paymentIntentId = session.payment_intent as string;
      
      if (paymentIntentId) {
        const payment = await ctx.runQuery(api.stripe.findPaymentByStripeIntent, {
          stripePaymentIntentId: paymentIntentId,
        });

        if (payment) {
          // Payment success is already handled by payment_intent.succeeded
          // But we can add additional logic here if needed
        }
      }
    },

    // Handle account.updated - updates Stripe Connect account status
    'account.updated': async (ctx, event: Stripe.AccountUpdatedEvent) => {
      const account = event.data.object;
      
      // Only process Connect accounts (Express accounts)
      if (account.type !== 'express') {
        return;
      }

      // Find user by Stripe account ID
      const user = await ctx.runQuery(api.users.getByStripeAccountId, {
        stripeAccountId: account.id,
      });

      if (!user) {
        console.log(`No user found for Stripe account ${account.id}`);
        return;
      }

      // Determine account status based on Stripe account state
      let status: "pending" | "active" | "restricted" | "disabled";

      // Check if account is disabled
      if (account.details_submitted === false || !account.charges_enabled) {
        status = "pending";
      } else if (account.payouts_enabled === false) {
        // Account can accept charges but not payouts yet
        status = "pending";
      } else if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
        // Check for restrictions or holds
        const hasRestrictions = 
          (account.requirements?.currently_due && account.requirements.currently_due.length > 0) ||
          (account.requirements?.past_due && account.requirements.past_due.length > 0) ||
          (account.requirements?.eventually_due && account.requirements.eventually_due.length > 0) ||
          (account.requirements?.disabled_reason !== null && account.requirements?.disabled_reason !== undefined);

        if (hasRestrictions) {
          status = "restricted";
        } else {
          // Account is fully active with no holds or restrictions
          status = "active";
        }
      } else {
        status = "pending";
      }

      // Update the status in Convex
      await ctx.runMutation(internal.users.updateStripeAccountStatus, {
        stripeAccountId: account.id,
        status,
      });
    },
  },
});

// Add this route to your http router (after the Stripe route)
http.route({
  path: '/clerk-users-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response('Error occured', { status: 400 });
    }
    switch (event.type) {
      case 'user.created': // intentional fallthrough
      case 'user.updated':
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case 'user.deleted': {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        break;
      }
      default:
        // Ignored Clerk webhook event
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    'svix-id': req.headers.get('svix-id')!,
    'svix-timestamp': req.headers.get('svix-timestamp')!,
    'svix-signature': req.headers.get('svix-signature')!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error('Error verifying webhook event', error);
    return null;
  }
}

// Resend webhook for email status tracking
http.route({
  path: '/resend-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    return await resendComponent.handleResendEventWebhook(ctx, req);
  }),
});

export default http;
