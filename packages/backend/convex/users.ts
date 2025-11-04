import type { UserJSON } from '@clerk/backend';
import { type Validator, v } from 'convex/values';
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server';

export const current = query({
  args: {},
  handler: async ctx => await getCurrentUser(ctx),
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => await userByExternalId(ctx, args.externalId),
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userData = data as UserJSON; // Type assertion for Clerk data
    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert('users', {
        externalId: data.id,
        name:
          `${userData.first_name} ${userData.last_name}`.trim() ||
          'Unknown User',
      });
    } else {
      await ctx.db.patch(user._id, {
        name:
          `${userData.first_name} ${userData.last_name}`.trim() ||
          'Unknown User',
      });
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`
      );
    }
  },
});

export const updateProfileImage = mutation({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Get or create user
    let user = await userByExternalId(ctx, userId);
    if (!user) {
      // Create user if they don't exist
      const userData = {
        externalId: userId,
        name: identity.name || identity.email || 'Unknown User',
        email: identity.email,
      };
      const newUserId = await ctx.db.insert('users', userData);
      user = await ctx.db.get(newUserId);
    }

    if (!user) {
      throw new Error('Failed to create or retrieve user');
    }

    // Get the URL from the storage ID
    const profileImageUrl = await ctx.storage.getUrl(args.storageId);
    if (!profileImageUrl) {
      throw new Error('Failed to get image URL from storage');
    }

    await ctx.db.patch(user._id, {
      profileImage: profileImageUrl,
    });

    return user._id;
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Get or create user
    let user = await userByExternalId(ctx, userId);
    if (!user) {
      // Create user if they don't exist
      const userData = {
        externalId: userId,
        name: args.name || identity.name || identity.email || 'Unknown User',
        email: args.email || identity.email,
        phone: args.phone,
      };
      const newUserId = await ctx.db.insert('users', userData);
      user = await ctx.db.get(newUserId);
    }

    if (!user) {
      throw new Error('Failed to create or retrieve user');
    }

    await ctx.db.patch(user._id, {
      name: args.name,
      email: args.email,
      phone: args.phone,
    });

    return user._id;
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_external_id', q => q.eq('externalId', externalId))
    .unique();
}
