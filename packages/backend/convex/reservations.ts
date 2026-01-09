import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { api } from './_generated/api';
import { mutation, query } from './_generated/server';
import {
  getReservationPendingOwnerEmailTemplate,
  getReservationConfirmedRenterEmailTemplate,
  getReservationDeclinedRenterEmailTemplate,
  getReservationCancelledEmailTemplate,
  getReservationCompletedEmailTemplate,
  sendTransactionalEmail,
} from './emails';

// Get reservations for a user (as renter or owner)
export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal('renter'), v.literal('owner')),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('confirmed'),
        v.literal('cancelled'),
        v.literal('completed'),
        v.literal('declined')
      )
    ),
  },
  handler: async (ctx, args) => {
    const { userId, role, status } = args;

    let reservationsQuery;
    if (role === 'renter') {
      reservationsQuery = ctx.db
        .query('reservations')
        .withIndex('by_renter', q => q.eq('renterId', userId));
    } else {
      reservationsQuery = ctx.db
        .query('reservations')
        .withIndex('by_owner', q => q.eq('ownerId', userId));
    }

    if (status) {
      reservationsQuery = reservationsQuery.filter(q =>
        q.eq(q.field('status'), status)
      );
    }

    const reservations = await reservationsQuery.order('desc').collect();

    // Get vehicle and user details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async reservation => {
        const [vehicle, renter, owner] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', reservation.renterId)
            )
            .first(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', reservation.ownerId)
            )
            .first(),
        ]);

        // Get vehicle images if vehicle exists
        let vehicleWithImages = vehicle;
        if (vehicle) {
          const images = await ctx.db
            .query('vehicleImages')
            .withIndex('by_vehicle', q =>
              q.eq('vehicleId', vehicle._id as Id<'vehicles'>)
            )
            .order('asc')
            .collect();

          vehicleWithImages = {
            ...vehicle,
            images,
          } as typeof vehicle & { images: typeof images };
        }

        return {
          ...reservation,
          vehicle: vehicleWithImages,
          renter,
          owner,
        };
      })
    );

    return reservationsWithDetails;
  },
});

// Get reservation by ID
export const getById = query({
  args: { id: v.id('reservations') },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.id);
    if (!reservation) return null;

    const [vehicle, renter, owner] = await Promise.all([
      ctx.db.get(reservation.vehicleId),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', reservation.renterId)
        )
        .first(),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', reservation.ownerId)
        )
        .first(),
    ]);

    // Get vehicle images if vehicle exists
    let vehicleWithImages = vehicle;
    if (vehicle) {
      const images = await ctx.db
        .query('vehicleImages')
        .withIndex('by_vehicle', q => q.eq('vehicleId', vehicle._id))
        .order('asc')
        .collect();

      vehicleWithImages = {
        ...vehicle,
        images,
      } as typeof vehicle & { images: typeof images };
    }

    return {
      ...reservation,
      vehicle: vehicleWithImages,
      renter,
      owner,
    };
  },
});

