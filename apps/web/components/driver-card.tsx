import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Award, MapPin, Star } from "lucide-react"
import Image from "next/image"
import type { ComponentProps } from "react"

interface DriverCardProps extends ComponentProps<"div"> {
  id: string
  name: string
  avatarUrl?: string
  location: string
  experience: "beginner" | "intermediate" | "advanced" | "professional"
  licenses: string[]
  preferredCategories: string[]
  bio: string
}

const MAX_VISIBLE_LICENSES = 3
const MAX_VISIBLE_CATEGORIES = 2

const experienceColors = {
  beginner: "bg-green-500/10 text-green-600 dark:text-green-400",
  intermediate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  advanced: "bg-purple-500/10 text-purple-600 dark:text-purple-600",
  professional: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
}

export function DriverCard({
  id,
  name,
  avatarUrl,
  location,
  experience,
  licenses,
  preferredCategories,
  bio,
  className,
  ...props
}: DriverCardProps) {
  const MAX_BIO_LENGTH = 100
  const truncatedBio = bio.length > MAX_BIO_LENGTH ? `${bio.substring(0, MAX_BIO_LENGTH)}...` : bio

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl",
        className
      )}
      {...props}
    >
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary/20">
              {avatarUrl ? (
                <Image alt={name} className="object-cover" fill src={avatarUrl} />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <span className="text-xl">👤</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
                {name}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="size-3" />
                <span>{location}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={experienceColors[experience]}>
              <Award className="mr-1 size-3" />
              {experience.charAt(0).toUpperCase() + experience.slice(1)}
            </Badge>
          </div>

          <p className="text-muted-foreground text-sm">{truncatedBio}</p>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {licenses.slice(0, MAX_VISIBLE_LICENSES).map((license) => (
                <Badge key={license} variant="outline">
                  {license}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {preferredCategories.slice(0, MAX_VISIBLE_CATEGORIES).map((category) => (
                <Badge key={category} variant="secondary">
                  <Star className="mr-1 size-3" />
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
