"use client"

import { cn } from "@workspace/ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

const toggleGroupVariants = cva("inline-flex items-center rounded-lg bg-muted p-1", {
  variants: {
    size: {
      default: "h-9",
      sm: "h-8",
      lg: "h-10",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 font-medium text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      size: {
        default: "h-7 text-sm",
        sm: "h-6 text-xs",
        lg: "h-8 text-sm",
      },
      active: {
        true: "bg-background text-foreground shadow-sm",
        false: "text-muted-foreground hover:bg-background/50 hover:text-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      active: false,
    },
  }
)

type ToggleGroupProps = {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
} & VariantProps<typeof toggleGroupVariants>

type ToggleGroupItemProps = {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
} & VariantProps<typeof toggleGroupItemVariants>

const ToggleGroupContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
  size?: "default" | "sm" | "lg" | null
}>({
  value: "",
  onValueChange: () => {},
})

function ToggleGroup({ value, onValueChange, children, className, size }: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange, size }}>
      <div className={cn(toggleGroupVariants({ size }), className)} role="radiogroup">
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}

function ToggleGroupItem({ value, children, className, disabled }: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext)
  const isActive = context.value === value

  return (
    <button
      aria-checked={isActive}
      className={cn(toggleGroupItemVariants({ size: context.size, active: isActive }), className)}
      disabled={disabled}
      onClick={() => context.onValueChange(value)}
      role="radio"
      type="button"
    >
      {children}
    </button>
  )
}

export { ToggleGroup, ToggleGroupItem, toggleGroupVariants, toggleGroupItemVariants }
