"use client"

import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu"
import { Search, SlidersHorizontal, X, Download } from "lucide-react"

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
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {filters?.map((filter) => (
        <DropdownMenu key={filter.key}>
          <DropdownMenuTrigger asChild>
            <Button variant={filter.value ? "default" : "outline"} size="sm" className="h-9">
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
                key={option.value}
                checked={filter.value === option.value}
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
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => filters?.forEach((f) => f.onChange(undefined))}
        >
          Clear filters
          <X className="ml-1 h-3.5 w-3.5" />
        </Button>
      )}

      <div className="flex-1" />

      {columnVisibility && onColumnVisibilityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columnVisibility.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={col.visible}
                onCheckedChange={(checked) => onColumnVisibilityChange(col.key, !!checked)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {onExport && (
        <Button variant="outline" size="sm" className="h-9" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      )}

      {actions}
    </div>
  )
}
