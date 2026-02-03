"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import Link from "next/link"
import { useRecentlyViewed } from "@/hooks/use-recently-viewed"

export function RecentlyViewed() {
  const { items } = useRecentlyViewed()

  if (items.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <h3 className="mb-3 font-semibold text-muted-foreground text-sm">Recently Viewed</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <Link className="shrink-0" href={`/vehicles/${item.id}`} key={item.id}>
            <Card className="w-[180px] overflow-hidden transition-colors hover:border-primary/40">
              <div className="aspect-[4/3] bg-muted">
                {item.image && (
                  <img alt={item.name} className="size-full object-cover" src={item.image} />
                )}
              </div>
              <CardContent className="p-2">
                <p className="truncate font-medium text-xs">{item.name}</p>
                <p className="text-muted-foreground text-xs">${item.pricePerDay}/day</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
