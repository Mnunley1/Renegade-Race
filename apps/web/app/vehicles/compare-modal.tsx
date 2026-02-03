"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import type { VehicleItem } from "./types"

type CompareModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicles: VehicleItem[]
}

export function CompareModal({ open, onOpenChange, vehicles }: CompareModalProps) {
  if (vehicles.length < 2) {
    return null
  }

  const specs = [
    { label: "Price", render: (v: VehicleItem) => `$${v.pricePerDay}/day` },
    { label: "Weekend", render: (v: VehicleItem) => `$${Math.round(v.pricePerDay * 2.5)}/wknd` },
    { label: "Year", render: (v: VehicleItem) => String(v.year) },
    { label: "Make", render: (v: VehicleItem) => v.make },
    { label: "Model", render: (v: VehicleItem) => v.model },
    {
      label: "Horsepower",
      render: (v: VehicleItem) => (v.horsepower ? `${v.horsepower} HP` : "N/A"),
    },
    { label: "Transmission", render: (v: VehicleItem) => v.transmission || "N/A" },
    { label: "Drivetrain", render: (v: VehicleItem) => v.drivetrain || "N/A" },
    { label: "Location", render: (v: VehicleItem) => v.location || "N/A" },
    { label: "Track", render: (v: VehicleItem) => v.track || "N/A" },
    {
      label: "Rating",
      render: (v: VehicleItem) =>
        v.rating > 0 ? `${v.rating.toFixed(1)} (${v.reviews})` : "No reviews",
    },
  ]

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compare Vehicles</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Spec</th>
                {vehicles.map((v) => (
                  <th className="px-4 py-2 text-left font-semibold" key={v.id}>
                    {v.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {specs.map((spec) => (
                <tr className="border-b" key={spec.label}>
                  <td className="py-2 pr-4 text-muted-foreground">{spec.label}</td>
                  {vehicles.map((v) => (
                    <td className="px-4 py-2" key={v.id}>
                      {spec.render(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
