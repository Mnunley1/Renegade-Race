import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

export const create = mutation({
  args: {
    bio: v.string(),
    experience: v.union(
      v.literal('beginner'),
      v.literal('intermediate'),
      v.literal('advanced'),
      v.literal('professional')
    ),
    racingType: v.optional(
      v.union(
        v.literal('real-world'),
        v.literal('sim-racing'),
        v.literal('both')
      )
    ),
    simRacingPlatforms: v.optional(v.array(v.string())),
    simRacingRating: v.optional(v.string()),
    licenses: v.array(v.string()),
    preferredCategories: v.array(v.string()),
    availability: v.array(v.string()),
    location: v.string(),
    contactInfo: v.object({
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    const profileId = await ctx.db.insert('driverProfiles', {
      ...args,
      userId: user.externalId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update user type to include driver
    await ctx.db.patch(user._id, {
      userType: user.userType === 'team' ? 'both' : 'driver',
    });

    return profileId;
  },
});

export const update = mutation({
  args: {
    profileId: v.id('driverProfiles'),
    bio: v.optional(v.string()),
    experience: v.optional(
      v.union(
        v.literal('beginner'),
        v.literal('intermediate'),
        v.literal('advanced'),
        v.literal('professional')
      )
    ),
    racingType: v.optional(
      v.union(
        v.literal('real-world'),
        v.literal('sim-racing'),
        v.literal('both')
      )
    ),
    simRacingPlatforms: v.optional(v.array(v.string())),
    simRacingRating: v.optional(v.string()),
    licenses: v.optional(v.array(v.string())),
    preferredCategories: v.optional(v.array(v.string())),
    availability: v.optional(v.array(v.string())),
    location: v.optional(v.string()),
    contactInfo: v.optional(
      v.object({
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
      })
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { profileId, ...updates } = args;

    const profile = await ctx.db.get(profileId);
    if (!profile || profile.userId !== user.externalId) {
      throw new Error('Not authorized to update this profile');
    }

    await ctx.db.patch(profileId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return profileId;
  },
});

export const list = query({
  args: {
    location: v.optional(v.string()),
    experience: v.optional(
      v.union(
        v.literal('beginner'),
        v.literal('intermediate'),
        v.literal('advanced'),
        v.literal('professional')
      )
    ),
    racingType: v.optional(
      v.union(
        v.literal('real-world'),
        v.literal('sim-racing'),
        v.literal('both')
      )
    ),
    preferredCategories: v.optional(v.array(v.string())),
    availability: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    let profilesQuery = ctx.db
      .query('driverProfiles')
      .withIndex('by_active', q => q.eq('isActive', true));

    if (args.location) {
      profilesQuery = profilesQuery.filter(q =>
        q.eq(q.field('location'), args.location)
      );
    }

    if (args.experience) {
      profilesQuery = profilesQuery.filter(q =>
        q.eq(q.field('experience'), args.experience)
      );
    }

    if (args.racingType) {
      profilesQuery = profilesQuery.filter(q =>
        q.or(
          q.eq(q.field('racingType'), args.racingType),
          q.eq(q.field('racingType'), 'both')
        )
      );
    }

    const profiles = await profilesQuery.collect();

    // Filter by preferred categories if specified
    let filteredProfiles = profiles;
    if (args.preferredCategories && args.preferredCategories.length > 0) {
      filteredProfiles = profiles.filter(profile =>
        args.preferredCategories!.some(category =>
          profile.preferredCategories.includes(category)
        )
      );
    }

    // Filter by availability if specified
    if (args.availability && args.availability.length > 0) {
      filteredProfiles = filteredProfiles.filter(profile =>
        args.availability!.some(avail => profile.availability.includes(avail))
      );
    }

    // Fetch user data for each profile
    const profilesWithUsers = await Promise.all(
      filteredProfiles.map(async (profile) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_external_id', q => q.eq('externalId', profile.userId))
          .unique();
        
        return {
          ...profile,
          user: user ? {
            name: user.name,
            avatarUrl: user.profileImage,
          } : {
            // Fallback for profiles without user data
            name: 'Unknown Driver',
            avatarUrl: undefined,
          },
        };
      })
    );

    return profilesWithUsers;
  },
});

export const getById = query({
  args: { profileId: v.id('driverProfiles') },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      return null;
    }

    // Fetch user data for the profile
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', q => q.eq('externalId', profile.userId))
      .unique();
    
    return {
      ...profile,
      user: user ? {
        name: user.name,
        avatarUrl: user.profileImage,
      } : {
        name: 'Unknown Driver',
        avatarUrl: undefined,
      },
    };
  },
});

export const getByUser = query({
  args: {},
  handler: async ctx => {
    const user = await getCurrentUserOrThrow(ctx);
    return await ctx.db
      .query('driverProfiles')
      .withIndex('by_user', q => q.eq('userId', user.externalId))
      .collect();
  },
});

export const deleteProfile = mutation({
  args: { profileId: v.id('driverProfiles') },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const profile = await ctx.db.get(args.profileId);

    if (!profile || profile.userId !== user.externalId) {
      throw new Error('Not authorized to delete this profile');
    }

    await ctx.db.delete(args.profileId);
    return true;
  },
});
