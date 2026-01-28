"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { Car, LogIn, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"

interface LoginPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  redirectUrl?: string
}

export function LoginPromptDialog({
  open,
  onOpenChange,
  title = "Sign In Required",
  description = "Please sign in to save your favorite vehicles and access them anytime.",
  redirectUrl,
}: LoginPromptDialogProps) {
  const router = useRouter()

  const handleLogin = () => {
    onOpenChange(false)
    const url = redirectUrl || (typeof window !== "undefined" ? window.location.pathname : "/")
    router.push(`/sign-in?redirect_url=${encodeURIComponent(url)}`)
  }

  const handleSignUp = () => {
    onOpenChange(false)
    router.push("/sign-up")
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-0 bg-white/95 p-0 shadow-2xl backdrop-blur sm:max-w-md dark:bg-gray-900/95">
        <Card className="border-0 shadow-none">
          <CardContent className="p-8">
            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mb-4 flex items-center justify-center gap-2">
                <Car className="size-8 text-primary" />
                <span className="font-bold text-2xl text-foreground">Renegade Rentals</span>
              </div>
              <h2 className="mb-2 font-bold text-2xl text-foreground">{title}</h2>
              <p className="text-muted-foreground">{description}</p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleLogin}
                size="lg"
              >
                <LogIn className="mr-2 size-4" />
                Sign In
              </Button>

              <Button
                className="w-full border-border hover:bg-muted"
                onClick={handleSignUp}
                size="lg"
                variant="outline"
              >
                <UserPlus className="mr-2 size-4" />
                Create Account
              </Button>
            </div>

            {/* Additional info */}
            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                Join thousands of racing enthusiasts
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
