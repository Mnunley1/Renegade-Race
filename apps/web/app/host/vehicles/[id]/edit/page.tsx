"use client"

import { useUploadFile } from "@convex-dev/r2/react"
import { Image } from "@imagekit/next"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, Edit, GripVertical, Loader2, Plus, Star, Trash2, Upload, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { imagePresets } from "@/lib/imagekit"
import { handleErrorWithContext } from "@/lib/error-handler"

const TRANSMISSION_OPTIONS = ["Manual", "Automatic", "PDK", "DCT", "CVT"]
const DRIVETRAIN_OPTIONS = ["RWD", "AWD", "FWD"]
const ENGINE_TYPE_OPTIONS = ["V6", "V8", "V10", "V12", "Flat-6", "Inline-4", "Inline-6", "Electric"]

export default function EditVehiclePage() {
  const params = useParams()
  const router = useRouter()
  const vehicleId = params.id as string
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch vehicle and tracks from Convex
  const vehicle = useQuery(api.vehicles.getById, vehicleId ? { id: vehicleId as any } : "skip")
  const tracks = useQuery(api.tracks.getAll, {})

  // Mutations
  const updateVehicle = useMutation(api.vehicles.update)
  const addImage = useMutation(api.vehicles.addImage)
  const removeImage = useMutation(api.vehicles.removeImage)
  const updateImageOrder = useMutation(api.vehicles.updateImageOrder)
  const updateImage = useMutation(api.vehicles.updateImage)
  const uploadFile = useUploadFile(api.r2)

  // Image management state
  const [images, setImages] = useState<
    Array<{
      _id: string
      r2Key: string | undefined
      isPrimary: boolean
      order: number
    }>
  >([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Add-on management state
  const [newAddOn, setNewAddOn] = useState({
    name: "",
    price: "",
    description: "",
    isRequired: false,
  })
  const [editingAddOnIndex, setEditingAddOnIndex] = useState<number | null>(null)

  // Initialize form data
  const [formData, setFormData] = useState({
    trackId: "",
    make: "",
    model: "",
    year: 0,
    dailyRate: 0,
    description: "",
    horsepower: 0,
    transmission: "",
    drivetrain: "",
    engineType: "",
    mileage: 0,
    addOns: [] as Array<{
      name: string
      price: number
      description?: string
      isRequired?: boolean
    }>,
  })

  // Populate form data when vehicle loads
  useEffect(() => {
    if (vehicle) {
      setFormData({
        trackId: vehicle.trackId || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || 0,
        dailyRate: vehicle.dailyRate || 0,
        description: vehicle.description || "",
        horsepower: vehicle.horsepower || 0,
        transmission: vehicle.transmission || "",
        drivetrain: vehicle.drivetrain || "",
        engineType: vehicle.engineType || "",
        mileage: vehicle.mileage || 0,
        addOns: vehicle.addOns || [],
      })

      // Sort images by order
      const sortedImages = [...(vehicle.images || [])].sort((a, b) => a.order - b.order)
      setImages(sortedImages)
    }
  }, [vehicle])

  // Show loading state
  if (vehicle === undefined || tracks === undefined) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading vehicle data...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if vehicle not found
  if (!vehicle) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-2 font-bold text-2xl">Vehicle Not Found</p>
            <p className="mb-6 text-muted-foreground">
              The vehicle you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/host/vehicles/list">
              <Button>Back to Vehicles</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]:
        name === "year" || name === "dailyRate" || name === "horsepower" || name === "mileage"
          ? value === ""
            ? ""
            : Number(value)
          : value,
    })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  // Add-on management functions
  const addAddOn = () => {
    if (newAddOn.name && newAddOn.price) {
      setFormData({
        ...formData,
        addOns: [
          ...formData.addOns,
          {
            name: newAddOn.name,
            price: Number(newAddOn.price),
            description: newAddOn.description || undefined,
            isRequired: newAddOn.isRequired,
          },
        ],
      })
      setNewAddOn({ name: "", price: "", description: "", isRequired: false })
      toast.success("Add-on added")
    } else {
      toast.error("Please provide a name and price for the add-on")
    }
  }

  const removeAddOn = (index: number) => {
    setFormData({
      ...formData,
      addOns: formData.addOns.filter((_, i) => i !== index),
    })
    if (editingAddOnIndex === index) {
      setEditingAddOnIndex(null)
    } else if (editingAddOnIndex !== null && editingAddOnIndex > index) {
      setEditingAddOnIndex(editingAddOnIndex - 1)
    }
    toast.success("Add-on removed")
  }

  const startEditingAddOn = (index: number) => {
    const addOn = formData.addOns[index]
    setNewAddOn({
      name: addOn.name,
      price: addOn.price.toString(),
      description: addOn.description || "",
      isRequired: addOn.isRequired || false,
    })
    setEditingAddOnIndex(index)
  }

  const saveEditedAddOn = () => {
    if (editingAddOnIndex === null || !newAddOn.name || !newAddOn.price) {
      toast.error("Please provide a name and price for the add-on")
      return
    }

    const updatedAddOns = [...formData.addOns]
    updatedAddOns[editingAddOnIndex] = {
      name: newAddOn.name,
      price: Number(newAddOn.price),
      description: newAddOn.description || undefined,
      isRequired: newAddOn.isRequired,
    }

    setFormData({
      ...formData,
      addOns: updatedAddOns,
    })
    setNewAddOn({ name: "", price: "", description: "", isRequired: false })
    setEditingAddOnIndex(null)
    toast.success("Add-on updated")
  }

  const cancelEditingAddOn = () => {
    setNewAddOn({ name: "", price: "", description: "", isRequired: false })
    setEditingAddOnIndex(null)
  }

  // Image management functions
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const fileArray = Array.from(files)
      for (let index = 0; index < fileArray.length; index++) {
        const file = fileArray[index]
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`)
          continue
        }

        try {
          // Add a small delay between uploads to avoid rate limiting
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          // Upload to R2
          const r2Key = await uploadFile(file)
          
          // Add image to database
          const isPrimary = images.length === 0
          await addImage({
            vehicleId: vehicleId as any,
            r2Key,
            isPrimary,
          })

          toast.success(`Image ${file.name} uploaded successfully`)
        } catch (error) {
          handleErrorWithContext(error, {
            action: `upload ${file.name}`,
            customMessages: {
              file_upload: `Failed to upload ${file.name}. Please try again.`,
              generic: `Failed to upload ${file.name}. Please try again.`,
            },
          })
        }
      }
    } finally {
      setIsUploading(false)
      // Reset file input
      e.target.value = ""
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return

    try {
      await removeImage({ imageId: imageId as any })
      toast.success("Image deleted successfully")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "delete image",
        customMessages: {
          generic: "Failed to delete image. Please try again.",
        },
      })
    }
  }

  const handleSetPrimary = async (imageId: string) => {
    try {
      await updateImage({ imageId: imageId as any, isPrimary: true })
      toast.success("Primary image updated")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "set primary image",
        customMessages: {
          generic: "Failed to set primary image. Please try again.",
        },
      })
    }
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    if (draggedIndex !== index) {
      const newImages = [...images]
      const draggedImage = newImages[draggedIndex]
      newImages.splice(draggedIndex, 1)
      newImages.splice(index, 0, draggedImage)
      setImages(newImages)
      setDraggedIndex(index)
    }
  }

  const handleDragEnd = async () => {
    if (draggedIndex === null) return

    try {
      // Update order in database
      const imageOrders = images.map((img, index) => ({
        imageId: img._id as any,
        order: index,
      }))

      await updateImageOrder({
        vehicleId: vehicleId as any,
        imageOrders,
      })

      toast.success("Image order updated")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "update image order",
        customMessages: {
          generic: "Failed to update image order. Please try again.",
        },
      })
      // Reload images to revert UI changes
      if (vehicle) {
        const sortedImages = [...(vehicle.images || [])].sort((a, b) => a.order - b.order)
        setImages(sortedImages)
      }
    } finally {
      setDraggedIndex(null)
    }
  }

  const getImageUrl = (r2Key: string | undefined) => {
    if (!r2Key) return ""
    return imagePresets.thumbnail(r2Key)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await updateVehicle({
        id: vehicleId as any,
        trackId: formData.trackId ? (formData.trackId as any) : undefined,
        make: formData.make || undefined,
        model: formData.model || undefined,
        year: formData.year || undefined,
        dailyRate: formData.dailyRate || undefined,
        description: formData.description || undefined,
        horsepower: formData.horsepower || undefined,
        transmission: formData.transmission || undefined,
        drivetrain: formData.drivetrain || undefined,
        engineType: formData.engineType || undefined,
        mileage: formData.mileage || undefined,
        addOns: formData.addOns.length > 0 ? formData.addOns : undefined,
      })

      // Redirect to vehicle detail page after successful update
      router.push(`/host/vehicles/${vehicleId}`)
    } catch (error) {
      handleErrorWithContext(error, {
        action: "update vehicle",
        entity: "vehicle",
        customMessages: {
          generic: "Failed to update vehicle. Please try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Link href={`/host/vehicles/${vehicleId}`}>
          <Button className="mb-6" variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            Back to Vehicle
          </Button>
        </Link>
        <h1 className="mt-4 font-bold text-3xl">Edit Vehicle</h1>
        <p className="mt-2 text-muted-foreground">Update your vehicle information</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Image Section - Moved to Top */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Vehicle Images</CardTitle>
            <CardDescription>Manage your vehicle photos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Manage Images</Label>
              <div className="relative">
                <Input
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                  id="image-upload"
                  multiple
                  onChange={handleImageUpload}
                  type="file"
                />
                <Label
                  className={cn(
                    "cursor-pointer",
                    isUploading && "opacity-50 cursor-not-allowed"
                  )}
                  htmlFor="image-upload"
                >
                  <Button
                    disabled={isUploading}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Upload className="mr-2 size-4" />
                    {isUploading ? "Uploading..." : "Add Images"}
                  </Button>
                </Label>
              </div>
            </div>

            {images.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">
                    No images uploaded yet
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Drag and drop to reorder images
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image, index) => (
                  <div
                    className={cn(
                      "group relative overflow-hidden rounded-lg border bg-muted transition-all",
                      draggedIndex === index && "opacity-50",
                      image.isPrimary && "ring-2 ring-primary"
                    )}
                    draggable
                    key={image._id}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragStart={() => handleDragStart(index)}
                  >
                    {image.r2Key ? (
                      <div className="relative aspect-video">
                        <Image
                          alt={`Vehicle image ${index + 1}`}
                          className="object-cover"
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          src={getImageUrl(image.r2Key)}
                          urlEndpoint="https://ik.imagekit.io/renegaderace"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-muted">
                        <p className="text-muted-foreground text-sm">No image</p>
                      </div>
                    )}

                    {/* Overlay with actions */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        className="bg-white/90 text-black hover:bg-white"
                        onClick={() => handleSetPrimary(image._id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Star
                          className={cn(
                            "size-4",
                            image.isPrimary ? "fill-yellow-400 text-yellow-400" : ""
                          )}
                        />
                      </Button>
                      <Button
                        className="bg-white/90 text-black hover:bg-white"
                        onClick={() => handleDeleteImage(image._id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {/* Drag handle */}
                    <div className="absolute left-2 top-2 cursor-grab active:cursor-grabbing">
                      <GripVertical className="size-5 text-white drop-shadow-lg" />
                    </div>

                    {/* Primary badge */}
                    {image.isPrimary && (
                      <div className="absolute right-2 top-2">
                        <div className="flex items-center gap-1 rounded-full bg-primary px-2 py-1">
                          <Star className="size-3 fill-white text-white" />
                          <span className="text-white text-xs font-medium">Primary</span>
                        </div>
                      </div>
                    )}

                    {/* Order indicator */}
                    <div className="absolute bottom-2 left-2">
                      <div className="rounded-full bg-black/70 px-2 py-1">
                        <span className="text-white text-xs font-medium">
                          {index + 1} / {images.length}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {images.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Drag images to reorder • Click the star icon to set as primary image
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Information</CardTitle>
            <CardDescription>Update the details of your vehicle listing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="trackId">Track Location *</Label>
              <Select
                onValueChange={(value) => handleSelectChange("trackId", value)}
                value={formData.trackId}
              >
                <SelectTrigger id="trackId">
                  <SelectValue placeholder="Select a track" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((track) => (
                    <SelectItem key={track._id} value={track._id}>
                      {track.name} - {track.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  name="make"
                  onChange={handleChange}
                  placeholder="Porsche"
                  required
                  value={formData.make}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  name="model"
                  onChange={handleChange}
                  placeholder="911 GT3"
                  required
                  value={formData.model}
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  name="year"
                  onChange={handleChange}
                  placeholder="2023"
                  required
                  type="number"
                  value={formData.year}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyRate">Daily Rate ($) *</Label>
                <Input
                  id="dailyRate"
                  name="dailyRate"
                  onChange={handleChange}
                  placeholder="899"
                  required
                  type="number"
                  value={formData.dailyRate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                className="min-h-32"
                id="description"
                name="description"
                onChange={handleChange}
                placeholder="Describe your vehicle..."
                required
                value={formData.description}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Specifications</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="horsepower">Horsepower</Label>
                  <Input
                    id="horsepower"
                    name="horsepower"
                    onChange={handleChange}
                    placeholder="502"
                    type="number"
                    value={formData.horsepower}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileage">Mileage</Label>
                  <Input
                    id="mileage"
                    name="mileage"
                    onChange={handleChange}
                    placeholder="15000"
                    type="number"
                    value={formData.mileage}
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="transmission">Transmission</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("transmission", value)}
                    value={formData.transmission}
                  >
                    <SelectTrigger id="transmission">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSMISSION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drivetrain">Drivetrain</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("drivetrain", value)}
                    value={formData.drivetrain}
                  >
                    <SelectTrigger id="drivetrain">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {DRIVETRAIN_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="engineType">Engine Type</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("engineType", value)}
                    value={formData.engineType}
                  >
                    <SelectTrigger id="engineType">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENGINE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Add-ons</h3>
                  <p className="text-muted-foreground text-sm">
                    Additional services or items renters can purchase
                  </p>
                </div>
              </div>

              {formData.addOns.length > 0 && (
                <div className="space-y-3">
                  {formData.addOns.map((addOn, index) => (
                    <div
                      className="flex items-start justify-between gap-4 rounded-lg border p-4"
                      key={index}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{addOn.name}</p>
                          {addOn.isRequired && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs font-medium">
                              Required
                            </span>
                          )}
                        </div>
                        {addOn.description && (
                          <p className="text-muted-foreground text-sm">{addOn.description}</p>
                        )}
                        <p className="font-semibold text-primary">${addOn.price}/day</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => startEditingAddOn(index)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          onClick={() => removeAddOn(index)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4 rounded-lg border p-4">
                <h4 className="font-medium">
                  {editingAddOnIndex !== null ? "Edit Add-on" : "Add New Add-on"}
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="addOnName">Add-on Name *</Label>
                    <Input
                      id="addOnName"
                      onChange={(e) => setNewAddOn({ ...newAddOn, name: e.target.value })}
                      placeholder="e.g., Professional Driving Instructor"
                      value={newAddOn.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addOnPrice">Price ($/day) *</Label>
                    <Input
                      id="addOnPrice"
                      onChange={(e) => setNewAddOn({ ...newAddOn, price: e.target.value })}
                      placeholder="150"
                      type="number"
                      value={newAddOn.price}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addOnDescription">Description (Optional)</Label>
                  <Input
                    id="addOnDescription"
                    onChange={(e) => setNewAddOn({ ...newAddOn, description: e.target.value })}
                    placeholder="Brief description of the add-on"
                    value={newAddOn.description}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={newAddOn.isRequired}
                    id="addOnRequired"
                    onCheckedChange={(checked) =>
                      setNewAddOn({ ...newAddOn, isRequired: checked === true })
                    }
                  />
                  <Label
                    className="cursor-pointer text-sm font-normal"
                    htmlFor="addOnRequired"
                  >
                    Required add-on (renters must purchase this)
                  </Label>
                </div>
                <div className="flex gap-2">
                  {editingAddOnIndex !== null ? (
                    <>
                      <Button onClick={saveEditedAddOn} type="button" variant="default">
                        Save Changes
                      </Button>
                      <Button onClick={cancelEditingAddOn} type="button" variant="outline">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={addAddOn} type="button" variant="outline">
                      <Plus className="mr-2 size-4" />
                      Add Add-on
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6">
              <Link href={`/host/vehicles/${vehicleId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
