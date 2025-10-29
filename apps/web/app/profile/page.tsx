"use client"

import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { Calendar, MapPin, Pencil, Shield, Star } from "lucide-react"
import { useState } from "react"

const DEFAULT_MEMBER_YEAR = 2024

export default function ProfilePage() {
  const { user } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState(
    "I'm passionate about motorsports and experienced driving on some of the world's most iconic tracks. When I'm not behind the wheel, I love sharing my knowledge with the racing community."
  )
  const [location, setLocation] = useState("Daytona Beach, FL")
  const [experience, setExperience] = useState("Advanced")

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = () => {
    // TODO: Connect to Convex to save profile changes
    // For now, just close the dialog
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const userInitials = user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U"
  const memberSince = user?.createdAt ? new Date(user.createdAt).getFullYear() : DEFAULT_MEMBER_YEAR

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-6">
        {/* Hero Section */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <Avatar className="size-28 shadow-lg ring-4 ring-background">
                <AvatarImage alt={user?.fullName || "User"} src={user?.imageUrl} />
                <AvatarFallback className="text-2xl">{userInitials.toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-bold text-3xl">{user?.fullName || "Guest User"}</h1>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-4" />
                      Member since {memberSince}
                    </p>
                  </div>
                  <Badge className="gap-1.5" variant="secondary">
                    <Shield className="size-3.5" />
                    Verified
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="gap-1.5" variant="outline">
                    <Star className="size-3.5 fill-yellow-500 text-yellow-500" />
                    Super Host
                  </Badge>
                  <Badge className="gap-1.5" variant="outline">
                    <Calendar className="size-3.5" />5 Trips Completed
                  </Badge>
                </div>

                <div className="pt-2">
                  <Button onClick={handleEdit} size="lg" variant="default">
                    <Pencil className="mr-2 size-4" />
                    Edit Profile
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">Trips</CardTitle>
              <Calendar className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">12</div>
              <p className="text-muted-foreground text-xs">Total completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">Rating</CardTitle>
              <Star className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">4.8</div>
              <p className="text-muted-foreground text-xs">Average from reviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">Favorites</CardTitle>
              <Star className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">5</div>
              <p className="text-muted-foreground text-xs">Saved vehicles</p>
            </CardContent>
          </Card>
        </div>

        {/* About Me Section */}
        <Card>
          <CardHeader>
            <CardTitle>About Me</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-muted-foreground text-sm">Bio</Label>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-muted-foreground leading-relaxed">
                  {bio || "No bio added yet. Click Edit Profile to add one!"}
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-muted-foreground text-sm">
                  <MapPin className="size-4" />
                  Location
                </Label>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-semibold">{location || "Not set"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-muted-foreground text-sm">Experience Level</Label>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-semibold">{experience}</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-muted-foreground text-sm">Interests</Label>
              <div className="flex flex-wrap gap-2">
                <Badge className="gap-1.5" variant="secondary">
                  <Star className="size-3.5" />
                  Track Racing
                </Badge>
                <Badge className="gap-1.5" variant="secondary">
                  <Calendar className="size-3.5" />
                  GT3 Cars
                </Badge>
                <Badge className="gap-1.5" variant="secondary">
                  <Shield className="size-3.5" />
                  Formula Racing
                </Badge>
                <Badge className="gap-1.5" variant="secondary">
                  Endurance
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog onOpenChange={handleCancel} open={isEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your profile information.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                className="min-h-24 resize-none"
                id="bio"
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                value={bio}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State or Country"
                value={location}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Experience Level</Label>
              <Select onValueChange={setExperience} value={experience}>
                <SelectTrigger id="experience">
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCancel} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
