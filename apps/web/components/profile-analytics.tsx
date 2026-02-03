"use client"

import { api } from "@/lib/convex"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { Eye } from "lucide-react"

interface ProfileAnalyticsProps {
  profileId: string
  profileType: "driver" | "team"
}

export function ProfileAnalytics({ profileId, profileType }: ProfileAnalyticsProps) {
  const viewCount = useQuery(api.profileViews.getViewCount, {
    profileId,
    profileType,
  })

  if (viewCount === undefined) {
    return null
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Eye className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-bold text-2xl">{viewCount.toLocaleString()}</div>
            <div className="text-muted-foreground text-sm">Profile Views</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
