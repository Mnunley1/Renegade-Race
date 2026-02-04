"use client"

import { useUser } from "@clerk/nextjs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { useMutation, useQuery } from "convex/react"
import { Ban, ShieldOff } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"

type BlockUserButtonProps = {
  userId: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function BlockUserButton({
  userId,
  variant = "outline",
  size = "sm",
}: BlockUserButtonProps) {
  const { user, isSignedIn } = useUser()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isBlocked = useQuery(
    api.userBlocks.isBlocked,
    isSignedIn && user?.id ? { userId: user.id, otherUserId: userId } : "skip"
  )

  const blockUser = useMutation(api.userBlocks.blockUser)
  const unblockUser = useMutation(api.userBlocks.unblockUser)

  if (!(isSignedIn && user?.id) || user.id === userId) {
    return null
  }

  const handleBlockToggle = async () => {
    setIsLoading(true)

    try {
      if (isBlocked) {
        await unblockUser({ blockedUserId: userId })
        toast.success("User unblocked", {
          description: "You can now see content from this user.",
        })
      } else {
        await blockUser({ blockedUserId: userId })
        toast.success("User blocked", {
          description: "You will no longer see content from this user.",
        })
      }
      setShowConfirmDialog(false)
    } catch (_error) {
      toast.error("Failed to update block status", {
        description: "Please try again later.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setShowConfirmDialog(true)} size={size} variant={variant}>
        {isBlocked ? (
          <>
            <ShieldOff className="mr-2 size-4" />
            Unblock
          </>
        ) : (
          <>
            <Ban className="mr-2 size-4" />
            Block
          </>
        )}
      </Button>

      <AlertDialog onOpenChange={setShowConfirmDialog} open={showConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBlocked ? "Unblock this user?" : "Block this user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBlocked
                ? "This user will be able to see your content and interact with you again."
                : "This user will not be able to see your content or interact with you. You can unblock them at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={handleBlockToggle}>
              {isLoading ? "Processing..." : isBlocked ? "Unblock" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
