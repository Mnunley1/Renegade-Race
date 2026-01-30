"use client"

import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useMutation, useQuery } from "convex/react"
import { Image as ImageIcon, Plus, Trash2, X } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"

interface DriverPortfolioProps {
  driverProfileId: Id<"driverProfiles">
  isOwner: boolean
}

export function DriverPortfolio({
  driverProfileId,
  isOwner,
}: DriverPortfolioProps) {
  const media = useQuery(api.driverMedia.getByDriver, { driverProfileId })
  const addMedia = useMutation(api.driverMedia.add)
  const removeMedia = useMutation(api.driverMedia.remove)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    url: "",
    type: "image" as "image" | "video",
    caption: "",
  })

  const handleAddMedia = async () => {
    if (!formData.url) {
      toast.error("Please provide a URL")
      return
    }

    try {
      await addMedia({
        driverProfileId,
        url: formData.url,
        type: formData.type,
        caption: formData.caption || undefined,
      })
      toast.success("Media added")
      setIsAddDialogOpen(false)
      setFormData({ url: "", type: "image", caption: "" })
    } catch {
      toast.error("Failed to add media")
    }
  }

  const handleRemoveMedia = async (mediaId: Id<"driverMedia">) => {
    try {
      await removeMedia({ mediaId })
      toast.success("Media removed")
    } catch {
      toast.error("Failed to remove media")
    }
  }

  if (media === undefined) {
    return null
  }

  if (media.length === 0 && !isOwner) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            Portfolio
          </CardTitle>
          {isOwner && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 size-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Portfolio Media</DialogTitle>
                  <DialogDescription>
                    Add images or videos to showcase your driving
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) =>
                        setFormData({ ...formData, type: v as "image" | "video" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>URL</Label>
                    <Input
                      type="url"
                      value={formData.url}
                      onChange={(e) =>
                        setFormData({ ...formData, url: e.target.value })
                      }
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Caption (optional)</Label>
                    <Input
                      value={formData.caption}
                      onChange={(e) =>
                        setFormData({ ...formData, caption: e.target.value })
                      }
                      placeholder="Describe this media"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddMedia}>Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {media.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            No media yet
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {media.map((item) => (
              <div key={item._id} className="group relative aspect-square">
                <button
                  type="button"
                  className="size-full cursor-pointer overflow-hidden rounded-lg bg-muted text-left"
                  onClick={() => setSelectedMedia(item.url)}
                >
                  {item.type === "image" ? (
                    <div className="relative size-full">
                      <Image
                        src={item.url}
                        alt={item.caption || "Portfolio"}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <video
                      src={item.url}
                      className="size-full object-cover"
                      muted
                      playsInline
                    />
                  )}
                </button>
                {isOwner && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 size-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveMedia(item._id)
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4"
            onClick={() => setSelectedMedia(null)}
          >
            <X className="size-4" />
          </Button>
          {selectedMedia && (
            <div className="mt-6">
              {selectedMedia.match(/\.(mp4|webm|ogg)$/i) ? (
                <video src={selectedMedia} controls className="w-full rounded-lg" />
              ) : (
                <div className="relative aspect-video w-full">
                  <Image
                    src={selectedMedia}
                    alt="Portfolio media"
                    fill
                    className="rounded-lg object-contain"
                    unoptimized
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
