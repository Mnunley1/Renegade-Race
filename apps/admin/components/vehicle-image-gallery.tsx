"use client"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Car, Eye } from "lucide-react"
import { useState } from "react"
import { r2Url } from "../lib/r2-url"
import PublicImage from "./public-image"

type Props = {
  images: { _id: string; isPrimary?: boolean; imageUrl?: string; r2Key?: string }[]
  name: string
}

export function VehicleImageGallery({ images, name }: Props) {
  return <ResolvedImageGallery images={images} key={JSON.stringify(images)} name={name} />
}

function ResolvedImageGallery({ images, name }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Car className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No images uploaded</p>
        </CardContent>
      </Card>
    )
  }

  const selectedImage = images[selectedIndex]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" />
          Photos ({images.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative overflow-hidden rounded-lg">
          <PublicImage
            alt={name}
            className="h-64 w-full object-cover"
            src={r2Url(selectedImage?.r2Key) ?? selectedImage?.imageUrl}
          />
          {selectedImage?.isPrimary && (
            <Badge className="absolute top-3 left-3 bg-black/60 text-white">Primary</Badge>
          )}
        </div>
        {images.length > 1 && (
          <div className="grid grid-cols-5 gap-2">
            {images.map((image, idx) => (
              <button
                className={`relative overflow-hidden rounded-md border-2 transition-all ${
                  idx === selectedIndex
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                key={image._id}
                onClick={() => setSelectedIndex(idx)}
                type="button"
              >
                <PublicImage
                  alt={`${name} - ${idx + 1}`}
                  className="h-16 w-full object-cover"
                  src={r2Url(image.r2Key) ?? image.imageUrl}
                />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