// Create a new reservation
export const create = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    startDate: v.string(),
    endDate: v.string(),
    pickupTime: v.optional(v.string()),
    dropoffTime: v.optional(v.string()),
    renterMessage: v.optional(v.string()),
    addOns: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const renterId = identity.subject;
    const now = Date.now();

    // Get vehicle details
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId === renterId) {
      throw new Error('Cannot book your own vehicle');
    }

    // Calculate total days and amount
    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (totalDays <= 0) {
      throw new Error('Invalid date range');
    }

    // Calculate base amount from daily rate
    let baseAmount = totalDays * vehicle.dailyRate;

    // Add add-ons to total amount
    let addOnsTotal = 0;
    if (args.addOns && args.addOns.length > 0) {
      addOnsTotal = args.addOns.reduce((sum, addOn) => sum + addOn.price, 0);
    }

    const totalAmount = baseAmount + addOnsTotal;

    // Check availability
    const availability = await ctx.db
      .query('availability')
      .withIndex('by_vehicle_date', q => q.eq('vehicleId', args.vehicleId))
      .filter(q =>
        q.and(
          q.gte(q.field('date'), args.startDate),
          q.lte(q.field('date'), args.endDate)
        )
      )
      .collect();

    const blockedDates = availability.filter(a => !a.isAvailable);
    if (blockedDates.length > 0) {
      throw new Error('Selected dates are not available');
    }

    // Check for conflicting reservations
    // Two date ranges overlap if: existingStart <= newEnd AND existingEnd >= newStart
    const conflictingReservations = await ctx.db
      .query('reservations')
      .withIndex('by_vehicle', q => q.eq('vehicleId', args.vehicleId))
      .filter(q =>
        q.and(
          // Only check active reservations (pending or confirmed)
          q.or(
            q.eq(q.field('status'), 'pending'),
            q.eq(q.field('status'), 'confirmed')
          ),
          // Check for date overlap: existing reservation overlaps if
          // existingStart <= newEnd AND existingEnd >= newStart
          q.and(
            q.lte(q.field('startDate'), args.endDate),
            q.gte(q.field('endDate'), args.startDate)
          )
        )
      )
      .collect();

    if (conflictingReservations.length > 0) {
      throw new Error('Selected dates conflict with existing reservations');
    }

    // Create the reservation
    const reservationId = await ctx.db.insert('reservations', {
      vehicleId: args.vehicleId,
      renterId,
      ownerId: vehicle.ownerId,
      startDate: args.startDate,
      endDate: args.endDate,
      pickupTime: args.pickupTime,
      dropoffTime: args.dropoffTime,
      totalDays,
      dailyRate: vehicle.dailyRate,
      totalAmount,
      status: 'pending',
      renterMessage: args.renterMessage,
      addOns: args.addOns,
      createdAt: now,
      updatedAt: now,
    });

    // Send email to owner about new reservation request
    try {
      const [owner, renter] = await Promise.all([
        ctx.db
          .query('users')
          .withIndex('by_external_id', q => q.eq('externalId', vehicle.ownerId))
          .first(),
        ctx.db
          .query('users')
          .withIndex('by_external_id', q => q.eq('externalId', renterId))
          .first(),
      ])

      const ownerEmail = owner?.email || (identity as any).email
      const renterName = renter?.name || identity.name || 'Guest'
      const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

      if (ownerEmail) {
        const webUrl = process.env.WEB_URL || 'https://renegaderentals.com'
        const template = getReservationPendingOwnerEmailTemplate({
          ownerName: owner?.name || 'Owner',
          renterName,
          vehicleName,
          startDate: args.startDate,
          endDate: args.endDate,
          totalAmount,
          renterMessage: args.renterMessage,
          reservationUrl: `${webUrl}/host/reservations`,
        })
        await sendTransactionalEmail(ctx, ownerEmail, template)
      }
    } catch (error) {
      console.error('Failed to send reservation created email:', error)
      // Don't fail the mutation if email fails
    }

    return reservationId;
  },
});

// Approve a reservation
export const approve = mutation({
  args: {
    reservationId: v.id('reservations'),
    ownerMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.ownerId !== identity.subject) {
      throw new Error('Not authorized to approve this reservation');
    }

    if (reservation.status !== 'pending') {
      throw new Error('Reservation is not pending');
    }

    await ctx.db.patch(args.reservationId, {
      status: 'confirmed',
      ownerMessage: args.ownerMessage,
      updatedAt: Date.now(),
    });

    // Send email to renter about confirmed reservation
    try {
      const [vehicle, renter] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', reservation.renterId)
          )
          .first(),
      ])

      if (vehicle && renter) {
        const renterEmail = renter.email
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

        if (renterEmail) {
          const webUrl = process.env.WEB_URL || 'https://renegaderentals.com'
          const template = getReservationConfirmedRenterEmailTemplate({
            renterName: renter.name || 'Guest',
            vehicleName,
            startDate: reservation.startDate,
            endDate: reservation.endDate,
            totalAmount: reservation.totalAmount,
            ownerMessage: args.ownerMessage,
            reservationUrl: `${webUrl}/trips`,
          })
          await sendTransactionalEmail(ctx, renterEmail, template)
        }
      }
    } catch (error) {
      console.error('Failed to send reservation confirmed email:', error)
      // Don't fail the mutation if email fails
    }

    return args.reservationId;
  },
});

