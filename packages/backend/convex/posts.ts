import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation, type QueryCtx, query } from "./_generated/server"
import { logActivityEventInternal } from "./activity"
import { requirePublicMediaUpload } from "./r2"
import { publicDisplayName } from "./userProfile"
import { getCurrentUser, getCurrentUserOrThrow } from "./users"

const REACTION_TYPES = [
  v.literal("like"),
  v.literal("fire"),
  v.literal("checkered"),
  v.literal("clap"),
  v.literal("respect"),
] as const

const FEED_PAGE_SIZE = 50
const ONLINE_WINDOW_MS = 5 * 60 * 1000

// ============================================================
// Mutations
// ============================================================

export const createPost = mutation({
  args: {
    content: v.string(),
    teamId: v.optional(v.id("teams")),
    trackId: v.optional(v.id("tracks")),
    vehicleId: v.optional(v.id("vehicles")),
    mediaR2Keys: v.optional(v.array(v.string())),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"), v.literal("mixed"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const trimmed = args.content.trim()
    if (trimmed.length === 0) {
      throw new Error("Post content cannot be empty")
    }
    if (trimmed.length > 5_000) {
      throw new Error("Post content too long (max 5000 chars)")
    }

    // If posting on behalf of a team, verify ownership/membership.
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId)
      if (!team) throw new Error("Team not found")
      const isOwner = team.ownerId === user.externalId
      const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_user", (q) =>
          q.eq("teamId", args.teamId as Id<"teams">).eq("userId", user.externalId)
        )
        .first()
      if (!(isOwner || membership?.status === "active")) {
        throw new Error("Not authorized to post on behalf of this team")
      }
    }

    for (const key of new Set(args.mediaR2Keys ?? [])) {
      await requirePublicMediaUpload(ctx, user, key, "general")
    }

    const now = Date.now()
    const postId = await ctx.db.insert("posts", {
      authorId: user.externalId,
      teamId: args.teamId,
      content: trimmed,
      trackId: args.trackId,
      vehicleId: args.vehicleId,
      mediaR2Keys: args.mediaR2Keys,
      mediaType: args.mediaType,
      reactionCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    await logActivityEventInternal(ctx, {
      actorId: user.externalId,
      type: "post_created",
      targetType: "post",
      targetId: postId,
      visibility: "public",
    })

    return postId
  },
})

export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post) throw new Error("Post not found")
    if (post.authorId !== user.externalId) {
      throw new Error("Not authorized to delete this post")
    }
    await ctx.db.patch(args.postId, {
      isDeleted: true,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const toggleReaction = mutation({
  args: {
    postId: v.id("posts"),
    type: v.union(...REACTION_TYPES),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || post.isDeleted) throw new Error("Post not found")

    const existing = await ctx.db
      .query("postReactions")
      .withIndex("by_post_user", (q) => q.eq("postId", args.postId).eq("userId", user.externalId))
      .first()

    if (existing) {
      if (existing.type === args.type) {
        await ctx.db.delete(existing._id)
        await ctx.db.patch(args.postId, {
          reactionCount: Math.max(0, (post.reactionCount ?? 0) - 1),
        })
        return { reacted: false }
      }
      await ctx.db.patch(existing._id, { type: args.type })
      return { reacted: true }
    }

    await ctx.db.insert("postReactions", {
      postId: args.postId,
      userId: user.externalId,
      type: args.type,
      createdAt: Date.now(),
    })
    await ctx.db.patch(args.postId, {
      reactionCount: (post.reactionCount ?? 0) + 1,
    })
    return { reacted: true }
  },
})

export const addComment = mutation({
  args: {
    postId: v.id("posts"),
    content: v.string(),
    parentCommentId: v.optional(v.id("postComments")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const trimmed = args.content.trim()
    if (trimmed.length === 0) throw new Error("Comment cannot be empty")
    if (trimmed.length > 2_000) throw new Error("Comment too long (max 2000 chars)")

    const post = await ctx.db.get(args.postId)
    if (!post || post.isDeleted) throw new Error("Post not found")

    const commentId = await ctx.db.insert("postComments", {
      postId: args.postId,
      authorId: user.externalId,
      content: trimmed,
      parentCommentId: args.parentCommentId,
      createdAt: Date.now(),
    })
    await ctx.db.patch(args.postId, {
      commentCount: (post.commentCount ?? 0) + 1,
    })
    return commentId
  },
})

export const deleteComment = mutation({
  args: { commentId: v.id("postComments") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx)
    const comment = await ctx.db.get(args.commentId)
    if (!comment) throw new Error("Comment not found")
    if (comment.authorId !== user.externalId) {
      throw new Error("Not authorized to delete this comment")
    }
    await ctx.db.patch(args.commentId, { isDeleted: true })
  },
})

// ============================================================
// Queries
// ============================================================

export const getPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId)
    if (!post || post.isDeleted) return null
    return await enrichPost(ctx, post)
  },
})

