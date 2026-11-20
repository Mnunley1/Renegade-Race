import type { Metadata } from "next"
import { PaddockFeed } from "@/components/paddock/paddock-feed"
import { PageHeader, PageShell } from "@/components/page-layout"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Paddock",
  description:
    "The digital paddock — see what drivers, teams, and coaches are up to across the platform.",
}

export default function PaddockPage() {
  return (
    <PageShell>
      <PageHeader
        description="What drivers, teams, and coaches are up to right now."
        title="The Paddock"
      />
      <PaddockFeed />
    </PageShell>
  )
}
