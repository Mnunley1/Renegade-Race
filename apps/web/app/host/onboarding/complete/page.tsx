"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useMutation } from "convex/react"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { api } from "@/lib/convex"

export default function OnboardingCompletePage() {
  const router = useRouter()
  const completeOnboarding = useMutation(api.users.completeHostOnboarding)

  useEffect(() => {
    // Mark onboarding as complete
    void completeOnboarding()
  }, [completeOnboarding])

  const handleGoToDashboard = () => {
    router.push("/host/dashboard")
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="font-bold text-3xl">Congratulations!</CardTitle>
          <CardDescription className="text-base">
            You've completed the host onboarding process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-center">
            <p className="font-medium">Your vehicle listing is ready!</p>
            <p className="text-muted-foreground text-sm">
              Your vehicle is now pending approval. Once approved, it will be visible to renters on
              the platform.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-2 font-medium">What's next?</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
              <li>Wait for your vehicle to be approved by our team</li>
              <li>Set your vehicle's availability calendar</li>
              <li>Respond to booking requests</li>
              <li>Start earning rental income!</li>
            </ul>
          </div>

          <div className="flex justify-center pt-4">
            <Button onClick={handleGoToDashboard} size="lg">
              Go to Dashboard
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
