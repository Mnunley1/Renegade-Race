import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    logoUrl: v.optional(v.string()),
    location: v.string(),
    specialties: v.array(v.string()),
    availableSeats: v.number(),
    requirements: v.array(v.string()),
    contactInfo: v.object({
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      website: v.optional(v.string()),
    }),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        twitter: v.optional(v.string()),
        facebook: v.optional(v.string()),
        linkedin: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    const teamId = await ctx.db.insert('teams', {
      ...args,
      ownerId: user.externalId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update user type to include team
    await ctx.db.patch(user._id, {
      userType: user.userType === 'driver' ? 'both' : 'team',
    });

    return teamId;
  },
});

export const update = mutation({
  args: {
    teamId: v.id('teams'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    specialties: v.optional(v.array(v.string())),
    availableSeats: v.optional(v.number()),
    requirements: v.optional(v.array(v.string())),
    contactInfo: v.optional(
      v.object({
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        website: v.optional(v.string()),
      })
    ),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        twitter: v.optional(v.string()),
        facebook: v.optional(v.string()),
        linkedin: v.optional(v.string()),
      })
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const { teamId, ...updates } = args;

    const team = await ctx.db.get(teamId);
    if (!team || team.ownerId !== user.externalId) {
      throw new Error('Not authorized to update this team');
    }

    await ctx.db.patch(teamId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return teamId;
  },
});

export const list = query({
  args: {
    location: v.optional(v.string()),
    specialties: v.optional(v.array(v.string())),
    availableSeats: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let teamsQuery = ctx.db
      .query('teams')
      .withIndex('by_active', q => q.eq('isActive', true));

    if (args.location) {
      teamsQuery = teamsQuery.filter(q =>
        q.eq(q.field('location'), args.location)
      );
    }

    if (typeof args.availableSeats === 'number') {
      const seats = args.availableSeats; // Type guard narrows to number
      teamsQuery = teamsQuery.filter(q =>
        q.gte(q.field('availableSeats'), seats)
      );
    }

    const teams = await teamsQuery.collect();

    // Filter by specialties if specified
    if (args.specialties && args.specialties.length > 0) {
      return teams.filter(team =>
        args.specialties!.some(specialty =>
          team.specialties.includes(specialty)
        )
      );
    }

    return teams;
  },
});

export const getById = query({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => await ctx.db.get(args.teamId),
});

export const getByOwner = query({
  args: {},
  handler: async ctx => {
    const user = await getCurrentUserOrThrow(ctx);
    return await ctx.db
      .query('teams')
      .withIndex('by_owner', q => q.eq('ownerId', user.externalId))
      .collect();
  },
});

export const deleteTeam = mutation({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const team = await ctx.db.get(args.teamId);

    if (!team || team.ownerId !== user.externalId) {
      throw new Error('Not authorized to delete this team');
    }

    await ctx.db.delete(args.teamId);
    return true;
  },
});
