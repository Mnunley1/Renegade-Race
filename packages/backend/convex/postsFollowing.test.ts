// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import schema from "./schema"

vi.mock("./r2", () => ({ requirePublicMediaUpload: vi.fn() }))
const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")

async function setup() {
  const t = convexTest(schema, modules)
  const teamId = await t.run(async ({ db }) => {
    for (const externalId of ["me", "followed", "other", "owner", "active", "inactive"]) {
      await db.insert("users", { externalId, name: externalId })
    }
    const id = await db.insert("teams", {
      ownerId: "owner",
      name: "Followed Team",
      description: "Synthetic",
      location: "Test",
      specialties: [],
      availableSeats: 0,
      requirements: [],
      contactInfo: {},
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    })
    for (const status of ["active", "inactive"] as const) {
      await db.insert("teamMembers", {
        teamId: id,
        userId: status,
        role: "driver",
        status,
        joinedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      })
    }
    return id
  })
  const self = t.withIdentity({ subject: "me" })
  const post = (authorId: string, createdAt: number, fields: Partial<Doc<"posts">> = {}) =>
    t.run(({ db }) =>
      db.insert("posts", {
        authorId,
        content: `Post ${createdAt}`,
        createdAt,
        updatedAt: createdAt,
        ...fields,
      })
    )
  const activity = (
    actorId: string,
    createdAt: number,
    fields: Partial<Doc<"activityEvents">> = {}
  ) =>
    t.run(({ db }) =>
      db.insert("activityEvents", {
        actorId,
        type: "user_verified",
        visibility: "public",
        createdAt,
        ...fields,
      })
    )
  const following = (limit = 50) => self.query(api.posts.listFeed, { scope: "following", limit })
  return { t, self, teamId, post, activity, following }
}

describe("Following feed scope", () => {
  it("includes self, followed users and followed teams, without unrelated or private activities", async () => {
    const { self, teamId, post, activity, following } = await setup()
    await self.mutation(api.follows.followUser, { followedUserId: "followed" })
    await self.mutation(api.follows.followTeam, { teamId })
    const selfPost = await post("me", 1)
    const userPost = await post("followed", 2)
    const teamPost = await post("other", 3, { teamId })
    const selfActivity = await activity("me", 4)
    const userActivity = await activity("followed", 5)
    const teamActivity = await activity("other", 6, { targetType: "team", targetId: teamId })
    await post("other", 7)
    await activity("other", 8)
    await activity("followed", 9, { visibility: "followers" })
    await activity("other", 10, { targetType: "team", targetId: teamId, visibility: "followers" })
    await activity("followed", 11, { type: "post_created", targetType: "post", targetId: userPost })
    await activity("other", 12, { targetType: "user", targetId: teamId })
    await activity("other", 13, { metadata: { teamId } })
    expect((await following()).map((item) => item._id)).toEqual([
      teamActivity,
      userActivity,
      selfActivity,
      teamPost,
      userPost,
      selfPost,
    ])
  })

  it("finds older followed posts and activities despite hundreds of newer unrelated entries", async () => {
    const { t, self, teamId, post, activity, following } = await setup()
    await self.mutation(api.follows.followUser, { followedUserId: "followed" })
    await self.mutation(api.follows.followTeam, { teamId })
    const olderUser = await post("followed", 1)
    const olderTeam = await post("other", 2, { teamId })
    const olderActivity = await activity("followed", 3)
    const olderTeamActivity = await activity("other", 4, { targetType: "team", targetId: teamId })
    await t.run(async ({ db }) => {
      for (let i = 100; i < 400; i++) {
        await db.insert("posts", {
          authorId: "other",
          content: "Unrelated",
          createdAt: i,
          updatedAt: i,
        })
        await db.insert("activityEvents", {
          actorId: "other",
          type: "user_verified",
          visibility: "public",
          createdAt: i,
        })
      }
    })
    expect((await following(4)).map((item) => item._id)).toEqual([
      olderTeamActivity,
      olderActivity,
      olderTeam,
      olderUser,
    ])
  })

  it("deduplicates user/team matches and applies the final limit by created time", async () => {
    const { self, teamId, post, activity, following } = await setup()
    await self.mutation(api.follows.followUser, { followedUserId: "followed" })
    await self.mutation(api.follows.followTeam, { teamId })
    const newest = await post("followed", 30, { teamId })
    const middle = await activity("followed", 20, { targetType: "team", targetId: teamId })
    await post("followed", 10, { teamId })
    expect((await following(2)).map((item) => item._id)).toEqual([newest, middle])
  })

  it("filters deleted posts and excluded activity types before taking each source page", async () => {
    const { self, post, activity, following } = await setup()
    await self.mutation(api.follows.followUser, { followedUserId: "followed" })
    const visiblePost = await post("followed", 1)
    const visibleActivity = await activity("followed", 2)
    for (let i = 3; i < 25; i++) {
      await post("followed", i, { isDeleted: true })
      await activity("followed", i, { type: "post_created" })
      await activity("followed", i, { visibility: "followers" })
    }
    expect((await following(2)).map((item) => item._id)).toEqual([visibleActivity, visiblePost])
  })

  it("returns an empty anonymous Following feed while preserving public Global and For You", async () => {
    const { t, post, activity } = await setup()
    const publicPost = await post("other", 1)
    const publicActivity = await activity("other", 2)
    await activity("other", 3, { visibility: "followers" })
    expect(await t.query(api.posts.listFeed, { scope: "following" })).toEqual([])
    expect(
      (await t.query(api.posts.listFeed, { scope: "global" })).map((item) => item._id)
    ).toEqual([publicPost])
    expect(
      (await t.query(api.posts.listFeed, { scope: "for_you" })).map((item) => item._id)
    ).toEqual([publicActivity, publicPost])
  })
})

