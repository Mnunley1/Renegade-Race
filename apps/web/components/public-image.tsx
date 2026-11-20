"use client"

import { ImagePlaceholder } from "@workspace/ui/components/image-placeholder"
import { publicImageSource } from "@workspace/ui/lib/public-media"
import { cn } from "@workspace/ui/lib/utils"
import NextImage, { type ImageProps } from "next/image"
import { type ReactNode, useState } from "react"

type Props = Omit<ImageProps, "src"> & { src?: ImageProps["src"] | null; fallback?: ReactNode }

export default function PublicImage({ src, ...props }: Props) {
  const source = typeof src === "string" ? publicImageSource(src) : (src ?? undefined)
  const identity =
    typeof source === "string"
      ? source
      : source && ("src" in source ? source.src : source.default.src)
  return <SourceImage {...props} key={identity ?? "missing"} src={source} />
}

function SourceImage({ src, fallback, onError, ...props }: Props) {
  const [failed, setFailed] = useState(false)
  if (!src || failed)
    return (
      <ImagePlaceholder
        alt={props.alt}
        className={cn(props.fill && "absolute inset-0", props.className)}
        style={{
          width: props.fill ? undefined : props.width,
          height: props.fill ? undefined : props.height,
          ...props.style,
        }}
      >
        {fallback}
      </ImagePlaceholder>
    )
  return (
    <NextImage
      {...props}
      onError={(event) => {
        setFailed(true)
        onError?.(event)
      }}
      src={src}
    />
  )
}
