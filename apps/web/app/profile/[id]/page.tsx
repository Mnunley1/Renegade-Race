"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { PageHeader, PageShell } from "@/components/page-layout"
import PublicImage from "@/components/public-image"
import { api } from "@/lib/convex"
import { r2Url } from "@/lib/r2-url"

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const profile = useQuery(api.users.getPublicProfile, { externalId: id })

  if (profile === undefined) {
    return (
      <PageShell>
        <PageHeader backLink={{ href: "/paddock", label: "Paddock" }} title="Profile" />
        <output className="text-muted-foreground">Loading profile…</output>
      </PageShell>
    )
  }

  if (!profile) {
    return (
      <PageShell>
        <PageHeader backLink={{ href: "/paddock", label: "Paddock" }} title="Profile unavailable" />
        <p className="text-muted-foreground">
          This member’s public profile is no longer available.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader backLink={{ href: "/paddock", label: "Paddock" }} title={profile.name} />
      <Card>
        <CardContent className="space-y-5 pt-6">
          <PublicImage
            alt={`${profile.name}'s profile`}
            className="rounded-full object-cover"
            fallback={<span className="text-2xl">{profile.name[0]?.toUpperCase() || "U"}</span>}
            height={80}
            src={r2Url(profile.profileImageR2Key) || profile.profileImage}
            width={80}
          />
          {profile.bio && <p className="whitespace-pre-wrap break-words">{profile.bio}</p>}
          {profile.location && <p className="text-muted-foreground">{profile.location}</p>}
          {profile.memberSince && (
            <p className="text-muted-foreground text-sm">Member since {profile.memberSince}</p>
          )}
          {profile.driverProfileId && (
            <Button asChild variant="outline">
              <Link href={`/motorsports/drivers/${profile.driverProfileId}`}>
                View driver profile
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