describe("Following and post permissions", () => {
  it("updates user and team follows idempotently and isolates each follower", async () => {
    const { t, self, teamId, post, following } = await setup()
    const own = await post("me", 1)
    const userPost = await post("followed", 2)
    const teamPost = await post("other", 3, { teamId })
    const userFollow = await self.mutation(api.follows.followUser, { followedUserId: "followed" })
    expect(await self.mutation(api.follows.followUser, { followedUserId: "followed" })).toBe(
      userFollow
    )
    const teamFollow = await self.mutation(api.follows.followTeam, { teamId })
    expect(await self.mutation(api.follows.followTeam, { teamId })).toBe(teamFollow)
    expect((await following()).map((item) => item._id)).toEqual([teamPost, userPost, own])
    const other = t.withIdentity({ subject: "other" })
    await other.mutation(api.follows.unfollowUser, { followedUserId: "followed" })
    await other.mutation(api.follows.unfollowTeam, { teamId })
    expect(await self.query(api.follows.isFollowingUser, { followedUserId: "followed" })).toBe(true)
    expect(await self.query(api.follows.isFollowingTeam, { teamId })).toBe(true)
    await self.mutation(api.follows.unfollowUser, { followedUserId: "followed" })
    await self.mutation(api.follows.unfollowTeam, { teamId })
    expect((await following()).map((item) => item._id)).toEqual([own])
    expect(await self.query(api.follows.isFollowingUser, { followedUserId: "followed" })).toBe(
      false
    )
    expect(await self.query(api.follows.isFollowingTeam, { teamId })).toBe(false)
    await expect(self.mutation(api.follows.followUser, { followedUserId: "me" })).rejects.toThrow(
      "Cannot follow yourself"
    )
  })

  it("rejects anonymous follow and post mutations", async () => {
    const { t, teamId } = await setup()
    for (const method of ["followUser", "unfollowUser"] as const) {
      await expect(
        t.mutation(api.follows[method], { followedUserId: "followed" })
      ).rejects.toThrow()
    }
    for (const method of ["followTeam", "unfollowTeam"] as const) {
      await expect(t.mutation(api.follows[method], { teamId })).rejects.toThrow()
    }
    await expect(
      t.mutation(api.posts.createPost, { content: "No authentication" })
    ).rejects.toThrow()
    expect(await t.run(({ db }) => db.query("follows").collect())).toEqual([])
  })

  it.each(["owner", "active"])("allows %s to post for the team", async (subject) => {
    const { t, teamId } = await setup()
    const id = await t
      .withIdentity({ subject })
      .mutation(api.posts.createPost, { teamId, content: "Team update" })
    expect(await t.run(({ db }) => db.get(id))).toMatchObject({ authorId: subject, teamId })
  })

  it.each([
    "inactive",
    "other",
  ])("rejects team posting by %s without changing the feed", async (subject) => {
    const { t, teamId } = await setup()
    await expect(
      t.withIdentity({ subject }).mutation(api.posts.createPost, { teamId, content: "Team update" })
    ).rejects.toThrow("Not authorized")
    expect(await t.run(({ db }) => db.query("posts").collect())).toEqual([])
    expect(await t.run(({ db }) => db.query("activityEvents").collect())).toEqual([])
  })

  it("keeps post and comment deletion limited to their authors", async () => {
    const { t, self, post } = await setup()
    const postId = await post("me", 1)
    const commentId = await self.mutation(api.posts.addComment, { postId, content: "Mine" })
    const other = t.withIdentity({ subject: "other", publicMetadata: { role: "admin" } })
    await expect(other.mutation(api.posts.deletePost, { postId })).rejects.toThrow("Not authorized")
    await expect(other.mutation(api.posts.deleteComment, { commentId })).rejects.toThrow(
      "Not authorized"
    )
    await expect(t.mutation(api.posts.deletePost, { postId })).rejects.toThrow()
    await expect(t.mutation(api.posts.deleteComment, { commentId })).rejects.toThrow()
    expect(await t.run(({ db }) => db.get(postId))).not.toMatchObject({ isDeleted: true })
    await self.mutation(api.posts.deleteComment, { commentId })
    await self.mutation(api.posts.deletePost, { postId })
    expect(await t.run(({ db }) => db.get(postId))).toMatchObject({ isDeleted: true })
  })
})
