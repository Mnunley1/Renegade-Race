import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get user's favorites
export const getUserFavorites = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_user', q => q.eq('userId', userId))
      .order('desc')
      .collect();

    // Get vehicle details for each favorite
    const favoritesWithVehicles = await Promise.all(
      favorites.map(async favorite => {
        const vehicle = await ctx.db.get(favorite.vehicleId);
        if (!vehicle) return null;

        const [images, owner, track] = await Promise.all([
          ctx.db
            .query('vehicleImages')
            .withIndex('by_vehicle', q => q.eq('vehicleId', vehicle._id))
            .order('asc')
            .collect(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', vehicle.ownerId)
            )
            .first(),
          ctx.db.get(vehicle.trackId),
        ]);

        return {
          ...favorite,
          vehicle: {
            ...vehicle,
            images,
            owner,
            track,
          },
        };
      })
    );

    return favoritesWithVehicles.filter(Boolean);
  },
});

// Check if a vehicle is favorited by the current user
export const isVehicleFavorited = query({
  args: { vehicleId: v.id('vehicles') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const userId = identity.subject;
    const favorite = await ctx.db
      .query('favorites')
      .withIndex('by_user_vehicle', q =>
        q.eq('userId', userId).eq('vehicleId', args.vehicleId)
      )
      .first();

    return !!favorite;
  },
});

// Add a vehicle to favorites
export const addToFavorites = mutation({
  args: { vehicleId: v.id('vehicles') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Check if already favorited
    const existingFavorite = await ctx.db
      .query('favorites')
      .withIndex('by_user_vehicle', q =>
        q.eq('userId', userId).eq('vehicleId', args.vehicleId)
      )
      .first();

    if (existingFavorite) {
      throw new Error('Vehicle is already in favorites');
    }

    // Verify vehicle exists and is active
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!(vehicle && vehicle.isActive)) {
      throw new Error('Vehicle not found or not available');
    }

    const favoriteId = await ctx.db.insert('favorites', {
      userId,
      vehicleId: args.vehicleId,
      createdAt: Date.now(),
    });

    return favoriteId;
  },
});

// Remove a vehicle from favorites
export const removeFromFavorites = mutation({
  args: { vehicleId: v.id('vehicles') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Find the favorite to remove
    const favorite = await ctx.db
      .query('favorites')
      .withIndex('by_user_vehicle', q =>
        q.eq('userId', userId).eq('vehicleId', args.vehicleId)
      )
      .first();

    if (!favorite) {
      throw new Error('Vehicle is not in favorites');
    }

    await ctx.db.delete(favorite._id);
    return favorite._id;
  },
});

// Toggle favorite status (add if not favorited, remove if favorited)
export const toggleFavorite = mutation({
  args: { vehicleId: v.id('vehicles') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Check if already favorited
    const existingFavorite = await ctx.db
      .query('favorites')
      .withIndex('by_user_vehicle', q =>
        q.eq('userId', userId).eq('vehicleId', args.vehicleId)
      )
      .first();

    if (existingFavorite) {
      // Remove from favorites
      await ctx.db.delete(existingFavorite._id);
      return { action: 'removed', favoriteId: existingFavorite._id };
    }
      // Add to favorites
      const favoriteId = await ctx.db.insert('favorites', {
        userId,
        vehicleId: args.vehicleId,
        createdAt: Date.now(),
      });
      return { action: 'added', favoriteId };
  },
});

// Get favorite count for a vehicle
export const getVehicleFavoriteCount = query({
  args: { vehicleId: v.id('vehicles') },
  handler: async (ctx, args) => {
    const favorites = await ctx.db
      .query('favorites')
      .withIndex('by_vehicle', q => q.eq('vehicleId', args.vehicleId))
      .collect();

    return favorites.length;
  },
});
