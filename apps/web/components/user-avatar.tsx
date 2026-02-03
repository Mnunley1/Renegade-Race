import { cn } from "@workspace/ui/lib/utils"

export interface UserAvatarProps {
  name: string
  imageUrl?: string | null
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
}

function getColorFromName(name: string): string {
  // Simple hash function to derive a consistent color from a name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Use brand color as base, or generate from hash
  const colors = [
    "bg-[#EF1C25]", // Brand color
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
  ]

  return colors[Math.abs(hash) % colors.length] as string
}

export function UserAvatar({ name, imageUrl, size = "md", className }: UserAvatarProps) {
  const initial = name?.[0]?.toUpperCase() || "U"
  const bgColor = getColorFromName(name || "")

  if (imageUrl) {
    return (
      <img
        alt={`${name}'s avatar`}
        className={cn("rounded-full object-cover", sizeClasses[size], className)}
        src={imageUrl}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full font-medium text-white",
        sizeClasses[size],
        bgColor,
        className
      )}
    >
      {initial}
    </div>
  )
}
