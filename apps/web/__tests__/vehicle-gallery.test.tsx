import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { VehicleGallery } from "@/components/vehicle-gallery"

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    quality: _quality,
    ...props
  }: ComponentProps<"img"> & {
    fill?: boolean
    priority?: boolean
    quality?: number
  }) => <img {...props} alt={props.alt ?? ""} />,
}))

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://public.example.test"))
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it.each([
  "close button",
  "Escape",
])("opens a single image and returns focus after %s", async (method) => {
  const user = userEvent.setup()
  render(<VehicleGallery images={["images/vehicles/car/photo"]} vehicleName="Test Car" />)
  const opener = screen.getByRole("button", { name: "View Test Car in full screen" })
  await user.click(opener)
  const dialog = screen.getByRole("dialog", { name: "Test Car photos" })
  expect(within(dialog).getByRole("img", { name: "Test Car - Image 1" })).toHaveAttribute(
    "src",
    "https://public.example.test/images/vehicles/car/photo"
  )
  expect(within(dialog).queryByRole("button", { name: "Next image" })).toBeNull()
  expect(within(dialog).queryByText("Use arrows to navigate")).toBeNull()
  if (method === "Escape") await user.keyboard("{Escape}")
  else await user.click(within(dialog).getByRole("button", { name: "Close gallery" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await waitFor(() => expect(opener).toHaveFocus())
})

it("opens a failed single image using the safe fallback and can reopen after Escape", async () => {
  const user = userEvent.setup()
  render(<VehicleGallery images={["images/vehicles/car/missing"]} vehicleName="Test Car" />)
  fireEvent.error(screen.getByRole("img", { name: "Test Car" }))
  const opener = screen.getByRole("button", { name: "View Test Car in full screen" })
  expect(within(opener).getByRole("img", { name: "Test Car unavailable" })).toBeInTheDocument()
  await user.click(opener)
  const dialog = screen.getByRole("dialog", { name: "Test Car photos" })
  fireEvent.error(within(dialog).getByRole("img", { name: "Test Car - Image 1" }))
  expect(
    within(dialog).getByRole("img", { name: "Test Car - Image 1 unavailable" })
  ).toBeInTheDocument()
  expect(dialog.querySelector("img")).toBeNull()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(opener).toHaveFocus())
  await user.keyboard("{Enter}")
  expect(screen.getByRole("dialog", { name: "Test Car photos" })).toBeInTheDocument()
})

it.each([
  { images: [] },
  { images: ["", "legacy:renter:0", "images/returns/booking/photo"] },
])("keeps unusable image galleries noninteractive: $images", ({ images }) => {
  render(<VehicleGallery images={images} vehicleName="Test Car" />)
  expect(screen.getByText("No images available")).toBeInTheDocument()
  expect(screen.queryByRole("button")).toBeNull()
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("preserves multi-image navigation and restores focus to the selected opening button", async () => {
  const user = userEvent.setup()
  render(<VehicleGallery images={["images/1", "images/2", "images/3"]} vehicleName="Test Car" />)
  const opener = screen.getByRole("button", { name: "View Test Car image 2 in full screen" })
  await user.click(opener)
  const dialog = screen.getByRole("dialog", { name: "Test Car photos" })
  expect(within(dialog).getByText("2 / 3")).toBeInTheDocument()
  await user.keyboard("{ArrowRight}")
  expect(within(dialog).getByText("3 / 3")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Next image" }))
  expect(within(dialog).getByText("1 / 3")).toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(opener).toHaveFocus())
})
