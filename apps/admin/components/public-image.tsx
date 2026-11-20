"use client"

import { ImagePlaceholder } from "@workspace/ui/components/image-placeholder"
import { publicImageSource } from "@workspace/ui/lib/public-media"
import { type ComponentProps, useState } from "react"

type Props = ComponentProps<"img">
export default function PublicImage({ src, ...props }: Props) {
  const source = publicImageSource(src)
  return <SourceImage {...props} key={source ?? "missing"} src={source} />
}
function SourceImage({ src, onError, ...props }: Props) {
  const [failed, setFailed] = useState(false)
  if (!src || failed)
    return (
      <ImagePlaceholder
        alt={props.alt ?? "Image"}
        className={props.className}
        style={{ width: props.width, height: props.height, ...props.style }}
      />
    )
  return (
    <img
      {...props}
      alt={props.alt ?? ""}
      onError={(event) => {
        setFailed(true)
        onError?.(event)
      }}
      src={src}
    />
  )
}
