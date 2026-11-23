import Link from "next/link"

type PublicAuthor = { name: string; profileHref?: string } | null | undefined

export function PublicAuthorLink({ author }: { author: PublicAuthor }) {
  return author?.profileHref ? (
    <Link className="font-semibold text-sm hover:underline" href={author.profileHref}>
      {author.name}
    </Link>
  ) : (
    <span className="font-semibold text-sm">{author?.name ?? "Unavailable user"}</span>
  )
}
