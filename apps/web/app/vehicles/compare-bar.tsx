"use client"

import { Button } from "@workspace/ui/components/button"
import { X } from "lucide-react"
import type { VehicleItem } from "./types"

type CompareBarProps = {
  selectedVehicles: VehicleItem[]
  onRemove: (id: string) => void
  onCompare: () => void
  onClear: () => void
}

export function CompareBar({ selectedVehicles, onRemove, onCompare, onClear }: CompareBarProps) {
  if (selectedVehicles.length === 0) {
    return null
  }

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t bg-background p-3 shadow-lg md:bottom-0">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">Compare ({selectedVehicles.length})</span>
          <div className="hidden items-center gap-2 sm:flex">
            {selectedVehicles.map((v) => (
              <div
                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                key={v.id}
              >
                <span className="max-w-[120px] truncate">{v.name}</span>
                <button
                  aria-label={`Remove ${v.name} from comparison`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onRemove(v.id)}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onClear} size="sm" variant="ghost">
            Clear
          </Button>
          <Button disabled={selectedVehicles.length < 2} onClick={onCompare} size="sm">
            Compare
          </Button>
        </div>
      </div>
    </div>
  )
}
