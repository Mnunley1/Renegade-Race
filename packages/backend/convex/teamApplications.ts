import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

export const apply = mutation({
  args: {
    teamId: v.id('teams'),
    message: v.string(),
    driverExperience: v.string(),
    preferredDates: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    const applicationId = await ctx.db.insert('teamApplications', {
      ...args,
      driverId: user.externalId,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return applicationId;
  },
});

export const updateStatus = mutation({
  args: {
    applicationId: v.id('teamApplications'),
    status: v.union(
      v.literal('accepted'),
      v.literal('declined'),
      v.literal('withdrawn')
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const application = await ctx.db.get(args.applicationId);

    if (!application) {
      throw new Error('Application not found');
    }

    // Only team owner can accept/decline, driver can withdraw
    if (args.status === 'withdrawn') {
      if (application.driverId !== user.externalId) {
        throw new Error('Not authorized to withdraw this application');
      }
    } else {
      const team = await ctx.db.get(application.teamId);
      if (!team || team.ownerId !== user.externalId) {
        throw new Error('Not authorized to update this application status');
      }
    }

    await ctx.db.patch(args.applicationId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.applicationId;
  },
});

export const getByTeam = query({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const team = await ctx.db.get(args.teamId);

    if (!team || team.ownerId !== user.externalId) {
      throw new Error('Not authorized to view applications for this team');
    }

    return await ctx.db
      .query('teamApplications')
      .withIndex('by_team', q => q.eq('teamId', args.teamId))
      .collect();
  },
});

export const getPublicByTeam = query({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    // Public function - no authentication required
    // Only returns basic application info for display purposes
    const applications = await ctx.db
      .query('teamApplications')
      .withIndex('by_team', q => q.eq('teamId', args.teamId))
      .collect();

    // Return only public information (no sensitive data)
    return applications.map(app => ({
      _id: app._id,
      status: app.status,
      message: app.message,
      createdAt: app.createdAt,
      // Don't expose driverId or other sensitive info
    }));
  },
});

export const getByDriver = query({
  args: {},
  handler: async ctx => {
    try {
      const user = await getCurrentUserOrThrow(ctx);
      return await ctx.db
        .query('teamApplications')
        .withIndex('by_driver', q => q.eq('driverId', user.externalId))
        .collect();
    } catch (error) {
      console.error('Error getting team applications by driver:', error);
      // Return empty array if no authenticated user
      return [];
    }
  },
});

export const getByStatus = query({
  args: {
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('declined'),
      v.literal('withdrawn')
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    return await ctx.db
      .query('teamApplications')
      .withIndex('by_status', q => q.eq('status', args.status))
      .filter(q =>
        q.or(
          q.eq(q.field('driverId'), user.externalId),
          q.eq(q.field('teamId'), user.externalId)
        )
      )
      .collect();
  },
});
