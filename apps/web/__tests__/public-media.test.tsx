import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { publicImageSource, publicMediaUrl } from "@workspace/ui/lib/public-media"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import HomePage from "@/app/page"
import PublicImage from "@/components/public-image"
import { TeamCard } from "@/components/team-card"
import { VehicleCard } from "@/components/vehicle-card"
import { VehicleGallery } from "@/components/vehicle-gallery"
import { r2Url } from "@/lib/r2-url"
import AdminImage from "../../admin/components/public-image"
import { VehicleImageGallery as AdminGallery } from "../../admin/components/vehicle-image-gallery"
import { r2Url as adminR2Url } from "../../admin/lib/r2-url"

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    quality: _quality,
    unoptimized: _unoptimized,
    ...props
  }: ComponentProps<"img"> & {
    fill?: boolean
    priority?: boolean
    quality?: number
    unoptimized?: boolean
  }) => <img {...props} alt={props.alt ?? ""} />,
}))
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ isSignedIn: false }) }))
vi.mock("convex/react", () => ({ useQuery: () => null, useMutation: () => vi.fn() }))
vi.mock("@/components/home/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

const origin = "https://public.example.test"
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", origin))
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("public media URL construction", () => {
  it.each([
    undefined,
    null,
    "",
    " ",
    "undefined",
    "not a URL",
    "http://example.test",
    "//example.test",
    "https://user:pass@example.test",
    "https://example.test/bucket",
    "https://example.test?token=secret",
    "https://example.test#fragment",
  ])("rejects invalid public origin %s without a fallback bucket", (base) => {
    expect(publicMediaUrl(base, "images/vehicles/car/photo")).toBeUndefined()
  })

  it.each([
    undefined,
    null,
    "",
    "  ",
    "/",
    "//other.test/image",
    "https://other.test/image",
    "javascript:alert(1)",
    "legacy:renter:0",
    "legacy%3Arenter%3A0",
    "images/returns/booking/photo",
    "images%2Freturns%2Fbooking%2Fphoto",
    "../private/photo",
    "images/%2e%2e/private",
    "images\\photo",
    "images/photo?secret=x",
    "images/photo#x",
    "images/%",
    "images/\u0000photo",
  ])("rejects invalid or protected key %s", (key) => {
    expect(publicMediaUrl(origin, key)).toBeUndefined()
  })

  it("normalizes only the boundary slash and encodes literal key segments", () => {
    expect(publicMediaUrl(`${origin}/`, "/images/vehicles/car/track photo.jpg")).toBe(
      `${origin}/images/vehicles/car/track%20photo.jpg`
    )
    expect(publicMediaUrl(origin, "images/vehicles/car/雪.jpg")).toBe(
      `${origin}/images/vehicles/car/%E9%9B%AA.jpg`
    )
    expect(publicMediaUrl(origin, "site-media/video.mp4")).toBe(`${origin}/site-media/video.mp4`)
  })

  it("keeps both app wrappers configuration-driven and null-safe", () => {
    for (const builder of [r2Url, adminR2Url]) {
      expect(builder("images/test.jpg")).toBe(`${origin}/images/test.jpg`)
      vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "")
      expect(builder("images/test.jpg")).toBeUndefined()
      vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", origin)
    }
  })

  it("accepts supported legacy URLs/local previews and rejects protected references", () => {
    expect(publicImageSource("https://images.unsplash.com/photo.jpg?w=400")).toBe(
      "https://images.unsplash.com/photo.jpg?w=400"
    )
    expect(publicImageSource("/images/hero-vid-thumbnail.png")).toBe(
      "/images/hero-vid-thumbnail.png"
    )
    expect(publicImageSource("blob:https://example.test/preview")).toBe(
      "blob:https://example.test/preview"
    )
    for (const value of [
      "undefined/photo",
      "legacy:renter:0",
      "javascript:x",
      "data:text/html,x",
      "https://public.example.test/images/returns/booking/photo",
      "https://backend.convex.site/return-photo?key=secret",
      "//example.test/photo",
    ]) {
      expect(publicImageSource(value)).toBeUndefined()
    }
  })
})

describe.each([
  ["web", PublicImage],
  ["admin", AdminImage],
] as const)("%s public image fallback", (_name, Image) => {
  it.each([
    undefined,
    "",
    "undefined/photo",
    "javascript:x",
  ])("renders a local placeholder without an image request for %s", (src) => {
    const { container } = render(<Image alt="Car" src={src} />)
    expect(screen.getByRole("img", { name: "Car unavailable" })).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })

  it("falls back after loading fails and retries when the source changes", () => {
    const first = `${origin}/first.jpg`
    const second = `${origin}/second.jpg`
    const { rerender } = render(<Image alt="Car" src={first} />)
    fireEvent.error(screen.getByAltText("Car"))
    expect(screen.getByRole("img", { name: "Car unavailable" })).toBeInTheDocument()
    rerender(<Image alt="Car" src={second} />)
    expect(screen.getByAltText("Car")).toHaveAttribute("src", second)
    rerender(<Image alt="Car" src={first} />)
    expect(screen.getByAltText("Car")).toHaveAttribute("src", first)
  })
})