// Decline a reservation
export const decline = mutation({
  args: {
    reservationId: v.id('reservations'),
    ownerMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.ownerId !== identity.subject) {
      throw new Error('Not authorized to decline this reservation');
    }

    if (reservation.status !== 'pending') {
      throw new Error('Reservation is not pending');
    }

    await ctx.db.patch(args.reservationId, {
      status: 'declined',
      ownerMessage: args.ownerMessage,
      updatedAt: Date.now(),
    });

    // Send email to renter about declined reservation
    try {
      const [vehicle, renter] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', reservation.renterId)
          )
          .first(),
      ])

      if (vehicle && renter) {
        const renterEmail = renter.email
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

        if (renterEmail) {
          const template = getReservationDeclinedRenterEmailTemplate({
            renterName: renter.name || 'Guest',
            vehicleName,
            ownerMessage: args.ownerMessage,
          })
          await sendTransactionalEmail(ctx, renterEmail, template)
        }
      }
    } catch (error) {
      console.error('Failed to send reservation declined email:', error)
      // Don't fail the mutation if email fails
    }

    return args.reservationId;
  },
});

// Cancel a reservation
export const cancel = mutation({
  args: {
    reservationId: v.id('reservations'),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (
      reservation.renterId !== identity.subject &&
      reservation.ownerId !== identity.subject
    ) {
      throw new Error('Not authorized to cancel this reservation');
    }

    if (
      reservation.status !== 'pending' &&
      reservation.status !== 'confirmed'
    ) {
      throw new Error('Reservation cannot be cancelled');
    }

    await ctx.db.patch(args.reservationId, {
      status: 'cancelled',
      cancellationReason: args.cancellationReason,
      updatedAt: Date.now(),
    });

    // Process automatic refund if payment exists and is paid
    if (reservation.paymentId) {
      try {
        const payment = await ctx.db.get(reservation.paymentId);
        if (payment && payment.status === 'succeeded' && payment.stripeChargeId) {
          // Schedule refund processing (use scheduler to call internal action)
          await ctx.scheduler.runAfter(0, api.stripe.processRefundOnCancellation, {
            paymentId: reservation.paymentId,
            reservationId: args.reservationId,
            reason: args.cancellationReason || 'Reservation cancelled',
          });
        }
      } catch (error) {
        console.error('Failed to initiate refund on cancellation:', error);
        // Don't fail the cancellation if refund initiation fails
        // The refund can be processed manually later
      }
    }

    // Send emails to both parties about cancelled reservation
    try {
      const [vehicle, renter, owner] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', reservation.renterId)
          )
          .first(),
        ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', reservation.ownerId)
          )
          .first(),
      ])

      if (vehicle) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const isRenter = reservation.renterId === identity.subject

        // Email to renter
        if (renter?.email) {
          const template = getReservationCancelledEmailTemplate({
            userName: renter.name || 'Guest',
            vehicleName,
            role: 'renter',
            cancellationReason: args.cancellationReason,
          })
          await sendTransactionalEmail(ctx, renter.email, template)
        }

        // Email to owner
        if (owner?.email) {
          const template = getReservationCancelledEmailTemplate({
            userName: owner.name || 'Owner',
            vehicleName,
            role: 'owner',
            cancellationReason: args.cancellationReason,
          })
          await sendTransactionalEmail(ctx, owner.email, template)
        }
      }
    } catch (error) {
      console.error('Failed to send reservation cancelled emails:', error)
      // Don't fail the mutation if email fails
    }

    return args.reservationId;
  },
});

