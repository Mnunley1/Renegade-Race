export default function OnboardingCompletePage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="mb-4 font-bold text-3xl">Stripe onboarding complete</h1>
      <p className="text-muted-foreground">
        Thanks for setting up your payouts. You can now manage bookings and earnings.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <a className="text-primary underline" href="/host/dashboard">
          Return to dashboard
        </a>
        <a className="text-primary underline" href="/host/dashboard#payouts">
          Open payouts card
        </a>
      </div>
    </div>
  )
}


