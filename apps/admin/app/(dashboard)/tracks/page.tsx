"use client"

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
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { Edit, ImageIcon, Loader2, MapPin, MoreHorizontal, Plus, Power, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { type Column, DataTable } from "@/components/data-table/data-table"
import { exportToCSV } from "@/components/data-table/data-table-export"
import { DataTableToolbar, type FilterConfig } from "@/components/data-table/data-table-toolbar"
import { LoadingState } from "@/components/loading-state"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

interface TrackFormData {
  name: string
  location: string
  description: string
  imageUrl: string
  isActive: boolean
}

const EMPTY_FORM: TrackFormData = {
  name: "",
  location: "",
  description: "",
  imageUrl: "",
  isActive: true,
}

function TrackImage({ src, alt }: { src?: string; alt: string }) {
  if (src) {
    return <img alt={alt} className="h-10 w-16 rounded-md object-cover" src={src} />
  }

  return (
    <div className="flex h-10 w-16 items-center justify-center rounded-md bg-muted">
      <ImageIcon className="size-4 text-muted-foreground" />
    </div>
  )
}

function TrackFormFields({
  formData,
  onChange,
  idPrefix,
}: {
  formData: TrackFormData
  onChange: (data: TrackFormData) => void
  idPrefix: string
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name *</Label>
        <Input
          id={`${idPrefix}-name`}
          onChange={(e) => onChange({ ...formData, name: e.target.value })}
          placeholder="Thunderhill Raceway Park"
          value={formData.name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-location`}>Location *</Label>
        <Input
          id={`${idPrefix}-location`}
          onChange={(e) => onChange({ ...formData, location: e.target.value })}
          placeholder="Willows, CA"
          value={formData.location}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          onChange={(e) => onChange({ ...formData, description: e.target.value })}
          placeholder="A brief description of the track..."
          rows={3}
          value={formData.description}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-imageUrl`}>Image URL</Label>
        <Input
          id={`${idPrefix}-imageUrl`}
          onChange={(e) => onChange({ ...formData, imageUrl: e.target.value })}
          placeholder="https://example.com/track-image.jpg"
          type="url"
          value={formData.imageUrl}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor={`${idPrefix}-active`}>Active</Label>
          <p className="text-muted-foreground text-xs">
            Inactive tracks are hidden from the marketplace
          </p>
        </div>
        <Switch
          checked={formData.isActive}
          id={`${idPrefix}-active`}
          onCheckedChange={(checked) => onChange({ ...formData, isActive: checked })}
        />
      </div>
    </div>
  )
}

function TrackStats({ tracks }: { tracks: any[] }) {
  const totalTracks = tracks.length
  const activeTracks = tracks.filter((t) => t.isActive).length
  const inactiveTracks = totalTracks - activeTracks

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        icon={<MapPin className="size-4" />}
        iconBgClassName="bg-blue-100 dark:bg-blue-900/50"
        iconClassName="text-blue-600 dark:text-blue-400"
        label="Total Tracks"
        value={totalTracks}
      />
      <StatCard
        icon={<Power className="size-4" />}
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/50"
        iconClassName="text-emerald-600 dark:text-emerald-400"
        label="Active"
        value={activeTracks}
      />
      <StatCard
        icon={<Power className="size-4" />}
        iconBgClassName="bg-gray-100 dark:bg-gray-800"
        iconClassName="text-gray-500 dark:text-gray-400"
        label="Inactive"
        value={inactiveTracks}
      />
    </div>
  )
}