// Complete a reservation
export const complete = mutation({
  args: {
    reservationId: v.id('reservations'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.ownerId !== identity.subject) {
      throw new Error('Not authorized to complete this reservation');
    }

    if (reservation.status !== 'confirmed') {
      throw new Error('Reservation is not confirmed');
    }

    await ctx.db.patch(args.reservationId, {
      status: 'completed',
      updatedAt: Date.now(),
    });

    // Send emails to both parties about completed reservation (prompt for review)
    try {
      const [vehicle, renter, owner] = await Promise.all([
        ctx.db.get(reservation.vehicleId),
        ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', reservation.renterId)
          )
          .first(),
        ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', reservation.ownerId)
          )
          .first(),
      ])

      if (vehicle) {
        const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        const webUrl = process.env.WEB_URL || 'https://renegaderentals.com'

        // Email to renter (prompt to review owner/vehicle)
        if (renter?.email) {
          const template = getReservationCompletedEmailTemplate({
            userName: renter.name || 'Guest',
            vehicleName,
            role: 'renter',
            reviewUrl: `${webUrl}/review/${reservation._id}`,
          })
          await sendTransactionalEmail(ctx, renter.email, template)
        }

        // Email to owner (prompt to review renter)
        if (owner?.email) {
          const template = getReservationCompletedEmailTemplate({
            userName: owner.name || 'Owner',
            vehicleName,
            role: 'owner',
            reviewUrl: `${webUrl}/review/${reservation._id}`,
          })
          await sendTransactionalEmail(ctx, owner.email, template)
        }
      }
    } catch (error) {
      console.error('Failed to send reservation completed emails:', error)
      // Don't fail the mutation if email fails
    }

    return args.reservationId;
  },
});

// Get pending reservations for an owner
export const getPendingForOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_owner_status', q =>
        q.eq('ownerId', args.ownerId).eq('status', 'pending')
      )
      .order('desc')
      .collect();

    // Get vehicle and renter details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async reservation => {
        const [vehicle, renter] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', reservation.renterId)
            )
            .first(),
        ]);

        return {
          ...reservation,
          vehicle,
          renter,
        };
      })
    );

    return reservationsWithDetails;
  },
});

// Get confirmed reservations for an owner
export const getConfirmedForOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_owner_status', q =>
        q.eq('ownerId', args.ownerId).eq('status', 'confirmed')
      )
      .order('desc')
      .collect();

    // Get vehicle and renter details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async reservation => {
        const [vehicle, renter] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', reservation.renterId)
            )
            .first(),
        ]);

        return {
          ...reservation,
          vehicle,
          renter,
        };
      })
    );

    return reservationsWithDetails;
  },
});

// Get upcoming reservations for a user
export const getUpcoming = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal('renter'), v.literal('owner')),
  },
  handler: async (ctx, args) => {
    const { userId, role } = args;
    const today = new Date().toISOString().split('T')[0];

    let reservationsQuery;
    if (role === 'renter') {
      reservationsQuery = ctx.db
        .query('reservations')
        .withIndex('by_renter_status', q =>
          q.eq('renterId', userId).eq('status', 'confirmed')
        );
    } else {
      reservationsQuery = ctx.db
        .query('reservations')
        .withIndex('by_owner_status', q =>
          q.eq('ownerId', userId).eq('status', 'confirmed')
        );
    }

    const reservations = await reservationsQuery
      .filter(q => q.gte(q.field('startDate'), today))
      .order('asc')
      .collect();

    // Get vehicle and user details
    const reservationsWithDetails = await Promise.all(
      reservations.map(async reservation => {
        const [vehicle, renter, owner] = await Promise.all([
          ctx.db.get(reservation.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', reservation.renterId)
            )
            .first(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', reservation.ownerId)
            )
            .first(),
        ]);

        return {
          ...reservation,
          vehicle,
          renter,
          owner,
        };
      })
    );

    return reservationsWithDetails;
  },
});

// Get completed reservation for a specific vehicle by a user (for review purposes)
export const getCompletedReservationForVehicle = query({
  args: {
    userId: v.string(),
    vehicleId: v.id('vehicles'),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db
      .query('reservations')
      .withIndex('by_renter_status', q =>
        q.eq('renterId', args.userId).eq('status', 'completed')
      )
      .filter(q => q.eq(q.field('vehicleId'), args.vehicleId))
      .order('desc')
      .first();

    if (!reservation) return null;

    // Get related data
    const [vehicle, renter, owner] = await Promise.all([
      ctx.db.get(reservation.vehicleId),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', reservation.renterId)
        )
        .first(),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', reservation.ownerId)
        )
        .first(),
    ]);

    return {
      ...reservation,
      vehicle,
      renter,
      owner,
    };
  },
});
