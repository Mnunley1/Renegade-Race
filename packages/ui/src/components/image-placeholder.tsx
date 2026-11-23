import { ImageOff } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { cn } from "../lib/utils"

export function ImagePlaceholder({
  alt,
  className,
  style,
  children,
}: {
  alt: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <span
      aria-label={`${alt || "Image"} unavailable`}
      className={cn(
        "flex items-center justify-center overflow-hidden bg-muted text-muted-foreground",
        className
      )}
      role="img"
      style={style}
    >
      {children ?? <ImageOff aria-hidden="true" className="size-8 opacity-50" />}
    </span>
  )
}
