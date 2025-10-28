import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

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

    const totalAmount = totalDays * vehicle.dailyRate;

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
    const conflictingReservations = await ctx.db
      .query('reservations')
      .withIndex('by_vehicle', q => q.eq('vehicleId', args.vehicleId))
      .filter(q =>
        q.and(
          q.or(
            q.eq(q.field('status'), 'pending'),
            q.eq(q.field('status'), 'confirmed')
          ),
          q.or(
            q.and(
              q.lte(q.field('startDate'), args.startDate),
              q.gte(q.field('endDate'), args.startDate)
            ),
            q.and(
              q.lte(q.field('startDate'), args.endDate),
              q.gte(q.field('endDate'), args.endDate)
            ),
            q.and(
              q.gte(q.field('startDate'), args.startDate),
              q.lte(q.field('endDate'), args.endDate)
            )
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
      createdAt: now,
      updatedAt: now,
    });

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
