"use client"

import { Checkbox } from "@workspace/ui/components/checkbox"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useMemo, useState } from "react"

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  sortValue?: (row: T) => string | number | Date
  hidden?: boolean
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  toolbar?: React.ReactNode
  bulkActions?: React.ReactNode
  pagination?: React.ReactNode
  getRowId: (row: T) => string
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  emptyMessage?: string
}

type SortDirection = "asc" | "desc" | null

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  toolbar,
  bulkActions,
  pagination,
  getRowId,
  selectedIds = new Set(),
  onSelectionChange,
  emptyMessage = "No results found",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const visibleColumns = columns.filter((col) => !col.hidden)

  const sortedData = useMemo(() => {
    if (!(sortKey && sortDirection)) return data
    const column = columns.find((c) => c.key === sortKey)
    if (!column?.sortValue) return data

    return [...data].sort((a, b) => {
      const aVal = column.sortValue?.(a) ?? ""
      const bVal = column.sortValue?.(b) ?? ""
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [data, sortKey, sortDirection, columns])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc")
      else if (sortDirection === "desc") {
        setSortKey(null)
        setSortDirection(null)
      }
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  const allSelected = data.length > 0 && data.every((row) => selectedIds.has(getRowId(row)))
  const _someSelected = data.some((row) => selectedIds.has(getRowId(row))) && !allSelected

  const toggleAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(data.map(getRowId)))
    }
  }

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  return (
    <div className="space-y-4">
      {toolbar}
      {selectedIds.size > 0 && bulkActions && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
          <span className="font-medium text-sm">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {onSelectionChange && (
                  <th className="w-12 p-3">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    className={`p-3 text-left font-medium text-muted-foreground ${col.className ?? ""} ${
                      col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""
                    }`}
                    key={col.key}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span className="text-muted-foreground/50">
                          {sortKey === col.key && sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : sortKey === col.key && sortDirection === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr className="border-b" key={`skeleton-${i}`}>
                    {onSelectionChange && (
                      <td className="p-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td className="p-3" key={col.key}>
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sortedData.length === 0 ? (
                <tr>
                  <td
                    className="p-8 text-center text-muted-foreground"
                    colSpan={visibleColumns.length + (onSelectionChange ? 1 : 0)}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => {
                  const id = getRowId(row)
                  const selected = selectedIds.has(id)
                  return (
                    <tr
                      className={`border-b transition-colors hover:bg-muted/50 ${
                        selected ? "bg-primary/5" : ""
                      }`}
                      key={id}
                    >
                      {onSelectionChange && (
                        <td className="p-3">
                          <Checkbox checked={selected} onCheckedChange={() => toggleRow(id)} />
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td className={`p-3 ${col.className ?? ""}`} key={col.key}>
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {pagination}
    </div>
  )
}
