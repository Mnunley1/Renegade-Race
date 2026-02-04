"use client"

import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

type ComboboxOption = {
  value: string
  label: string
  disabled?: boolean
}

type ComboboxProps = {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  triggerClassName?: string
  disabled?: boolean
}

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  triggerClassName,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(lower))
  }, [options, search])

  const selectedLabel = options.find((o) => o.value === value)?.label

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:text-base",
          !selectedLabel && "text-muted-foreground",
          triggerClassName
        )}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <svg
          className="size-4 shrink-0 opacity-50"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="m7 15 5 5 5-5" />
          <path d="m7 9 5-5 5 5" />
        </svg>
      </button>
      {open && (
        <div className="fade-in-0 zoom-in-95 absolute z-50 mt-1 w-full animate-in rounded-md border bg-popover p-1 shadow-md">
          <div className="px-2 pb-1.5">
            <input
              className="flex h-8 w-full rounded-md bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              ref={inputRef}
              value={search}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                {emptyMessage}
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent text-accent-foreground",
                    option.disabled && "pointer-events-none opacity-50"
                  )}
                  disabled={option.disabled}
                  key={option.value}
                  onClick={() => {
                    onValueChange(option.value)
                    setOpen(false)
                    setSearch("")
                  }}
                  type="button"
                >
                  <svg
                    className={cn(
                      "mr-2 size-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { Combobox, type ComboboxOption, type ComboboxProps }
