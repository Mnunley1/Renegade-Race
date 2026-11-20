import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
}

export function PageHeader({
  title,
  description,
  actions,
  backLink,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  backLink?: { href: string; label: string }
}) {
  return (
    <header className="mb-6 space-y-4 sm:mb-8">
      {backLink && (
        <Link
          className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
          href={backLink.href}
        >
          <ArrowLeft className="size-4" />
          {backLink.label}
        </Link>
      )}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="break-words font-bold text-2xl tracking-tight sm:text-3xl">{title}</h1>
          {description && (
            <p className="break-words text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
