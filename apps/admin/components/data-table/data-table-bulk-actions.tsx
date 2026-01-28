"use client"

import { Button } from "@workspace/ui/components/button"
import type { LucideIcon } from "lucide-react"

export interface BulkAction {
  label: string
  icon?: LucideIcon
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
  onClick: () => void
}

interface DataTableBulkActionsProps {
  actions: BulkAction[]
}

export function DataTableBulkActions({ actions }: DataTableBulkActionsProps) {
  return (
    <>
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.label}
            variant={action.variant ?? "outline"}
            size="sm"
            onClick={action.onClick}
          >
            {Icon && <Icon className="mr-2 h-4 w-4" />}
            {action.label}
          </Button>
        )
      })}
    </>
  )
}
