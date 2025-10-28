import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

export interface InputProps extends React.ComponentProps<"input"> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      className={cn(
        "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground file:hover:bg-accent/10 file:hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-input dark:ring-ring/40",
        className
      )}
      data-slot="input"
      ref={ref}
      type={type}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
