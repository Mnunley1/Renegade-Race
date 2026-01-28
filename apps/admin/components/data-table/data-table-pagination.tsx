"use client"

import { Button } from "@workspace/ui/components/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface DataTablePaginationProps {
  page: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  hasMore?: boolean
}

export function DataTablePagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  hasMore,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)
  const start = page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {totalItems > 0
          ? `Showing ${start}-${end} of ${totalItems} results`
          : "No results"}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm">
          Page {page + 1}{totalPages > 0 ? ` of ${totalPages}` : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore && page >= totalPages - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
