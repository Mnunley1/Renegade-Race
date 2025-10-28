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
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ResetPasswordPage() {
  return (
    <div className="flex items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-4">
            <Link
              className="inline-flex items-center text-muted-foreground text-sm hover:text-primary"
              href="/sign-in"
            >
              <ArrowLeft className="mr-2 size-4" />
              Back to sign in
            </Link>
          </div>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" placeholder="you@example.com" required type="email" />
            </div>
            <Button className="w-full" type="submit">
              Send Reset Link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
