import { formatDistanceToNow } from "date-fns"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"

export interface ActivityItem {
  id: string
  icon: LucideIcon
  iconColor?: string
  description: string
  timestamp: number
  href?: string
}

interface ActivityTimelineProps {
  items: ActivityItem[]
}

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <div className="flex gap-3" key={item.id}>
            <div className="relative flex flex-col items-center">
              <div className={`rounded-full p-1.5 ${item.iconColor ?? "bg-muted"}`}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {index < items.length - 1 && <div className="w-px flex-1 bg-border" />}
            </div>
            <div className="flex-1 pb-4">
              {item.href ? (
                <Link className="text-sm hover:underline" href={item.href}>
                  {item.description}
                </Link>
              ) : (
                <p className="text-sm">{item.description}</p>
              )}
              <p className="mt-0.5 text-muted-foreground text-xs">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
