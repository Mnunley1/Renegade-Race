import { v } from 'convex/values';
import Stripe from 'stripe';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, mutation, query } from './_generated/server';

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

// Platform fee calculation
export const calculatePlatformFee = mutation({
  args: {
    amount: v.number(), // Amount in cents
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query('platformSettings')
      .withIndex('by_active', q => q.eq('isActive', true))
      .first();

    if (!settings) {
      // Default platform settings if none exist
      const platformFee = Math.round(args.amount * 0.05); // 5% default fee
      return {
        platformFee,
        ownerAmount: args.amount - platformFee,
      };
    }

    const feePercentage = settings.platformFeePercentage;
    const calculatedFee = Math.round((args.amount * feePercentage) / 100);

    const platformFee = Math.max(
      settings.minimumPlatformFee,
      Math.min(calculatedFee, settings.maximumPlatformFee || calculatedFee)
    );

    return {
      platformFee,
      ownerAmount: args.amount - platformFee,
    };
  },
});

// Initialize platform settings (run once)
export const initializePlatformSettings = mutation({
  args: {},
  handler: async ctx => {
    const existingSettings = await ctx.db
      .query('platformSettings')
      .withIndex('by_active', q => q.eq('isActive', true))
      .first();

    if (existingSettings) {
      return existingSettings._id;
    }

    const settingsId = await ctx.db.insert('platformSettings', {
      platformFeePercentage: 5, // 5% platform fee
      minimumPlatformFee: 100, // $1.00 minimum fee
      maximumPlatformFee: 5000, // $50.00 maximum fee
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return settingsId;
  },
});

// Create payment intent (action for Stripe API calls)
export const createPaymentIntent = action({
  args: {
    reservationId: v.id('reservations'),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const reservation = await ctx.runQuery(api.reservations.getById, {
      id: args.reservationId,
    });
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.renterId !== identity.subject) {
      throw new Error('Not authorized to create payment for this reservation');
    }

    if (reservation.status !== 'pending') {
      throw new Error('Reservation must be pending to create payment');
    }

    // Calculate platform fee
    const { platformFee, ownerAmount } = await ctx.runMutation(
      api.stripe.calculatePlatformFee,
      { amount: args.amount }
    );

    // Create Stripe Payment Intent
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: args.amount,
      currency: 'usd',
      metadata: {
        reservationId: args.reservationId,
        renterId: reservation.renterId,
        ownerId: reservation.ownerId,
        vehicleId: reservation.vehicleId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create payment record
    const paymentId = await ctx.runMutation(api.stripe.createPaymentRecord, {
      reservationId: args.reservationId,
      renterId: reservation.renterId,
      ownerId: reservation.ownerId,
      amount: args.amount,
      platformFee,
      ownerAmount,
      stripePaymentIntentId: paymentIntent.id,
      metadata: {
        vehicleId: reservation.vehicleId,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        totalDays: reservation.totalDays,
      },
    });

    return {
      paymentId,
      clientSecret: paymentIntent.client_secret,
    };
  },
});

// Helper mutation to create payment record
export const createPaymentRecord = mutation({
  args: {
    reservationId: v.id('reservations'),
    renterId: v.string(),
    ownerId: v.string(),
    amount: v.number(),
    platformFee: v.number(),
    ownerAmount: v.number(),
    stripePaymentIntentId: v.string(),
    metadata: v.object({
      vehicleId: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      totalDays: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Create payment record
    const paymentId = await ctx.db.insert('payments', {
      reservationId: args.reservationId,
      renterId: args.renterId,
      ownerId: args.ownerId,
      amount: args.amount,
      platformFee: args.platformFee,
      ownerAmount: args.ownerAmount,
      currency: 'usd',
      status: 'pending',
      stripePaymentIntentId: args.stripePaymentIntentId,
      metadata: args.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update reservation with payment info
    await ctx.db.patch(args.reservationId, {
      paymentId,
      paymentStatus: 'pending',
      updatedAt: Date.now(),
    });

    return paymentId;
  },
});

// Confirm payment (action for Stripe API calls)
export const confirmPayment = action({
  args: {
    paymentId: v.id('payments'),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.runQuery(api.stripe.getPaymentById, {
      paymentId: args.paymentId,
    });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (!payment.stripePaymentIntentId) {
      throw new Error('No Stripe payment intent found');
    }

    // Retrieve payment intent from Stripe
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(
      payment.stripePaymentIntentId
    );

    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      await ctx.runMutation(api.stripe.updatePaymentStatus, {
        paymentId: args.paymentId,
        status: 'succeeded',
        stripeChargeId: paymentIntent.latest_charge as string,
      });

      // Update reservation status
      await ctx.runMutation(api.stripe.updateReservationStatus, {
        reservationId: payment.reservationId,
        status: 'confirmed',
        paymentStatus: 'paid',
      });

      return { success: true };
    }
      // Update payment status based on Stripe status
      await ctx.runMutation(api.stripe.updatePaymentStatus, {
        paymentId: args.paymentId,
        status: paymentIntent.status as Stripe.PaymentIntent.Status,
        failureReason: paymentIntent.last_payment_error?.message,
      });

      return {
        success: false,
        error: paymentIntent.last_payment_error?.message,
      };
  },
});

// Helper mutation to update payment status
export const updatePaymentStatus = mutation({
  args: {
    paymentId: v.id('payments'),
    status: v.string(),
    stripeChargeId: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, {
      status: args.status as
        | 'pending'
        | 'cancelled'
        | 'failed'
        | 'refunded'
        | 'processing'
        | 'succeeded'
        | 'partially_refunded',
      stripeChargeId: args.stripeChargeId,
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    });
  },
});

// Helper mutation to update reservation status
export const updateReservationStatus = mutation({
  args: {
    reservationId: v.id('reservations'),
    status: v.string(),
    paymentStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reservationId, {
      status: args.status as
        | 'pending'
        | 'cancelled'
        | 'confirmed'
        | 'completed'
        | 'declined',
      paymentStatus: args.paymentStatus as
        | 'pending'
        | 'paid'
        | 'failed'
        | 'refunded',
      updatedAt: Date.now(),
    });
  },
});

// Process refund (action for Stripe API calls)
export const processRefund = action({
  args: {
    paymentId: v.id('payments'),
    amount: v.optional(v.number()), // Partial refund amount
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const payment = await ctx.runQuery(api.stripe.getPaymentById, {
      paymentId: args.paymentId,
    });
    if (!(payment && payment.stripeChargeId)) {
      throw new Error('Payment not found');
    }

    // Check authorization (owner or admin can refund)
    if (payment.ownerId !== identity.subject) {
      throw new Error('Not authorized to refund this payment');
    }

    const stripe = getStripe();
    const refundParams: Stripe.RefundCreateParams = {
      charge: payment.stripeChargeId,
    };
    if (args.amount) refundParams.amount = args.amount;
    if (args.reason) {
      refundParams.reason = args.reason as Stripe.RefundCreateParams.Reason;
    }
    const refund = await stripe.refunds.create(refundParams);

    await ctx.runMutation(api.stripe.updateRefundStatus, {
      paymentId: args.paymentId,
      status:
        args.amount && args.amount < payment.amount
          ? 'partially_refunded'
          : 'refunded',
      refundAmount: refund.amount,
      refundReason: args.reason,
    });

    // Update reservation status if fully refunded
    if (!args.amount || args.amount >= payment.amount) {
      await ctx.runMutation(api.stripe.updateReservationStatus, {
        reservationId: payment.reservationId,
        status: 'cancelled',
        paymentStatus: 'refunded',
      });
    }

    return refund;
  },
});

// Helper mutation to update refund status
export const updateRefundStatus = mutation({
  args: {
    paymentId: v.id('payments'),
    status: v.string(),
    refundAmount: v.optional(v.number()),
    refundReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, {
      status: args.status as
        | 'pending'
        | 'cancelled'
        | 'failed'
        | 'refunded'
        | 'partially_refunded',
      refundAmount: args.refundAmount,
      refundReason: args.refundReason,
      updatedAt: Date.now(),
    });
  },
});

// Get user payments
export const getUserPayments = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query('payments')
      .withIndex('by_renter', q => q.eq('renterId', args.userId))
      .order('desc')
      .collect();

    // Get related data for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async payment => {
        const [reservation, vehicle, owner] = await Promise.all([
          ctx.db.get(payment.reservationId),
          payment.metadata?.vehicleId
            ? ctx.db.get(payment.metadata.vehicleId as Id<'vehicles'>)
            : Promise.resolve(undefined),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', payment.ownerId)
            )
            .first(),
        ]);

        return {
          ...payment,
          reservation,
          vehicle,
          owner,
        };
      })
    );

    return paymentsWithDetails;
  },
});

