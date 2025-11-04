import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get availability for a vehicle
export const getByVehicle = query({
  args: {
    vehicleId: v.id('vehicles'),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { vehicleId, startDate, endDate } = args;

    let availabilityQuery = ctx.db
      .query('availability')
      .withIndex('by_vehicle_date', q => q.eq('vehicleId', vehicleId));

    if (startDate && endDate) {
      availabilityQuery = availabilityQuery.filter(q =>
        q.and(
          q.gte(q.field('date'), startDate),
          q.lte(q.field('date'), endDate)
        )
      );
    }

    return await availabilityQuery.order('asc').collect();
  },
});

// Check if a date range is available
export const checkAvailability = query({
  args: {
    vehicleId: v.id('vehicles'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { vehicleId, startDate, endDate } = args;

    // Get all availability records for the date range
    const availability = await ctx.db
      .query('availability')
      .withIndex('by_vehicle_date', q => q.eq('vehicleId', vehicleId))
      .filter(q =>
        q.and(
          q.gte(q.field('date'), startDate),
          q.lte(q.field('date'), endDate)
        )
      )
      .collect();

    // Check if any date in the range is blocked
    const blockedDates = availability.filter(a => !a.isAvailable);

    // Get conflicting reservations
    const conflictingReservations = await ctx.db
      .query('reservations')
      .withIndex('by_vehicle', q => q.eq('vehicleId', vehicleId))
      .filter(q =>
        q.and(
          q.or(
            q.eq(q.field('status'), 'pending'),
            q.eq(q.field('status'), 'confirmed')
          ),
          q.or(
            q.and(
              q.lte(q.field('startDate'), startDate),
              q.gte(q.field('endDate'), startDate)
            ),
            q.and(
              q.lte(q.field('startDate'), endDate),
              q.gte(q.field('endDate'), endDate)
            ),
            q.and(
              q.gte(q.field('startDate'), startDate),
              q.lte(q.field('endDate'), endDate)
            )
          )
        )
      )
      .collect();

    return {
      isAvailable:
        blockedDates.length === 0 && conflictingReservations.length === 0,
      blockedDates,
      conflictingReservations,
    };
  },
});

// Block a single date
export const blockDate = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    date: v.string(),
    reason: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to modify this vehicle');
    }

    // Check if availability record already exists
    const existing = await ctx.db
      .query('availability')
      .withIndex('by_vehicle_date', q =>
        q.eq('vehicleId', args.vehicleId).eq('date', args.date)
      )
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        isAvailable: false,
        reason: args.reason,
        price: args.price,
      });
      return existing._id;
    }
      // Create new record
      return await ctx.db.insert('availability', {
        vehicleId: args.vehicleId,
        date: args.date,
        isAvailable: false,
        reason: args.reason,
        price: args.price,
        createdAt: Date.now(),
      });
  },
});

// Block a date range
export const blockDateRange = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to modify this vehicle');
    }

    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    const dates: string[] = [];

    // Generate all dates in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Block each date
    const results = await Promise.all(
      dates.map(date =>
        ctx.db.insert('availability', {
          vehicleId: args.vehicleId,
          date,
          isAvailable: false,
          reason: args.reason,
          price: args.price,
          createdAt: Date.now(),
        })
      )
    );

    return results;
  },
});

// Unblock a date
export const unblockDate = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to modify this vehicle');
    }

    const availability = await ctx.db
      .query('availability')
      .withIndex('by_vehicle_date', q =>
        q.eq('vehicleId', args.vehicleId).eq('date', args.date)
      )
      .first();

    if (availability) {
      await ctx.db.delete(availability._id);
    }

    return availability?._id;
  },
});

// Unblock a date range
export const unblockDateRange = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to modify this vehicle');
    }

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

    // Delete all availability records in the range
    await Promise.all(availability.map(a => ctx.db.delete(a._id)));

    return availability.map(a => a._id);
  },
});

// Set default availability (available by default)
export const setDefaultAvailability = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    startDate: v.string(),
    endDate: v.string(),
    isAvailable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to modify this vehicle');
    }

    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    const dates: string[] = [];

    // Generate all dates in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Set availability for each date
    const results = await Promise.all(
      dates.map(date =>
        ctx.db.insert('availability', {
          vehicleId: args.vehicleId,
          date,
          isAvailable: args.isAvailable,
          createdAt: Date.now(),
        })
      )
    );

    return results;
  },
});

// Get availability calendar data for a month
export const getCalendarData = query({
  args: {
    vehicleId: v.id('vehicles'),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const { vehicleId, year, month } = args;

    // Generate start and end dates for the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    // Get availability for the month
    const availability = await ctx.db
      .query('availability')
      .withIndex('by_vehicle_date', q => q.eq('vehicleId', vehicleId))
      .filter(q =>
        q.and(
          q.gte(q.field('date'), startDate),
          q.lte(q.field('date'), endDate)
        )
      )
      .collect();

    // Get reservations for the month
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_vehicle', q => q.eq('vehicleId', vehicleId))
      .filter(q =>
        q.and(
          q.or(
            q.eq(q.field('status'), 'pending'),
            q.eq(q.field('status'), 'confirmed')
          ),
          q.or(
            q.and(
              q.lte(q.field('startDate'), endDate),
              q.gte(q.field('endDate'), startDate)
            )
          )
        )
      )
      .collect();

    return {
      availability,
      reservations,
      startDate,
      endDate,
    };
  },
});
