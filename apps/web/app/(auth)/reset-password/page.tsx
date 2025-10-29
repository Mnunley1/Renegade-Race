import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="mb-2 font-bold text-3xl">Reset Password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      <Card className="border-2 shadow-xl">
        <CardHeader>
          <div className="mb-4">
            <Link
              className="inline-flex items-center text-muted-foreground text-sm transition-colors hover:text-primary"
              href="/sign-in"
            >
              <ArrowLeft className="mr-2 size-4" />
              Back to sign in
            </Link>
          </div>
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <CardDescription>
            No worries! Enter your email below and we'll send you instructions to reset it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  id="email"
                  placeholder="you@example.com"
                  required
                  type="email"
                />
              </div>
              <p className="text-muted-foreground text-sm">
                We'll send you a reset link within a few minutes
              </p>
            </div>
            <Button className="w-full" size="lg" type="submit">
              Send Reset Link
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Remember your password?{" "}
              <Link
                className="font-medium text-primary transition-colors hover:text-primary/80"
                href="/sign-in"
              >
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Additional help section */}
      <Card className="border bg-muted/30">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Mail className="size-3 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Check your spam folder</p>
                <p className="text-muted-foreground text-sm">
                  The email might take a few minutes to arrive
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
