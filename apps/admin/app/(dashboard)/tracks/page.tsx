"use client"

import { useQuery, useMutation } from "convex/react"
import { useState } from "react"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Check,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"

export default function TracksPage() {
  const tracks = useQuery(api.tracks.getAllForAdmin)
  const createTrack = useMutation(api.tracks.create)
  const updateTrack = useMutation(api.tracks.update)
  const deleteTrack = useMutation(api.tracks.deleteTrack)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingTrack, setEditingTrack] = useState<Id<"tracks"> | null>(null)
  const [isDeleting, setIsDeleting] = useState<Id<"tracks"> | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    imageUrl: "",
    isActive: true,
  })

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      description: "",
      imageUrl: "",
      isActive: true,
    })
  }

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.location.trim()) {
      toast.error("Please fill in required fields")
      return
    }

    setIsProcessing(true)
    try {
      await createTrack({
        name: formData.name,
        location: formData.location,
        description: formData.description || undefined,
        imageUrl: formData.imageUrl || undefined,
        isActive: formData.isActive,
      })
      toast.success("Track created successfully")
      setIsCreateOpen(false)
      resetForm()
    } catch (error) {
      console.error("Failed to create track:", error)
      toast.error("An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleEdit = async () => {
    if (!editingTrack || !formData.name.trim() || !formData.location.trim()) {
      toast.error("Please fill in required fields")
      return
    }

    setIsProcessing(true)
    try {
      await updateTrack({
        id: editingTrack,
        name: formData.name,
        location: formData.location,
        description: formData.description || undefined,
        imageUrl: formData.imageUrl || undefined,
        isActive: formData.isActive,
      })
      toast.success("Track updated successfully")
      setIsEditOpen(false)
      setEditingTrack(null)
      resetForm()
    } catch (error) {
      console.error("Failed to update track:", error)
      toast.error("An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (trackId: Id<"tracks">) => {
    if (!confirm("Are you sure you want to delete this track? This action cannot be undone.")) {
      return
    }

    setIsDeleting(trackId)
    try {
      await deleteTrack({ id: trackId })
      toast.success("Track deleted successfully")
    } catch (error) {
      console.error("Failed to delete track:", error)
      toast.error("An error occurred")
    } finally {
      setIsDeleting(null)
    }
  }

  const openEditDialog = (track: any) => {
    setEditingTrack(track._id)
    setFormData({
      name: track.name,
      location: track.location,
      description: track.description || "",
      imageUrl: track.imageUrl || "",
      isActive: track.isActive,
    })
    setIsEditOpen(true)
  }

  if (tracks === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading tracks...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">Track Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage racing tracks
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 size-4" />
              Create Track
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Track</DialogTitle>
              <DialogDescription>
                Add a new racing track to the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Track name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="create-location">Location *</Label>
                <Input
                  id="create-location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="City, State"
                  required
                />
              </div>
              <div>
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Track description"
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="create-imageUrl">Image URL</Label>
                <Input
                  id="create-imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-active"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="create-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tracks</CardTitle>
          <CardDescription>
            {tracks?.length || 0} track(s) total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tracks && tracks.length > 0 ? (
            <div className="space-y-4">
              {tracks.map((track) => (
                <Card key={track._id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-5 text-primary" />
                          <h3 className="font-medium text-lg">{track.name}</h3>
                          {track.isActive ? (
                            <Badge variant="default">
                              <Check className="mr-1 size-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <X className="mr-1 size-3" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                          {track.location}
                        </p>
                        {track.description && (
                          <p className="text-muted-foreground mt-2 text-sm">
                            {track.description}
                          </p>
                        )}
                        {track.imageUrl && (
                          <img
                            src={track.imageUrl}
                            alt={track.name}
                            className="mt-3 h-32 w-48 rounded-lg object-cover"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(track)}
                        >
                          <Edit className="mr-2 size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(track._id)}
                          disabled={isDeleting === track._id}
                        >
                          {isDeleting === track._id ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <MapPin className="mx-auto mb-4 size-12 opacity-50" />
              <p>No tracks found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Track</DialogTitle>
            <DialogDescription>
              Update track information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Track name"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-location">Location *</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="City, State"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Track description"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="edit-imageUrl">Image URL</Label>
              <Input
                id="edit-imageUrl"
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData({ ...formData, imageUrl: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