// Get payment by ID
export const getPaymentById = query({
  args: {
    paymentId: v.id('payments'),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) return null;

    const [reservation, vehicle, renter, owner] = await Promise.all([
      ctx.db.get(payment.reservationId),
      payment.metadata?.vehicleId
        ? ctx.db.get(payment.metadata.vehicleId as Id<'vehicles'>)
        : null,
      ctx.db
        .query('users')
        .withIndex('by_external_id', q => q.eq('externalId', payment.renterId))
        .first(),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q => q.eq('externalId', payment.ownerId))
        .first(),
    ]);

    return {
      ...payment,
      reservation,
      vehicle,
      renter,
      owner,
    };
  },
});

// Webhook handler
export const handleWebhook = mutation({
  args: {
    eventType: v.string(),
    paymentIntentId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_stripe_payment_intent', q =>
        q.eq('stripePaymentIntentId', args.paymentIntentId)
      )
      .first();

    if (!payment) {
      console.log(
        'Payment not found for payment intent:',
        args.paymentIntentId
      );
      return { success: false, error: 'Payment not found' };
    }

    switch (args.eventType) {
      case 'payment_intent.succeeded':
        await ctx.db.patch(payment._id, {
          status: 'succeeded',
          stripeChargeId: args.data.latest_charge,
          updatedAt: Date.now(),
        });

        await ctx.db.patch(payment.reservationId, {
          status: 'confirmed',
          paymentStatus: 'paid',
          updatedAt: Date.now(),
        });
        break;

      case 'payment_intent.payment_failed':
        await ctx.db.patch(payment._id, {
          status: 'failed',
          failureReason: args.data.last_payment_error?.message,
          updatedAt: Date.now(),
        });
        break;

      case 'charge.dispute.created':
        // Handle disputes - could update payment status or create dispute record
        console.log('Dispute created for payment:', payment._id);
        break;
    }

    return { success: true };
  },
});
