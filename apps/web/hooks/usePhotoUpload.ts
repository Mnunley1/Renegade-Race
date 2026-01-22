import { useUploadFile } from "@convex-dev/r2/react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { MAX_FILE_SIZE_BYTES, UPLOAD_DELAY_MS } from "@/lib/constants"
import { handleErrorWithContext } from "@/lib/error-handler"

type UsePhotoUploadOptions = {
  onUploadComplete?: (uploadedKeys: string[]) => void
  maxFiles?: number
}

export function usePhotoUpload(options: UsePhotoUploadOptions = {}) {
  const { onUploadComplete, maxFiles } = options
  const uploadFile = useUploadFile(api.r2)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const fileArray = Array.from(files)
      const uploadedKeys: string[] = []

      // Check max files limit
      if (maxFiles && photos.length + fileArray.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} photos allowed`)
        setIsUploading(false)
        return
      }

      for (let index = 0; index < fileArray.length; index++) {
        const file = fileArray[index]
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`)
          continue
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`${file.name} is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`)
          continue
        }

        try {
          // Add a small delay between uploads to avoid rate limiting
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, UPLOAD_DELAY_MS))
          }

          const r2Key = await uploadFile(file)
          uploadedKeys.push(r2Key)
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

      if (uploadedKeys.length > 0) {
        const newPhotos = [...photos, ...uploadedKeys]
        setPhotos(newPhotos)
        toast.success(`${uploadedKeys.length} photo(s) uploaded successfully`)
        onUploadComplete?.(uploadedKeys)
      }
    } catch (error) {
      handleErrorWithContext(error, {
        action: "upload photos",
        customMessages: {
          file_upload: "Failed to upload photos. Please try again.",
          generic: "Failed to upload photos. Please try again.",
        },
      })
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const clearPhotos = () => {
    setPhotos([])
  }

  return {
    photos,
    setPhotos,
    isUploading,
    fileInputRef,
    handlePhotoUpload,
    handleRemovePhoto,
    clearPhotos,
  }
}
