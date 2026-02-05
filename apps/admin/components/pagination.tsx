"use client"

import { Button } from "@workspace/ui/components/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  hasMore?: boolean
  onLoadMore?: () => void
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  hasMore,
  onLoadMore,
}: PaginationProps) {
  const pages = []
  const maxVisiblePages = 5

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground text-sm">
        Page {currentPage} of {totalPages || 1}
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          size="sm"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        {startPage > 1 && (
          <>
            <Button onClick={() => onPageChange(1)} size="sm" variant="outline">
              1
            </Button>
            {startPage > 2 && <span className="text-muted-foreground">...</span>}
          </>
        )}

        {pages.map((page) => (
          <Button
            key={page}
            onClick={() => onPageChange(page)}
            size="sm"
            variant={currentPage === page ? "default" : "outline"}
          >
            {page}
          </Button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-muted-foreground">...</span>}
            <Button onClick={() => onPageChange(totalPages)} size="sm" variant="outline">
              {totalPages}
            </Button>
          </>
        )}

        <Button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          size="sm"
          variant="outline"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>

        {hasMore && onLoadMore && (
          <Button onClick={onLoadMore} size="sm" variant="outline">
            Load More
          </Button>
        )}
      </div>
    </div>
  )
}
