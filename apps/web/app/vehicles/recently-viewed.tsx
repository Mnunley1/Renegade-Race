"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import Image from "next/image"
import Link from "next/link"
import { useRecentlyViewed } from "@/hooks/use-recently-viewed"
import { r2Url } from "@/lib/r2-url"

export function RecentlyViewed() {
  const { items } = useRecentlyViewed()

  if (items.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <h3 className="mb-3 font-semibold text-muted-foreground text-sm">Recently Viewed</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => {
          const src = item.imageKey ? r2Url(item.imageKey) : item.image
          return (
            <Link className="shrink-0" href={`/vehicles/${item.id}`} key={item.id}>
              <Card className="w-[180px] overflow-hidden transition-colors hover:border-primary/40">
                <div className="relative aspect-[4/3] bg-muted">
                  {src && (
                    <Image
                      alt={item.name}
                      className="object-cover"
                      fill
                      quality={70}
                      sizes="180px"
                      src={src}
                    />
                  )}
                </div>
                <CardContent className="p-2">
                  <p className="truncate font-medium text-xs">{item.name}</p>
                  <p className="text-muted-foreground text-xs">${item.pricePerDay}/day</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
