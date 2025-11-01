"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { ArrowLeft, Plus, X, Upload, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

// TODO: Fetch from Convex query api.tracks.getTracks
const AVAILABLE_TRACKS = [
  { _id: "track1", name: "Daytona International Speedway", location: "Daytona Beach, FL" },
  { _id: "track2", name: "Sebring International Raceway", location: "Sebring, FL" },
  { _id: "track3", name: "Circuit of the Americas", location: "Austin, TX" },
  { _id: "track4", name: "Road Atlanta", location: "Braselton, GA" },
]

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

export default function CreateVehiclePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    trackId: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    dailyRate: "",
    description: "",
    horsepower: "",
    transmission: "",
    drivetrain: "",
    engineType: "",
    mileage: "",
    amenities: [] as string[],
    addOns: [] as Array<{ name: string; price: number; description: string; isRequired: boolean }>,
  })

  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([])
  const [newAddOn, setNewAddOn] = useState({
    name: "",
    price: "",
    description: "",
    isRequired: false,
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === "year" || name === "dailyRate" || name === "horsepower" || name === "mileage"
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setImages((prev) => [...prev, { file, preview: reader.result as string }])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const addAddOn = () => {
    if (newAddOn.name && newAddOn.price) {
      setFormData({
        ...formData,
        addOns: [
          ...formData.addOns,
          {
            name: newAddOn.name,
            price: Number(newAddOn.price),
            description: newAddOn.description,
            isRequired: newAddOn.isRequired,
          },
        ],
      })
      setNewAddOn({ name: "", price: "", description: "", isRequired: false })
    }
  }

  const removeAddOn = (index: number) => {
    setFormData({
      ...formData,
      addOns: formData.addOns.filter((_, i) => i !== index),
    })
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.trackId &&
          formData.make &&
          formData.model &&
          formData.year &&
          formData.dailyRate &&
          formData.description
        )
      case 2:
        return true // Specs are optional
      case 3:
        return images.length > 0 // At least one image required
      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4))
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // TODO: Replace with Convex mutation
      // 1. Generate upload URLs for images
      // 2. Upload images to storage
      // 3. Process images (create thumbnails, card, detail, hero sizes)
      // 4. Create vehicle with api.vehicles.createVehicleWithImages

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Redirect to vehicle list after successful creation
      router.push("/host/vehicles/list")
    } catch (error) {
      console.error("Error creating vehicle:", error)
      // TODO: Show error message to user
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { number: 1, title: "Basic Information", description: "Track, vehicle details, and pricing" },
    { number: 2, title: "Specifications", description: "Performance specs and features" },
    { number: 3, title: "Photos", description: "Upload vehicle images" },
    { number: 4, title: "Amenities & Add-ons", description: "Additional features and options" },
  ]

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Link href="/host/vehicles/list">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back to Vehicles
          </Button>
        </Link>
        <h1 className="mt-4 font-bold text-3xl">List Your Vehicle</h1>
        <p className="mt-2 text-muted-foreground">
          Add your track car to the platform and start earning rental income
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-10 items-center justify-center rounded-full border-2 font-semibold ${
                    currentStep === step.number
                      ? "border-primary bg-primary text-primary-foreground"
                      : currentStep > step.number
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.number ? <CheckCircle2 className="size-5" /> : step.number}
                </div>
                <div className="mt-2 hidden text-center md:block">
                  <p
                    className={`text-xs font-medium ${
                      currentStep === step.number ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    currentStep > step.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Step {currentStep}: {steps[currentStep - 1].title}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="trackId">Track Location *</Label>
                  <Select onValueChange={(value) => handleSelectChange("trackId", value)}>
                    <SelectTrigger id="trackId">
                      <SelectValue placeholder="Select a track" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_TRACKS.map((track) => (
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
                    placeholder="Describe your vehicle, its condition, track readiness, and what makes it special..."
                    required
                    value={formData.description}
                  />
                  <p className="text-muted-foreground text-xs">
                    Provide a detailed description to attract renters
                  </p>
                </div>
              </>
            )}

            {/* Step 2: Specifications */}
            {currentStep === 2 && (
              <>
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

                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-muted-foreground text-sm">
                    All specification fields are optional. You can add or update them later.
                  </p>
                </div>
              </>
            )}

            {/* Step 3: Photos */}
            {currentStep === 3 && (
              <>
                <div className="space-y-4">
                  <div>
                    <Label>Vehicle Photos *</Label>
                    <p className="text-muted-foreground text-xs">
                      Upload at least one photo. The first image will be used as the main image.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative">
                        <div className="relative size-32 overflow-hidden rounded-lg border">
                          <img
                            alt={`Preview ${index + 1}`}
                            className="size-full object-cover"
                            src={image.preview}
                          />
                          {index === 0 && (
                            <div className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-primary-foreground text-xs font-medium">
                              Primary
                            </div>
                          )}
                        </div>
                        <Button
                          className="absolute -right-2 -top-2 size-6 rounded-full p-0"
                          onClick={() => removeImage(index)}
                          size="icon"
                          type="button"
                          variant="destructive"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}

                    <label className="flex size-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary">
                      <div className="text-center">
                        <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Add Photo</span>
                      </div>
                      <input
                        accept="image/*"
                        className="hidden"
                        multiple
                        onChange={handleImageUpload}
                        type="file"
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Amenities & Add-ons */}
            {currentStep === 4 && (
              <>
                <div className="space-y-4">
                  <div>
                    <Label>Amenities</Label>
                    <p className="text-muted-foreground text-xs">
                      Select all amenities included with your vehicle
                    </p>
                  </div>
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
                        {formData.amenities.includes(amenity) && <CheckCircle2 className="mr-2 size-4" />}
                        {amenity}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>Add-ons (Optional)</Label>
                    <p className="text-muted-foreground text-xs">
                      Additional services or items renters can purchase
                    </p>
                  </div>

                  {formData.addOns.length > 0 && (
                    <div className="space-y-2">
                      {formData.addOns.map((addOn, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{addOn.name}</p>
                            {addOn.description && (
                              <p className="text-muted-foreground text-sm">{addOn.description}</p>
                            )}
                            <p className="font-semibold text-primary">${addOn.price}/day</p>
                          </div>
                          <Button
                            onClick={() => removeAddOn(index)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="addOnName">Add-on Name</Label>
                        <Input
                          id="addOnName"
                          onChange={(e) => setNewAddOn({ ...newAddOn, name: e.target.value })}
                          placeholder="e.g., Professional Driving Instructor"
                          value={newAddOn.name}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="addOnPrice">Price ($/day)</Label>
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
                    <Button onClick={addAddOn} type="button" variant="outline">
                      <Plus className="mr-2 size-4" />
                      Add Add-on
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
              <Button onClick={prevStep} type="button" variant="outline" disabled={currentStep === 1}>
                Previous
              </Button>
              {currentStep < 4 ? (
                <Button onClick={nextStep} type="button">
                  Next Step
                </Button>
              ) : (
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Submitting..." : "List Vehicle"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

