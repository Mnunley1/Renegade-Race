import type { Metadata } from "next"
import { PaddockDiscussion } from "@/components/paddock/paddock-discussion"

export const metadata: Metadata = { title: "Paddock discussion" }

export default async function PaddockDiscussionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PaddockDiscussion postId={id} />
}
