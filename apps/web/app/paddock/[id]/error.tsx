"use client"

import { Button } from "@workspace/ui/components/button"
import { PageHeader, PageShell } from "@/components/page-layout"

export default function DiscussionError({ reset }: { reset: () => void }) {
  return (
    <PageShell>
      <PageHeader
        backLink={{ href: "/paddock", label: "Paddock" }}
        title="Discussion unavailable"
      />
      <p className="mb-4 text-muted-foreground" role="alert">
        We couldn’t load this discussion. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </PageShell>
  )
}
