"use client"

import { useUser } from "@clerk/nextjs"
import { useUploadFile } from "@convex-dev/r2/react"
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
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, CheckCircle2, Loader2, Plus, Upload, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { COMMON_AMENITIES } from "@/lib/constants"
import { handleErrorWithContext } from "@/lib/error-handler"

// Transmission options matching onboarding flow
const TRANSMISSION_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "sequential", label: "Sequential" },
  { value: "paddle-shift", label: "Paddle Shift" },
]

// Drivetrain options matching onboarding flow
const DRIVETRAIN_OPTIONS = [
  { value: "rwd", label: "RWD (Rear-Wheel Drive)" },
  { value: "fwd", label: "FWD (Front-Wheel Drive)" },
  { value: "awd", label: "AWD (All-Wheel Drive)" },
  { value: "4wd", label: "4WD (Four-Wheel Drive)" },
]

export default function CreateVehiclePage() {
  const router = useRouter()
  const { user } = useUser()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check onboarding status - protect this route
  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, user?.id ? {} : "skip")

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (onboardingStatus && onboardingStatus.status !== "completed") {
      router.push("/host/onboarding")
    }
  }, [onboardingStatus, router])

  // Fetch tracks from Convex
  const tracks = useQuery(api.tracks.getAll, {})
  const createVehicleWithImages = useMutation(api.vehicles.createVehicleWithImages)
  // Use R2 upload hook - this handles the entire upload process
  const uploadFile = useUploadFile(api.r2)

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
    // Location fields
    street: "",
    city: "",
    state: "",
    zipCode: "",
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
  const [validationAttempted, setValidationAttempted] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]:
        name === "year" || name === "dailyRate" || name === "horsepower"
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

  const getStepValidationErrors = (step: number): string[] => {
    const errors: string[] = []
    switch (step) {
      case 1:
        if (!formData.make) errors.push("Make")
        if (!formData.model) errors.push("Model")
        if (!formData.year) errors.push("Year")
        if (!formData.dailyRate) errors.push("Daily Rate")
        if (!formData.description) errors.push("Description")
        if (!formData.street) errors.push("Street Address")
        if (!formData.city) errors.push("City")
        if (!formData.state) errors.push("State")
        if (!formData.zipCode) errors.push("ZIP Code")
        break
      case 2:
        if (images.length === 0) errors.push("At least one photo")
        break
      case 3:
        // Amenities are optional, no validation needed
        break
      default:
        break
    }
    return errors
  }

  const validateStep = (step: number): boolean => {
    return getStepValidationErrors(step).length === 0
  }

  const nextStep = () => {
    setValidationAttempted(true)
    const errors = getStepValidationErrors(currentStep)
    if (errors.length === 0) {
      setValidationAttempted(false)
      setCurrentStep((prev) => Math.min(prev + 1, 3))
    } else {
      const errorMessage =
        errors.length === 1
          ? `Please complete the following field: ${errors[0]}`
          : `Please complete the following fields: ${errors.join(", ")}`
      toast.error(errorMessage)
    }
  }

  const getFieldError = (fieldName: string): boolean => {
    if (!validationAttempted) return false
    const errors = getStepValidationErrors(currentStep)
    return errors.includes(fieldName)
  }

  const prevStep = () => {
    setValidationAttempted(false)
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  // Reset validation when step changes
  useEffect(() => {
    setValidationAttempted(false)
  }, [currentStep])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (
        !(
          formData.make &&
          formData.model &&
          formData.year &&
          formData.dailyRate &&
          formData.description &&
          formData.street &&
          formData.city &&
          formData.state &&
          formData.zipCode
        )
      ) {
        toast.error("Please fill in all required fields")
        setIsSubmitting(false)
        return
      }

      if (images.length === 0) {
        toast.error("Please upload at least one image")
        setIsSubmitting(false)
        return
      }

      // Upload images to R2 sequentially to avoid rate limiting and get better error messages
      const imageKeys: string[] = []
      for (let index = 0; index < images.length; index++) {
        const img = images[index]
        try {
          // Add a small delay between uploads to avoid rate limiting
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          const key = await uploadFile(img.file)
          imageKeys.push(key)
        } catch (error) {
          handleErrorWithContext(error, {
            action: `upload image ${index + 1}`,
            customMessages: {
              file_upload: `Failed to upload ${img.file.name}. Please try again.`,
              generic: `Failed to upload ${img.file.name}. Please try again.`,
            },
          })
          // Re-throw with generic error
          throw new Error("Failed to upload image")
        }
      }

      // Create vehicle with R2 image keys
      const vehicleId = await createVehicleWithImages({
        trackId: formData.trackId ? (formData.trackId as any) : undefined,
        make: formData.make,
        model: formData.model,
        year: Number(formData.year),
        dailyRate: Number(formData.dailyRate),
        description: formData.description,
        horsepower: formData.horsepower ? Number(formData.horsepower) : undefined,
        transmission: formData.transmission || undefined,
        drivetrain: formData.drivetrain || undefined,
        amenities: formData.amenities,
        addOns: formData.addOns,
        address: {
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zipCode: formData.zipCode.trim(),
        },
        images: imageKeys.map((r2Key, index) => ({
          r2Key,
          isPrimary: index === 0,
          order: index,
        })),
      })

      toast.success("Vehicle listed successfully!")
      router.push("/host/vehicles/list")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "create vehicle",
        entity: "vehicle",
        customMessages: {
          file_upload: "Failed to upload vehicle images. Please try again.",
          generic: "Failed to create vehicle. Please try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading or redirect if onboarding not complete
  if (!onboardingStatus || onboardingStatus.status !== "completed") {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state while tracks are loading
  if (tracks === undefined) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading tracks...</p>
          </div>
        </div>
      </div>
    )
  }

  const steps = [
    { number: 1, title: "Vehicle & Location", description: "Vehicle details and pickup location" },
    { number: 2, title: "Photos", description: "Upload vehicle images" },
    { number: 3, title: "Amenities & Add-ons", description: "Additional features and options" },
  ]

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Link href="/host/vehicles/list">
          <Button size="sm" variant="ghost">
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
      <div className="mb-8 flex justify-center">
        <div className="flex items-center">
          {steps.map((step, index) => (
            <div className="flex items-center" key={step.number}>
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
                    className={`font-medium text-xs ${
                      currentStep === step.number ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-4 h-0.5 w-16 ${
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
            <CardTitle>
              Step {currentStep}: {steps[currentStep - 1].title}
            </CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Vehicle & Location */}
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="trackId">Track Location (Optional)</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("trackId", value)}
                    value={formData.trackId}
                  >
                    <SelectTrigger id="trackId">
                      <SelectValue placeholder="Select a track (optional)" />
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
                      className={getFieldError("Make") ? "border-destructive" : ""}
                      id="make"
                      name="make"
                      onChange={handleChange}
                      placeholder="Porsche"
                      required
                      value={formData.make}
                    />
                    {getFieldError("Make") && (
                      <p className="text-destructive text-xs">Make is required</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model *</Label>
                    <Input
                      className={getFieldError("Model") ? "border-destructive" : ""}
                      id="model"
                      name="model"
                      onChange={handleChange}
                      placeholder="911 GT3"
                      required
                      value={formData.model}
                    />
                    {getFieldError("Model") && (
                      <p className="text-destructive text-xs">Model is required</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      className={getFieldError("Year") ? "border-destructive" : ""}
                      id="year"
                      name="year"
                      onChange={handleChange}
                      placeholder="2023"
                      required
                      type="number"
                      value={formData.year}
                    />
                    {getFieldError("Year") && (
                      <p className="text-destructive text-xs">Year is required</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dailyRate">Daily Rate ($) *</Label>
                    <Input
                      className={getFieldError("Daily Rate") ? "border-destructive" : ""}
                      id="dailyRate"
                      name="dailyRate"
                      onChange={handleChange}
                      placeholder="899"
                      required
                      type="number"
                      value={formData.dailyRate}
                    />
                    {getFieldError("Daily Rate") && (
                      <p className="text-destructive text-xs">Daily Rate is required</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="horsepower">Horsepower (Optional)</Label>
                    <Input
                      id="horsepower"
                      name="horsepower"
                      onChange={handleChange}
                      placeholder="500"
                      type="number"
                      value={formData.horsepower}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transmission">Transmission (Optional)</Label>
                    <Select
                      onValueChange={(value) => handleSelectChange("transmission", value)}
                      value={formData.transmission}
                    >
                      <SelectTrigger id="transmission">
                        <SelectValue placeholder="Select transmission" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSMISSION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="drivetrain">Drivetrain (Optional)</Label>
                    <Select
                      onValueChange={(value) => handleSelectChange("drivetrain", value)}
                      value={formData.drivetrain}
                    >
                      <SelectTrigger id="drivetrain">
                        <SelectValue placeholder="Select drivetrain" />
                      </SelectTrigger>
                      <SelectContent>
                        {DRIVETRAIN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    className={`min-h-32 ${getFieldError("Description") ? "border-destructive" : ""}`}
                    id="description"
                    name="description"
                    onChange={handleChange}
                    placeholder="Describe your vehicle, its condition, track readiness, and what makes it special..."
                    required
                    value={formData.description}
                  />
                  {getFieldError("Description") ? (
                    <p className="text-destructive text-xs">Description is required</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Provide a detailed description to attract renters
                    </p>
                  )}
                </div>

                {/* Location Section */}
                <div className="border-t pt-6">
                  <h3 className="mb-4 font-semibold">Pickup Location</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="street">Street Address *</Label>
                      <Input
                        className={getFieldError("Street Address") ? "border-destructive" : ""}
                        id="street"
                        name="street"
                        onChange={handleChange}
                        placeholder="123 Main Street"
                        required
                        value={formData.street}
                      />
                      {getFieldError("Street Address") && (
                        <p className="text-destructive text-xs">Street Address is required</p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          className={getFieldError("City") ? "border-destructive" : ""}
                          id="city"
                          name="city"
                          onChange={handleChange}
                          placeholder="Los Angeles"
                          required
                          value={formData.city}
                        />
                        {getFieldError("City") && (
                          <p className="text-destructive text-xs">City is required</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input
                          className={getFieldError("State") ? "border-destructive" : ""}
                          id="state"
                          maxLength={2}
                          name="state"
                          onChange={handleChange}
                          placeholder="CA"
                          required
                          value={formData.state}
                        />
                        {getFieldError("State") && (
                          <p className="text-destructive text-xs">State is required</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP Code *</Label>
                      <Input
                        className={getFieldError("ZIP Code") ? "border-destructive" : ""}
                        id="zipCode"
                        maxLength={10}
                        name="zipCode"
                        onChange={handleChange}
                        placeholder="90001"
                        required
                        value={formData.zipCode}
                      />
                      {getFieldError("ZIP Code") && (
                        <p className="text-destructive text-xs">ZIP Code is required</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Photos */}
            {currentStep === 2 && (
              <>
                <div className="space-y-4">
                  <div>
                    <Label>Vehicle Photos *</Label>
                    {getFieldError("At least one photo") ? (
                      <p className="text-destructive text-xs">
                        Please upload at least one photo. The first image will be used as the main
                        image.
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Upload at least one photo. The first image will be used as the main image.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {images.map((image, index) => (
                      <div className="relative" key={index}>
                        <div className="relative size-32 overflow-hidden rounded-lg border">
                          <img
                            alt={`Preview ${index + 1}`}
                            className="size-full object-cover"
                            src={image.preview}
                          />
                          {index === 0 && (
                            <div className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 font-medium text-primary-foreground text-xs">
                              Primary
                            </div>
                          )}
                        </div>
                        <Button
                          className="-right-2 -top-2 absolute size-6 rounded-full p-0"
                          onClick={() => removeImage(index)}
                          size="icon"
                          type="button"
                          variant="destructive"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}

                    <label
                      className={`flex size-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                        getFieldError("At least one photo")
                          ? "border-destructive"
                          : "border-muted-foreground/25 hover:border-primary"
                      }`}
                    >
                      <div className="text-center">
                        <Upload
                          className={`mx-auto mb-2 size-6 ${
                            getFieldError("At least one photo")
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`text-xs ${
                            getFieldError("At least one photo")
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          Add Photo
                        </span>
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

            {/* Step 3: Amenities & Add-ons */}
            {currentStep === 3 && (
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
                        className="justify-start"
                        key={amenity}
                        onClick={(e) => {
                          e.preventDefault()
                          toggleAmenity(amenity)
                        }}
                        type="button"
                        variant={formData.amenities.includes(amenity) ? "default" : "outline"}
                      >
                        {formData.amenities.includes(amenity) && (
                          <CheckCircle2 className="mr-2 size-4" />
                        )}
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
                          className="flex items-center justify-between rounded-lg border p-3"
                          key={index}
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
              <Button
                disabled={currentStep === 1}
                onClick={prevStep}
                type="button"
                variant="outline"
              >
                Previous
              </Button>
              {currentStep < 3 ? (
                <Button
                  onClick={nextStep}
                  type="button"
                  variant={validationAttempted && !validateStep(currentStep) ? "destructive" : "default"}
                >
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