export const listFeed = query({
  args: {
    scope: v.union(v.literal("for_you"), v.literal("following"), v.literal("global")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? FEED_PAGE_SIZE, 100)
    const me = await getCurrentUser(ctx)

    if (args.scope === "following") {
      return me ? await followingFeed(ctx, me.externalId, limit) : []
    }
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .take(limit)

    const enrichedPosts = await Promise.all(posts.map((p) => enrichPost(ctx, p)))

    if (args.scope === "global") {
      return enrichedPosts
    }

    // Preserve the public activity mix for For You.
    const activitiesRaw = await ctx.db
      .query("activityEvents")
      .withIndex("by_visibility_created", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(20)
    const activities = await Promise.all(
      activitiesRaw
        .filter((a) => a.type !== "post_created")
        .slice(0, 10)
        .map((a) => enrichActivity(ctx, a))
    )

    return [...enrichedPosts, ...activities]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  },
})

export const listOnlineNow = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 8, 50)
    const cutoff = Date.now() - ONLINE_WINDOW_MS
    const records = await ctx.db.query("presence").collect()
    const recent = records.filter((r) => r.updatedAt >= cutoff)
    const seen = new Set<string>()
    const result: {
      userId: string
      name: string
      profileImage?: string
      profileImageR2Key?: string
    }[] = []
    for (const r of recent) {
      if (seen.has(r.userId)) continue
      seen.add(r.userId)
      const user = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", r.userId))
        .first()
      if (!user) continue
      result.push({
        userId: user.externalId,
        name: publicDisplayName(user),
        profileImage: user.profileImage,
        profileImageR2Key: user.profileImageR2Key,
      })
      if (result.length >= limit) break
    }
    return result
  },
})

export const listComments = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("postComments")
      .withIndex("by_post_created", (q) => q.eq("postId", args.postId))
      .order("asc")
      .collect()
    const visible = comments.filter((c) => !c.isDeleted)
    return await Promise.all(
      visible.map(async (c) => ({
        ...c,
        author: await loadActor(ctx, c.authorId),
      }))
    )
  },
})

// ============================================================
// Helpers
// ============================================================

async function enrichPost(ctx: QueryCtx, post: Doc<"posts">) {
  const me = await getCurrentUser(ctx)
  const author = await loadActor(ctx, post.authorId)
  let userReaction: string | null = null
  if (me) {
    const r = await ctx.db
      .query("postReactions")
      .withIndex("by_post_user", (q) => q.eq("postId", post._id).eq("userId", me.externalId))
      .first()
    if (r) userReaction = r.type
  }
  return {
    _kind: "post" as const,
    ...post,
    author,
    userReaction,
  }
}

async function loadActor(ctx: QueryCtx, externalId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .first()
  if (!user) return null
  return {
    userId: user.externalId,
    name: publicDisplayName(user),
    profileImage: user.profileImage,
    profileImageR2Key: user.profileImageR2Key,
  }
}

async function enrichActivity(ctx: QueryCtx, activity: Doc<"activityEvents">) {
  return {
    _kind: "activity" as const,
    _id: activity._id,
    createdAt: activity.createdAt,
    type: activity.type,
    targetType: activity.targetType,
    targetId: activity.targetId,
    metadata: activity.metadata,
    actor: await loadActor(ctx, activity.actorId),
  }
}

function newestUnique<T extends { _id: string; createdAt: number }>(rows: T[], limit: number) {
  return [...new Map(rows.map((row) => [row._id, row])).values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

async function followingFeed(ctx: QueryCtx, followerId: string, limit: number) {
  const follows = await ctx.db
    .query("follows")
    .withIndex("by_follower", (q) => q.eq("followerId", followerId))
    .collect()
  const userIds = new Set<string>([followerId])
  const teamIds = new Set<Id<"teams">>()
  for (const f of follows) {
    if (f.followedUserId) userIds.add(f.followedUserId)
    if (f.followedTeamId) teamIds.add(f.followedTeamId)
  }
  // Each source contributes at most one page. Unrelated global traffic cannot
  // hide older followed content; duplicate user/team matches are merged below.
  const postGroups = await Promise.all([
    ...[...userIds].map((authorId) =>
      ctx.db
        .query("posts")
        .withIndex("by_author_created", (q) => q.eq("authorId", authorId))
        .order("desc")
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .take(limit)
    ),
    ...[...teamIds].map((teamId) =>
      ctx.db
        .query("posts")
        .withIndex("by_team_created", (q) => q.eq("teamId", teamId))
        .order("desc")
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .take(limit)
    ),
  ])
  const activityGroups = await Promise.all([
    ...[...userIds].map((actorId) =>
      ctx.db
        .query("activityEvents")
        .withIndex("by_actor_created", (q) => q.eq("actorId", actorId))
        .order("desc")
        .filter((q) =>
          q.and(q.eq(q.field("visibility"), "public"), q.neq(q.field("type"), "post_created"))
        )
        .take(10)
    ),
    ...[...teamIds].map((teamId) =>
      ctx.db
        .query("activityEvents")
        .withIndex("by_target_created", (q) => q.eq("targetType", "team").eq("targetId", teamId))
        .order("desc")
        .filter((q) =>
          q.and(q.eq(q.field("visibility"), "public"), q.neq(q.field("type"), "post_created"))
        )
        .take(10)
    ),
  ])
  const posts = newestUnique(postGroups.flat(), limit)
  const activities = newestUnique(activityGroups.flat(), 10)
  return [
    ...(await Promise.all(posts.map((post) => enrichPost(ctx, post)))),
    ...(await Promise.all(activities.map((activity) => enrichActivity(ctx, activity)))),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}
