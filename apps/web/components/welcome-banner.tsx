"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { X } from "lucide-react"
import { useState } from "react"

export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  if (dismissed) return null

  return (
    <>
      <div className="relative border-b bg-primary px-4 py-2 text-center text-primary-foreground text-sm">
        <span className="font-medium">Welcome to the new Renegade!</span>{" "}
        <button
          className="underline underline-offset-2 hover:opacity-80"
          onClick={() => setModalOpen(true)}
          type="button"
        >
          Read more
        </button>
        <button
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm p-0.5 hover:opacity-80"
          onClick={() => setDismissed(true)}
          type="button"
        >
          <X className="size-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>

      <Dialog onOpenChange={setModalOpen} open={modalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome to the New Renegade</DialogTitle>
            <DialogDescription>
              We&apos;ve been hard at work rebuilding the platform from the ground up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Whether you&apos;re a returning member or joining us for the first time — welcome!
              We&apos;ve rebuilt the Renegade experience to make finding and renting track cars
              faster, easier, and more reliable.
            </p>
            <p>
              As with any new launch, you may encounter the occasional rough edge. If something
              doesn&apos;t look right or work as expected, please bear with us — we&apos;re actively
              improving things every day.
            </p>
            <p>
              Please don&apos;t hesitate to contact us if you have any questions or run into any
              issues.
            </p>
            <p className="text-muted-foreground">
              Thanks for being part of the Renegade community.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setModalOpen(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
