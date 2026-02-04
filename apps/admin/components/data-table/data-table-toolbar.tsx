"use client"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Download, Search, SlidersHorizontal, X } from "lucide-react"

export interface FilterOption {
  label: string
  value: string
}

export interface FilterConfig {
  key: string
  label: string
  options: FilterOption[]
  value?: string
  onChange: (value: string | undefined) => void
}

export interface DataTableToolbarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterConfig[]
  columnVisibility?: { key: string; label: string; visible: boolean }[]
  onColumnVisibilityChange?: (key: string, visible: boolean) => void
  onExport?: () => void
  actions?: React.ReactNode
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  columnVisibility,
  onColumnVisibilityChange,
  onExport,
  actions,
}: DataTableToolbarProps) {
  const hasActiveFilters = filters?.some((f) => f.value !== undefined)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearchChange && (
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            value={search ?? ""}
          />
          {search && (
            <button
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {filters?.map((filter) => (
        <DropdownMenu key={filter.key}>
          <DropdownMenuTrigger asChild>
            <Button className="h-9" size="sm" variant={filter.value ? "default" : "outline"}>
              {filter.label}
              {filter.value && (
                <span className="ml-1.5 rounded-sm bg-primary-foreground/20 px-1 text-xs">
                  {filter.options.find((o) => o.value === filter.value)?.label}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem
              checked={filter.value === undefined}
              onCheckedChange={() => filter.onChange(undefined)}
            >
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {filter.options.map((option) => (
              <DropdownMenuCheckboxItem
                checked={filter.value === option.value}
                key={option.value}
                onCheckedChange={() =>
                  filter.onChange(filter.value === option.value ? undefined : option.value)
                }
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}

      {hasActiveFilters && (
        <Button
          className="h-9"
          onClick={() => filters?.forEach((f) => f.onChange(undefined))}
          size="sm"
          variant="ghost"
        >
          Clear filters
          <X className="ml-1 h-3.5 w-3.5" />
        </Button>
      )}

      <div className="flex-1" />

      {columnVisibility && onColumnVisibilityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9" size="sm" variant="outline">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columnVisibility.map((col) => (
              <DropdownMenuCheckboxItem
                checked={col.visible}
                key={col.key}
                onCheckedChange={(checked) => onColumnVisibilityChange(col.key, !!checked)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {onExport && (
        <Button className="h-9" onClick={onExport} size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      )}

      {actions}
    </div>
  )
}
