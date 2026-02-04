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
import { Separator } from "@workspace/ui/components/separator"
import { useMutation, useQuery } from "convex/react"
import { ArrowRight, CheckCircle2, Loader2, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { COMMON_AMENITIES } from "@/lib/constants"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function AmenitiesPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const draft = useQuery(api.users.getOnboardingDraft, {})
  const saveDraft = useMutation(api.users.saveOnboardingDraft)

  const [amenities, setAmenities] = useState<string[]>(draft?.vehicleData?.amenities || [])
  const [addOns, setAddOns] = useState<
    Array<{ name: string; price: number; description: string; isRequired: boolean }>
  >(
    (draft?.vehicleData?.addOns as Array<{
      name: string
      price: number
      description: string
      isRequired: boolean
    }>) || []
  )

  const [newAddOn, setNewAddOn] = useState({
    name: "",
    price: "",
    description: "",
    isRequired: false,
  })

  const toggleAmenity = (amenity: string) => {
    setAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    )
  }

  const addAddOn = () => {
    if (newAddOn.name && newAddOn.price) {
      setAddOns((prev) => [
        ...prev,
        {
          name: newAddOn.name,
          price: Number(newAddOn.price),
          description: newAddOn.description,
          isRequired: newAddOn.isRequired,
        },
      ])
      setNewAddOn({ name: "", price: "", description: "", isRequired: false })
    }
  }

  const removeAddOn = (index: number) => {
    setAddOns((prev) => prev.filter((_, i) => i !== index))
  }

  const handleContinue = async () => {
    if (!(draft?.vehicleData && draft?.address)) {
      toast.error("Missing vehicle data. Please go back and complete previous steps.")
      return
    }

    setIsSubmitting(true)
    try {
      // Update draft with amenities and add-ons
      await saveDraft({
        vehicleData: {
          ...draft.vehicleData,
          amenities,
          addOns,
        },
        currentStep: 4, // Save next step (availability)
      })

      router.push("/host/onboarding/availability")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "save amenities",
        customMessages: {
          generic: "Failed to save amenities. Please try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 md:py-16">
      <div className="mb-4 md:mb-8">
        <h1 className="mb-2 font-bold text-3xl">Amenities & Extras</h1>
        <p className="text-muted-foreground">
          Add amenities included with your vehicle and optional extras renters can purchase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Amenities</CardTitle>
          <CardDescription>
            Select all amenities that come standard with your vehicle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                variant={amenities.includes(amenity) ? "default" : "outline"}
              >
                {amenities.includes(amenity) && <CheckCircle2 className="mr-2 size-4" />}
                {amenity}
              </Button>
            ))}
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <Label>Add-ons (Optional)</Label>
              <p className="text-muted-foreground text-xs">
                Additional services or items renters can purchase
              </p>
            </div>

            {addOns.length > 0 && (
              <div className="space-y-2">
                {addOns.map((addOn, index) => (
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

          <div className="flex justify-end gap-4 pt-4">
            <Button disabled={isSubmitting} onClick={handleContinue}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue to Availability
                  <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
