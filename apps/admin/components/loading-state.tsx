import { Spinner } from "@workspace/ui/components/spinner"

export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
