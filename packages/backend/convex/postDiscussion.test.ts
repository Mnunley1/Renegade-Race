// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { expect, it, vi } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

vi.mock("./r2", () => ({ requirePublicMediaUpload: vi.fn() }))
const modules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")

async function setup() {
  const t = convexTest(schema, modules)
  const postId = await t.run(async ({ db }) => {
    await db.insert("users", { externalId: "author", name: "Author" })
    await db.insert("users", { externalId: "other", name: "Other" })
    return await db.insert("posts", {
      authorId: "author",
      content: "Public post",
      createdAt: 1,
      updatedAt: 1,
      commentCount: 0,
    })
  })
  return {
    t,
    postId,
    author: t.withIdentity({ subject: "author" }),
    other: t.withIdentity({ subject: "other" }),
  }
}

it("allows guest reads, requires authentication to comment, and keeps feed/detail counts after idempotent deletion", async () => {
  const { t, postId, author, other } = await setup()
  expect((await t.query(api.posts.getPost, { postId }))?.content).toBe("Public post")
  await expect(t.mutation(api.posts.addComment, { postId, content: "Denied" })).rejects.toThrow()
  const commentId = await other.mutation(api.posts.addComment, { postId, content: " Reply " })
  expect((await t.query(api.posts.listComments, { postId }))[0]?.content).toBe("Reply")
  expect((await t.query(api.posts.getPost, { postId }))?.commentCount).toBe(1)
  const before = (await t.query(api.posts.listFeed, { scope: "global" }))[0]
  expect(before?._kind === "post" && before.commentCount).toBe(1)
  await expect(author.mutation(api.posts.deleteComment, { commentId })).rejects.toThrow(
    "Not authorized"
  )
  await other.mutation(api.posts.deleteComment, { commentId })
  await other.mutation(api.posts.deleteComment, { commentId })
  expect(await t.query(api.posts.listComments, { postId })).toEqual([])
  expect((await t.query(api.posts.getPost, { postId }))?.commentCount).toBe(0)
  const after = (await t.query(api.posts.listFeed, { scope: "global" }))[0]
  expect(after?._kind === "post" && after.commentCount).toBe(0)
})

it("hides deleted posts and their comments and rejects writes after deletion", async () => {
  const { t, postId, author, other } = await setup()
  await other.mutation(api.posts.addComment, { postId, content: "Before removal" })
  await author.mutation(api.posts.deletePost, { postId })
  expect(await t.query(api.posts.getPost, { postId })).toBeNull()
  expect(await t.query(api.posts.listComments, { postId })).toEqual([])
  await expect(other.mutation(api.posts.addComment, { postId, content: "Late" })).rejects.toThrow(
    "Post not found"
  )
})

it("rejects replies attached to another post or a deleted comment", async () => {
  const { t, postId, other } = await setup()
  const parentCommentId = await other.mutation(api.posts.addComment, { postId, content: "Parent" })
  const secondId = await t.run(({ db }) =>
    db.insert("posts", { authorId: "author", content: "Other post", createdAt: 2, updatedAt: 2 })
  )
  await expect(
    other.mutation(api.posts.addComment, {
      postId: secondId,
      content: "Wrong post",
      parentCommentId,
    })
  ).rejects.toThrow("Parent comment not found")
  await other.mutation(api.posts.deleteComment, { commentId: parentCommentId })
  await expect(
    other.mutation(api.posts.addComment, { postId, content: "Deleted parent", parentCommentId })
  ).rejects.toThrow("Parent comment not found")
})

it("treats malformed and missing post links as unavailable", async () => {
  const { t, postId } = await setup()
  expect(await t.query(api.posts.getPost, { postId: "bad-link" })).toBeNull()
  await t.run(({ db }) => db.delete(postId))
  expect(await t.query(api.posts.getPost, { postId })).toBeNull()
})
