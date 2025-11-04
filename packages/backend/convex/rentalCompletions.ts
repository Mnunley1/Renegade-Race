import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Create a new rental completion record
export const create = mutation({
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

    if (reservation.status !== 'confirmed') {
      throw new Error(
        'Reservation must be confirmed to start completion process'
      );
    }

    // Check if completion already exists
    const existingCompletion = await ctx.db
      .query('rentalCompletions')
      .withIndex('by_reservation', q =>
        q.eq('reservationId', args.reservationId)
      )
      .first();

    if (existingCompletion) {
      throw new Error('Rental completion already exists for this reservation');
    }

    const completionId = await ctx.db.insert('rentalCompletions', {
      reservationId: args.reservationId,
      vehicleId: reservation.vehicleId,
      renterId: reservation.renterId,
      ownerId: reservation.ownerId,
      status: 'pending_renter',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return completionId;
  },
});

// Submit renter's return form
export const submitRenterReturnForm = mutation({
  args: {
    completionId: v.id('rentalCompletions'),
    returnDate: v.string(),
    vehicleCondition: v.union(
      v.literal('excellent'),
      v.literal('good'),
      v.literal('fair'),
      v.literal('poor'),
      v.literal('damaged')
    ),
    fuelLevel: v.union(
      v.literal('full'),
      v.literal('3/4'),
      v.literal('1/2'),
      v.literal('1/4'),
      v.literal('empty')
    ),
    mileage: v.number(),
    notes: v.optional(v.string()),
    photos: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const completion = await ctx.db.get(args.completionId);
    if (!completion) {
      throw new Error('Rental completion not found');
    }

    if (completion.renterId !== identity.subject) {
      throw new Error('Not authorized to submit return form');
    }

    if (completion.status !== 'pending_renter') {
      throw new Error(
        'Return form already submitted or completion in wrong state'
      );
    }

    await ctx.db.patch(args.completionId, {
      status: 'pending_owner',
      renterReturnForm: {
        returnDate: args.returnDate,
        vehicleCondition: args.vehicleCondition,
        fuelLevel: args.fuelLevel,
        mileage: args.mileage,
        notes: args.notes,
        photos: args.photos,
        submittedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return args.completionId;
  },
});

// Submit owner's return review
export const submitOwnerReturnReview = mutation({
  args: {
    completionId: v.id('rentalCompletions'),
    vehicleReceived: v.boolean(),
    conditionMatches: v.boolean(),
    fuelLevelMatches: v.boolean(),
    mileageMatches: v.boolean(),
    damageReported: v.optional(v.string()),
    photos: v.array(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const completion = await ctx.db.get(args.completionId);
    if (!completion) {
      throw new Error('Rental completion not found');
    }

    if (completion.ownerId !== identity.subject) {
      throw new Error('Not authorized to submit return review');
    }

    if (completion.status !== 'pending_owner') {
      throw new Error(
        'Return review already submitted or completion in wrong state'
      );
    }

    await ctx.db.patch(args.completionId, {
      status: 'completed',
      ownerReturnReview: {
        vehicleReceived: args.vehicleReceived,
        conditionMatches: args.conditionMatches,
        fuelLevelMatches: args.fuelLevelMatches,
        mileageMatches: args.mileageMatches,
        damageReported: args.damageReported,
        photos: args.photos,
        notes: args.notes,
        submittedAt: Date.now(),
      },
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Mark the reservation as completed
    await ctx.db.patch(completion.reservationId, {
      status: 'completed',
      updatedAt: Date.now(),
    });

    return args.completionId;
  },
});

// Submit vehicle vitals
export const submitVehicleVitals = mutation({
  args: {
    completionId: v.id('rentalCompletions'),
    engineTemp: v.optional(v.number()),
    oilPressure: v.optional(v.number()),
    oilLevel: v.optional(
      v.union(
        v.literal('full'),
        v.literal('3/4'),
        v.literal('1/2'),
        v.literal('1/4'),
        v.literal('low')
      )
    ),
    coolantLevel: v.optional(
      v.union(
        v.literal('full'),
        v.literal('3/4'),
        v.literal('1/2'),
        v.literal('1/4'),
        v.literal('low')
      )
    ),
    tirePressure: v.optional(
      v.object({
        frontLeft: v.optional(v.number()),
        frontRight: v.optional(v.number()),
        rearLeft: v.optional(v.number()),
        rearRight: v.optional(v.number()),
      })
    ),
    tireCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('needs_replacement')
      )
    ),
    brakePadCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('needs_replacement')
      )
    ),
    brakeFluidLevel: v.optional(
      v.union(
        v.literal('full'),
        v.literal('3/4'),
        v.literal('1/2'),
        v.literal('1/4'),
        v.literal('low')
      )
    ),
    bodyCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('damaged')
      )
    ),
    interiorCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('damaged')
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const completion = await ctx.db.get(args.completionId);
    if (!completion) {
      throw new Error('Rental completion not found');
    }

    // Check if user is either renter or owner
    if (
      completion.renterId !== identity.subject &&
      completion.ownerId !== identity.subject
    ) {
      throw new Error('Not authorized to submit vehicle vitals');
    }

    const vitalsId = await ctx.db.insert('vehicleVitals', {
      rentalCompletionId: args.completionId,
      vehicleId: completion.vehicleId,
      engineTemp: args.engineTemp,
      oilPressure: args.oilPressure,
      oilLevel: args.oilLevel,
      coolantLevel: args.coolantLevel,
      tirePressure: args.tirePressure,
      tireCondition: args.tireCondition,
      brakePadCondition: args.brakePadCondition,
      brakeFluidLevel: args.brakeFluidLevel,
      bodyCondition: args.bodyCondition,
      interiorCondition: args.interiorCondition,
      notes: args.notes,
      submittedBy: identity.subject,
      submittedAt: Date.now(),
    });

    return vitalsId;
  },
});

// Submit a review
export const submitReview = mutation({
  args: {
    completionId: v.id('rentalCompletions'),
    rating: v.number(),
    communication: v.optional(v.number()),
    vehicleCondition: v.optional(v.number()),
    professionalism: v.optional(v.number()),
    overallExperience: v.optional(v.number()),
    title: v.string(),
    review: v.string(),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const completion = await ctx.db.get(args.completionId);
    if (!completion) {
      throw new Error('Rental completion not found');
    }

    // Check if user is either renter or owner
    if (
      completion.renterId !== identity.subject &&
      completion.ownerId !== identity.subject
    ) {
      throw new Error('Not authorized to submit review');
    }

    // Determine review type and reviewed ID
    const reviewType =
      completion.renterId === identity.subject
        ? 'renter_to_owner'
        : 'owner_to_renter';
    const reviewedId =
      completion.renterId === identity.subject
        ? completion.ownerId
        : completion.renterId;

    // Check if review already exists
    const existingReview = await ctx.db
      .query('rentalReviews')
      .withIndex('by_rental_completion', q =>
        q.eq('rentalCompletionId', args.completionId)
      )
      .filter(q => q.eq(q.field('reviewerId'), identity.subject))
      .first();

    if (existingReview) {
      throw new Error('Review already submitted for this rental');
    }

    const reviewId = await ctx.db.insert('rentalReviews', {
      rentalCompletionId: args.completionId,
      reservationId: completion.reservationId,
      vehicleId: completion.vehicleId,
      reviewerId: identity.subject,
      reviewedId,
      reviewType,
      rating: args.rating,
      communication: args.communication,
      vehicleCondition: args.vehicleCondition,
      professionalism: args.professionalism,
      overallExperience: args.overallExperience,
      title: args.title,
      review: args.review,
      photos: args.photos,
      isPublic: true,
      isModerated: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // TODO: Update the reviewed user's rating via scheduler
    // await ctx.scheduler.runAfter(0, api.reviews.updateUserRating, {
    //   userId: reviewedId,
    // });

    return reviewId;
  },
});

// Get rental completion by ID
export const getById = query({
  args: { id: v.id('rentalCompletions') },
  handler: async (ctx, args) => {
    const completion = await ctx.db.get(args.id);
    if (!completion) return null;

    // Get related data
    const [reservation, vehicle, renter, owner] = await Promise.all([
      ctx.db.get(completion.reservationId),
      ctx.db.get(completion.vehicleId),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', completion.renterId)
        )
        .first(),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', completion.ownerId)
        )
        .first(),
    ]);

    return {
      ...completion,
      reservation,
      vehicle,
      renter,
      owner,
    };
  },
});

// Get rental completions for a user
export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal('renter'), v.literal('owner')),
  },
  handler: async (ctx, args) => {
    const { userId, role } = args;

    let completionsQuery;
    if (role === 'renter') {
      completionsQuery = ctx.db
        .query('rentalCompletions')
        .withIndex('by_renter', q => q.eq('renterId', userId));
    } else {
      completionsQuery = ctx.db
        .query('rentalCompletions')
        .withIndex('by_owner', q => q.eq('ownerId', userId));
    }

    const completions = await completionsQuery.order('desc').collect();

    // Get related data for each completion
    const completionsWithDetails = await Promise.all(
      completions.map(async completion => {
        const [reservation, vehicle, renter, owner] = await Promise.all([
          ctx.db.get(completion.reservationId),
          ctx.db.get(completion.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', completion.renterId)
            )
            .first(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', completion.ownerId)
            )
            .first(),
        ]);

        return {
          ...completion,
          reservation,
          vehicle,
          renter,
          owner,
        };
      })
    );

    return completionsWithDetails;
  },
});

// Get pending completions for a user
export const getPendingCompletions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const completions = await ctx.db
      .query('rentalCompletions')
      .filter(q =>
        q.or(
          q.and(
            q.eq(q.field('renterId'), args.userId),
            q.eq(q.field('status'), 'pending_renter')
          ),
          q.and(
            q.eq(q.field('ownerId'), args.userId),
            q.eq(q.field('status'), 'pending_owner')
          )
        )
      )
      .order('desc')
      .collect();

    // Get related data
    const completionsWithDetails = await Promise.all(
      completions.map(async completion => {
        const [reservation, vehicle, renter, owner] = await Promise.all([
          ctx.db.get(completion.reservationId),
          ctx.db.get(completion.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', completion.renterId)
            )
            .first(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', completion.ownerId)
            )
            .first(),
        ]);

        return {
          ...completion,
          reservation,
          vehicle,
          renter,
          owner,
        };
      })
    );

    return completionsWithDetails;
  },
});