export default function TracksPage() {
  const tracks = useQuery(api.tracks.getAllForAdmin)
  const createTrack = useMutation(api.tracks.create)
  const updateTrack = useMutation(api.tracks.update)
  const deleteTrack = useMutation(api.tracks.deleteTrack)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingTrackId, setEditingTrackId] = useState<Id<"tracks"> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"tracks">; name: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [formData, setFormData] = useState<TrackFormData>(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const filteredTracks = useMemo(() => {
    if (!tracks) return []

    return tracks.filter((track) => {
      const matchesSearch =
        !searchQuery ||
        track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.location.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === undefined ||
        (statusFilter === "active" && track.isActive) ||
        (statusFilter === "inactive" && !track.isActive)

      return matchesSearch && matchesStatus
    })
  }, [tracks, searchQuery, statusFilter])

  const handleCreate = async () => {
    if (!(formData.name.trim() && formData.location.trim())) {
      toast.error("Please fill in the name and location fields")
      return
    }

    setIsProcessing(true)
    try {
      await createTrack({
        name: formData.name.trim(),
        location: formData.location.trim(),
        description: formData.description.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        isActive: formData.isActive,
      })
      toast.success("Track created successfully")
      setIsCreateOpen(false)
      setFormData(EMPTY_FORM)
    } catch (error) {
      handleErrorWithContext(error, { action: "create track", entity: "track" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleEdit = async () => {
    if (!(editingTrackId && formData.name.trim() && formData.location.trim())) {
      toast.error("Please fill in the name and location fields")
      return
    }

    setIsProcessing(true)
    try {
      await updateTrack({
        id: editingTrackId,
        name: formData.name.trim(),
        location: formData.location.trim(),
        description: formData.description.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        isActive: formData.isActive,
      })
      toast.success("Track updated successfully")
      setIsEditOpen(false)
      setEditingTrackId(null)
      setFormData(EMPTY_FORM)
    } catch (error) {
      handleErrorWithContext(error, { action: "update track", entity: "track" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsProcessing(true)
    try {
      await deleteTrack({ id: deleteTarget.id })
      toast.success("Track deleted successfully")
      setDeleteTarget(null)
    } catch (error) {
      handleErrorWithContext(error, { action: "delete track", entity: "track" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleToggleActive = async (trackId: Id<"tracks">, currentlyActive: boolean) => {
    try {
      await updateTrack({ id: trackId, isActive: !currentlyActive })
      toast.success(`Track ${currentlyActive ? "deactivated" : "activated"} successfully`)
    } catch (error) {
      handleErrorWithContext(error, { action: "toggle track status", entity: "track" })
    }
  }

  const openEditDialog = (track: any) => {
    setEditingTrackId(track._id)
    setFormData({
      name: track.name,
      location: track.location,
      description: track.description || "",
      imageUrl: track.imageUrl || "",
      isActive: track.isActive,
    })
    setIsEditOpen(true)
  }

  const openCreateDialog = () => {
    setFormData(EMPTY_FORM)
    setIsCreateOpen(true)
  }

  if (tracks === undefined) {
    return <LoadingState message="Loading tracks..." />
  }

  const columns: Column<any>[] = [
    {
      key: "image",
      header: "",
      cell: (row) => <TrackImage alt={row.name} src={row.imageUrl} />,
      className: "w-20",
    },
    {
      key: "name",
      header: "Track Name",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.name}</p>
          {row.description && (
            <p className="mt-0.5 max-w-md truncate text-muted-foreground text-xs">
              {row.description}
            </p>
          )}
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.name ?? "",
    },
    {
      key: "location",
      header: "Location",
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {row.location}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.location ?? "",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row)}>
              <Edit className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleActive(row._id, row.isActive)}>
              <Power className="mr-2 size-4" />
              {row.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteTarget({ id: row._id, name: row.name })}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-12",
    },
  ]

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      value: statusFilter,
      onChange: (value) => setStatusFilter(value),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 size-4" />
            Add Track
          </Button>
        }
        description="Manage racing tracks available on the platform"
        title="Track Management"
      />

      <TrackStats tracks={tracks} />

      <Card>
        <CardHeader>
          <CardTitle>All Tracks</CardTitle>
          <CardDescription>
            {filteredTracks.length} of {tracks.length} track(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredTracks}
            emptyMessage="No tracks found matching your criteria"
            getRowId={(row) => row._id}
            isLoading={false}
            toolbar={
              <DataTableToolbar
                filters={filters}
                onExport={() =>
                  exportToCSV(
                    filteredTracks as any[],
                    [
                      { key: "name", header: "Name", value: (r) => r.name },
                      { key: "location", header: "Location", value: (r) => r.location },
                      {
                        key: "description",
                        header: "Description",
                        value: (r) => r.description ?? "",
                      },
                      {
                        key: "status",
                        header: "Status",
                        value: (r) => (r.isActive ? "Active" : "Inactive"),
                      },
                      { key: "imageUrl", header: "Image URL", value: (r) => r.imageUrl ?? "" },
                    ],
                    "tracks"
                  )
                }
                onSearchChange={setSearchQuery}
                search={searchQuery}
                searchPlaceholder="Search tracks by name or location..."
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) setFormData(EMPTY_FORM)
        }}
        open={isCreateOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Track</DialogTitle>
            <DialogDescription>Add a new racing track to the platform.</DialogDescription>
          </DialogHeader>
          <TrackFormFields formData={formData} idPrefix="create" onChange={setFormData} />
          <DialogFooter>
            <Button onClick={() => setIsCreateOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={isProcessing} onClick={handleCreate}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Track"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            setEditingTrackId(null)
            setFormData(EMPTY_FORM)
          }
        }}
        open={isEditOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Track</DialogTitle>
            <DialogDescription>Update track details and settings.</DialogDescription>
          </DialogHeader>
          <TrackFormFields formData={formData} idPrefix="edit" onChange={setFormData} />
          <DialogFooter>
            <Button onClick={() => setIsEditOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={isProcessing} onClick={handleEdit}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        confirmLabel="Delete Track"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone. Tracks with associated vehicles cannot be deleted.`}
        isLoading={isProcessing}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        open={deleteTarget !== null}
        title="Delete Track"
        variant="destructive"
      />
    </div>
  )
}
