"use client"

import { useUploadFile } from "@convex-dev/r2/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { useMutation, useQuery } from "convex/react"
import { ArrowRight, Loader2, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function PhotosPage() {
  const router = useRouter()
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const uploadFile = useUploadFile(api.r2)
  const saveDraft = useMutation(api.users.saveOnboardingDraft)
  const _draft = useQuery(api.users.getOnboardingDraft, {})

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) {
      return
    }

    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setImages((prev) => [...prev, { file, preview: reader.result as string }])
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleContinue = async () => {
    if (images.length === 0) {
      toast.error("Please upload at least one photo")
      return
    }

    setIsSubmitting(true)
    try {
      // Upload images to R2 sequentially
      const imageKeys: string[] = []
      for (let index = 0; index < images.length; index++) {
        const img = images[index]
        if (!img) continue
        try {
          // Add a small delay between uploads to avoid rate limiting
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          const key = await uploadFile(img.file)
          imageKeys.push(key)
        } catch (error) {
          handleErrorWithContext(error, {
            action: `upload image "${img.file.name}"`,
            customMessages: {
              file_upload: `Failed to upload ${img.file.name}. Please try again.`,
              generic: `Failed to upload ${img.file.name}. Please try again.`,
            },
          })
          throw new Error("Failed to upload image")
        }
      }

      // Store image keys in draft database (persists across sessions)
      const imageData = imageKeys.map((r2Key, index) => ({
        r2Key,
        isPrimary: index === 0,
        order: index,
      }))

      await saveDraft({
        images: imageData,
        currentStep: 3, // Save next step (amenities)
      })

      toast.success("Photos uploaded successfully!")
      router.push("/host/onboarding/amenities")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "upload photos",
        customMessages: {
          file_upload: "Failed to upload photos. Please try again.",
          generic: "Failed to upload photos. Please try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 md:py-16">
      <div className="mb-4 md:mb-8">
        <h1 className="mb-2 font-bold text-3xl">Vehicle Photos</h1>
        <p className="text-muted-foreground">
          Upload photos of your vehicle. At least one photo is required.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Photos</CardTitle>
          <CardDescription>
            Show off your vehicle with high-quality photos. The first image will be used as the main
            image.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Vehicle Photos *</Label>
              <p className="text-muted-foreground text-xs">
                Upload at least one photo. The first image will be used as the main image.
              </p>
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
                    className="absolute -top-2 -right-2 size-6 rounded-full p-0"
                    onClick={() => removeImage(index)}
                    size="icon"
                    type="button"
                    variant="destructive"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}

              <label className="flex size-32 cursor-pointer items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed transition-colors hover:border-primary">
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

          <div className="flex justify-end gap-4 pt-4">
            <Button disabled={images.length === 0 || isSubmitting} onClick={handleContinue}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  Continue to Amenities
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
