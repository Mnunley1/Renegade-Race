"use client"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { Loader2, Send } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

export default function MassEmailsPage() {
  const sendMassEmail = useMutation(api.emails.sendMassEmail)
  const [recipientType, setRecipientType] = useState<"all" | "owners" | "renters" | "custom">("all")
  const [customRecipients, setCustomRecipients] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlContent, setHtmlContent] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!(subject.trim() && htmlContent.trim())) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSending(true)

    try {
      const customEmails =
        recipientType === "custom"
          ? customRecipients
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean)
          : undefined

      const result = await sendMassEmail({
        recipientType,
        customRecipients: customEmails,
        subject,
        htmlContent,
      })

      toast.success(`Email sent successfully! ${result.successful} sent, ${result.failed} failed`)

      // Reset form
      setSubject("")
      setHtmlContent("")
      setCustomRecipients("")
    } catch (error) {
      handleErrorWithContext(error, { action: "send emails", entity: "emails" })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Mass Emails</h1>
        <p className="mt-2 text-muted-foreground">Send emails to users, owners, or renters</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compose Email</CardTitle>
          <CardDescription>Select recipients and compose your email message</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="recipientType">Recipients</Label>
              <Select
                onValueChange={(value: "all" | "owners" | "renters" | "custom") =>
                  setRecipientType(value)
                }
                value={recipientType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="owners">Vehicle Owners Only</SelectItem>
                  <SelectItem value="renters">Renters Only</SelectItem>
                  <SelectItem value="custom">Custom List</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recipientType === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customRecipients">Email Addresses (comma-separated)</Label>
                <Textarea
                  id="customRecipients"
                  onChange={(e) => setCustomRecipients(e.target.value)}
                  placeholder="user1@example.com, user2@example.com"
                  rows={3}
                  value={customRecipients}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                required
                value={subject}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="htmlContent">Email Body (HTML) *</Label>
              <Textarea
                className="font-mono text-sm"
                id="htmlContent"
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<p>Your email content here...</p>"
                required
                rows={10}
                value={htmlContent}
              />
              <p className="text-muted-foreground text-xs">
                HTML content is supported. A plain text version will be automatically generated.
              </p>
            </div>

            <Button className="w-full" disabled={isSending} size="lg" type="submit">
              {isSending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  Send Email
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
