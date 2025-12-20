export default function OnboardingRefreshPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-4 font-bold text-3xl">Stripe onboarding paused</h1>
      <p className="text-muted-foreground">
        You can restart the Stripe onboarding flow to finish connecting your payouts.
      </p>
      <div className="mt-8 flex justify-center">
        <a className="text-primary underline" href="/host/dashboard">
          Return to dashboard
        </a>
      </div>
    </div>
  )
}


