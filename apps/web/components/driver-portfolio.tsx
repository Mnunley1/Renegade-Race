"use client"

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
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"

interface DriverPortfolioProps {
  driverProfileId: Id<"driverProfiles">
  isOwner: boolean
}

export function DriverPortfolio({ driverProfileId, isOwner }: DriverPortfolioProps) {
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
            <Dialog onOpenChange={setIsAddDialogOpen} open={isAddDialogOpen}>
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
                      onValueChange={(v) =>
                        setFormData({ ...formData, type: v as "image" | "video" })
                      }
                      value={formData.type}
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
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://..."
                      type="url"
                      value={formData.url}
                    />
                  </div>
                  <div>
                    <Label>Caption (optional)</Label>
                    <Input
                      onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                      placeholder="Describe this media"
                      value={formData.caption}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsAddDialogOpen(false)} variant="outline">
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
          <p className="py-4 text-center text-muted-foreground text-sm">No media yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {media.map((item) => (
              <div className="group relative aspect-square" key={item._id}>
                <button
                  className="size-full cursor-pointer overflow-hidden rounded-lg bg-muted text-left"
                  onClick={() => setSelectedMedia(item.url)}
                  type="button"
                >
                  {item.type === "image" ? (
                    <div className="relative size-full">
                      <Image
                        alt={item.caption || "Portfolio"}
                        className="object-cover"
                        fill
                        src={item.url}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <video className="size-full object-cover" muted playsInline src={item.url} />
                  )}
                </button>
                {isOwner && (
                  <Button
                    className="absolute top-1 right-1 size-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveMedia(item._id)
                    }}
                    size="icon"
                    variant="destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog onOpenChange={() => setSelectedMedia(null)} open={!!selectedMedia}>
        <DialogContent className="max-w-4xl">
          <Button
            className="absolute top-4 right-4"
            onClick={() => setSelectedMedia(null)}
            size="icon"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
          {selectedMedia && (
            <div className="mt-6">
              {selectedMedia.match(/\.(mp4|webm|ogg)$/i) ? (
                <video className="w-full rounded-lg" controls src={selectedMedia} />
              ) : (
                <div className="relative aspect-video w-full">
                  <Image
                    alt="Portfolio media"
                    className="rounded-lg object-contain"
                    fill
                    src={selectedMedia}
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
