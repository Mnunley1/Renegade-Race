"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import Link from "next/link"
import { Fragment, useState } from "react"
import { PublicAuthorLink } from "@/components/paddock/public-author-link"
import { PageHeader, PageShell } from "@/components/page-layout"
import { useAccountActivity, useAccountAuth } from "@/hooks/useAccountAuth"
import { api, type Id } from "@/lib/convex"

export function PaddockDiscussion({ postId }: { postId: string }) {
  // The key discards a draft and pending callbacks when navigating to another post.
  return <DiscussionContent key={postId} postId={postId as Id<"posts">} />
}

function DiscussionContent({ postId }: { postId: Id<"posts"> }) {
  const post = useQuery(api.posts.getPost, { postId })
  const comments = useQuery(api.posts.listComments, post ? { postId } : "skip")
  const auth = useAccountAuth()

  return (
    <PageShell>
      <PageHeader backLink={{ href: "/paddock", label: "Paddock" }} title="Paddock discussion" />
      {post === undefined ? (
        <output aria-label="Loading discussion">Loading discussion…</output>
      ) : post === null ? (
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold text-lg">Post unavailable</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              This post may have been removed or is no longer available.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <PublicAuthorLink author={post.author} />
              <p className="whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
              <p className="text-muted-foreground text-xs">
                {new Date(post.createdAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <section aria-label="Comments" className="space-y-4">
            <h2 className="font-semibold text-xl">Comments ({post.commentCount ?? 0})</h2>
            {comments === undefined ? (
              <output aria-label="Loading comments">Loading comments…</output>
            ) : comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li className="rounded-lg border p-4" key={comment._id}>
                    <PublicAuthorLink author={comment.author} />
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {comment.content}
                    </p>
                    <p className="mt-2 text-muted-foreground text-xs">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                    {auth.isReady && auth.user?.id === comment.authorId && (
                      <DeleteComment commentId={comment._id} key={auth.accountKey} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {auth.isReady ? (
              <Fragment key={auth.accountKey}>
                <CommentComposer postId={postId} />
              </Fragment>
            ) : auth.isLoading ? (
              <output>Connecting to your account…</output>
            ) : auth.isSignedIn ? (
              <p role="alert">
                Unable to connect to your account. Please refresh or sign in again.
              </p>
            ) : (
              <p className="text-sm">
                <Link
                  className="text-primary underline"
                  href={`/sign-in?redirect_url=${encodeURIComponent(`/paddock/${postId}`)}`}
                >
                  Sign in to comment
                </Link>
              </p>
            )}
          </section>
        </div>
      )}
    </PageShell>
  )
}

function CommentComposer({ postId }: { postId: Id<"posts"> }) {
  const [text, setText] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const active = useAccountActivity()
  const addComment = useMutation(api.posts.addComment)
  const submit = async () => {
    if (!text.trim() || pending) return
    setPending(true)
    setError(false)
    try {
      await addComment({ postId, content: text.trim() })
      if (active()) setText("")
    } catch {
      if (active()) setError(true)
    } finally {
      if (active()) setPending(false)
    }
  }
  return (
    <div className="space-y-3">
      <Textarea
        aria-label="Write a comment"
        disabled={pending}
        maxLength={2000}
        onChange={(event) => setText(event.target.value)}
        value={text}
      />
      {error && (
        <p className="text-destructive text-sm" role="alert">
          Your comment could not be shared. Your text is saved here; please try again.
        </p>
      )}
      <Button disabled={!text.trim() || pending} onClick={submit}>
        {pending ? "Posting…" : "Post comment"}
      </Button>
    </div>
  )
}

function DeleteComment({ commentId }: { commentId: Id<"postComments"> }) {
  const remove = useMutation(api.posts.deleteComment)
  const active = useAccountActivity()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  return (
    <div className="mt-2">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(false)
          try {
            await remove({ commentId })
          } catch {
            if (active()) setError(true)
          } finally {
            if (active()) setPending(false)
          }
        }}
        size="sm"
        variant="ghost"
      >
        {pending ? "Deleting…" : "Delete comment"}
      </Button>
      {error && <p role="alert">Couldn’t delete your comment. Please try again.</p>}
    </div>
  )
}
