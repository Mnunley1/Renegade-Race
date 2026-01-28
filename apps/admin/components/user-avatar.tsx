import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"

interface UserAvatarProps {
  name?: string | null
  email?: string | null
  role?: string
  size?: "sm" | "md" | "lg"
  showInfo?: boolean
}

export function UserAvatar({ name, email, role, size = "md", showInfo = true }: UserAvatarProps) {
  const initials = name
    ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : email?.[0]?.toUpperCase() ?? "?"

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className={sizeClasses[size]}>
        <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
      </Avatar>
      {showInfo && (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{name ?? "Unknown"}</p>
            {role && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{role}</Badge>}
          </div>
          {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
        </div>
      )}
    </div>
  )
}
