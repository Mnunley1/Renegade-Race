import { v } from 'convex/values';
import { query } from './_generated/server';

// Get all active tracks
export const getAll = query({
  args: {},
  handler: async ctx => {
    const tracks = await ctx.db
      .query('tracks')
      .withIndex('by_active', q => q.eq('isActive', true))
      .order('asc')
      .collect();

    return tracks;
  },
});

// Get track by ID
export const getById = query({
  args: { id: v.id('tracks') },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.id);
    return track;
  },
});
