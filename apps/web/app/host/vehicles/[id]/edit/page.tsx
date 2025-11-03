"use client"

import { useQuery, useMutation } from "convex/react"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/convex"

const TRANSMISSION_OPTIONS = ["Manual", "Automatic", "PDK", "DCT", "CVT"]
const DRIVETRAIN_OPTIONS = ["RWD", "AWD", "FWD"]
const ENGINE_TYPE_OPTIONS = ["V6", "V8", "V10", "V12", "Flat-6", "Inline-4", "Inline-6", "Electric"]

const COMMON_AMENITIES = [
  "GPS Navigation",
  "Bluetooth",
  "Apple CarPlay",
  "Android Auto",
  "Premium Sound System",
  "Racing Seats",
  "Roll Cage",
  "Fire Suppression System",
  "Data Logger",
  "Telemetry System",
  "Track Tires",
  "Racing Wheels",
  "Aerodynamic Package",
  "Racing Suspension",
  "Performance Exhaust",
]

export default function EditVehiclePage() {
  const params = useParams()
  const router = useRouter()
  const vehicleId = params.id as string
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch vehicle and tracks from Convex
  const vehicle = useQuery(
    api.vehicles.getById,
    vehicleId ? { id: vehicleId as any } : "skip"
  )
  const tracks = useQuery(api.tracks.getAll, {})

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
    amenities: [] as string[],
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
        amenities: vehicle.amenities || [],
        addOns: vehicle.addOns || [],
      })
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

  const toggleAmenity = (amenity: string) => {
    setFormData({
      ...formData,
      amenities: formData.amenities.includes(amenity)
        ? formData.amenities.filter((a) => a !== amenity)
        : [...formData.amenities, amenity],
    })
  }

  const updateVehicle = useMutation(api.vehicles.update)

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
        amenities: formData.amenities.length > 0 ? formData.amenities : undefined,
        addOns: formData.addOns.length > 0 ? formData.addOns : undefined,
      })

      // Redirect to vehicle detail page after successful update
      router.push(`/host/vehicles/${vehicleId}`)
    } catch (error) {
      console.error("Error updating vehicle:", error)
      alert("Failed to update vehicle. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Link href={`/host/vehicles/${vehicleId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back to Vehicle
          </Button>
        </Link>
        <h1 className="mt-4 font-bold text-3xl">Edit Vehicle</h1>
        <p className="mt-2 text-muted-foreground">Update your vehicle information</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Information</CardTitle>
            <CardDescription>Update the details of your vehicle listing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="trackId">Track Location *</Label>
              <Select
                value={formData.trackId}
                onValueChange={(value) => handleSelectChange("trackId", value)}
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
              <h3 className="font-semibold text-lg">Amenities</h3>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {COMMON_AMENITIES.map((amenity) => (
                  <Button
                    key={amenity}
                    className="justify-start"
                    onClick={(e) => {
                      e.preventDefault()
                      toggleAmenity(amenity)
                    }}
                    type="button"
                    variant={formData.amenities.includes(amenity) ? "default" : "outline"}
                  >
                    {formData.amenities.includes(amenity) && (
                      <span className="mr-2 size-4 rounded-full bg-primary-foreground text-primary text-xs flex items-center justify-center">
                        ✓
                      </span>
                    )}
                    {amenity}
                  </Button>
                ))}
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