describe("public media cards and galleries", () => {
  it("loads configured home videos directly and shows local images after media failure", () => {
    const { container } = render(<HomePage />)
    const videos = container.querySelectorAll("video")
    expect(videos).toHaveLength(2)
    expect(videos[0]).toHaveAttribute("src", `${origin}/site-media/renegade-hero-video.mp4`)
    expect(videos[1]).toHaveAttribute("src", `${origin}/site-media/Renegade_promo_video.mp4`)
    fireEvent.error(videos.item(0))
    fireEvent.error(videos.item(1))
    expect(container.querySelector("video")).toBeNull()
    expect(screen.getAllByAltText("Racing on track")).toHaveLength(2)
    for (const image of screen.getAllByAltText("Racing on track")) {
      expect(image).toHaveAttribute("src", "/images/clement-delacre-JuEQI7nssh0-unsplash.jpg")
    }
  })

  it("shows local home images without creating video requests when config is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "")
    const { container } = render(<HomePage />)
    expect(container.querySelector("video")).toBeNull()
    expect(screen.getAllByAltText("Racing on track")).toHaveLength(2)
  })

  const car = {
    id: "car",
    name: "Test Car",
    image: "",
    imageKey: "images/vehicles/car/photo",
    year: 2026,
    make: "Test",
    model: "Car",
    pricePerDay: 10000,
  }
  it("falls back for configured-key failures on the vehicle card, then recovers", () => {
    const { rerender } = render(<VehicleCard {...car} />)
    fireEvent.error(screen.getByAltText("2026 Test Car"))
    expect(screen.getByRole("img", { name: "2026 Test Car unavailable" })).toBeInTheDocument()
    rerender(<VehicleCard {...car} imageKey="images/vehicles/car/replacement" />)
    expect(screen.getByAltText("2026 Test Car")).toHaveAttribute(
      "src",
      `${origin}/images/vehicles/car/replacement`
    )
  })

  it("keeps a valid legacy card URL when bucket configuration is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "")
    render(<VehicleCard {...car} image="https://images.unsplash.com/car.jpg" />)
    expect(screen.getByAltText("2026 Test Car")).toHaveAttribute(
      "src",
      "https://images.unsplash.com/car.jpg"
    )
  })

  it("handles team logo failures and source changes", () => {
    const props = {
      id: "team",
      name: "Test Team",
      logoR2Key: "images/general/team/logo",
      location: "Test",
      specialties: [],
      availableSeats: 0,
    }
    const { rerender } = render(<TeamCard {...props} />)
    fireEvent.error(screen.getByAltText("Test Team"))
    expect(screen.getByRole("img", { name: "Test Team unavailable" })).toBeInTheDocument()
    rerender(<TeamCard {...props} logoR2Key="images/general/team/new" />)
    expect(screen.getByAltText("Test Team")).toHaveAttribute(
      "src",
      `${origin}/images/general/team/new`
    )
  })

  it("uses the empty-gallery state for unusable keys or missing configuration", () => {
    const { container, rerender } = render(
      <VehicleGallery
        images={["", "legacy:renter:0", "images/returns/booking/photo"]}
        vehicleName="Car"
      />
    )
    expect(screen.getByText("No images available")).toBeInTheDocument()
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "")
    rerender(<VehicleGallery images={["images/vehicles/car/photo"]} vehicleName="Car" />)
    expect(screen.getByText("No images available")).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })

  it("closes stale web gallery selection when sources change and displays the new list", () => {
    const { rerender } = render(
      <VehicleGallery images={["images/1", "images/2", "images/3"]} vehicleName="Car" />
    )
    fireEvent.click(screen.getByRole("button", { name: "View Car image 3 in full screen" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    rerender(<VehicleGallery images={["images/new"]} vehicleName="Car" />)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByAltText("Car")).toHaveAttribute("src", `${origin}/images/new`)
    fireEvent.error(screen.getByAltText("Car"))
    expect(screen.getByRole("img", { name: "Car unavailable" })).toBeInTheDocument()
  })

  it("resets admin gallery selection for a shorter list and recovers from image failure", () => {
    const images = [1, 2, 3].map((n) => ({ _id: String(n), r2Key: `images/${n}` }))
    const { rerender } = render(<AdminGallery images={images} name="Car" />)
    fireEvent.click(screen.getByRole("button", { name: "Car - 3" }))
    expect(screen.getByAltText("Car")).toHaveAttribute("src", `${origin}/images/3`)
    fireEvent.error(screen.getByAltText("Car"))
    expect(screen.getByRole("img", { name: "Car unavailable" })).toBeInTheDocument()
    rerender(<AdminGallery images={[{ _id: "new", r2Key: "images/new" }]} name="Car" />)
    expect(screen.getByAltText("Car")).toHaveAttribute("src", `${origin}/images/new`)
  })
})
