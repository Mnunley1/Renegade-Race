"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { useAction, useMutation } from "convex/react"
import { Loader2, Send, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

interface ParsedCsvUser {
  email: string
  name: string
  userType: string
}

function parseCsv(text: string): ParsedCsvUser[] {
  const lines = text.split("\n").filter((line) => line.trim())
  // Skip header row
  if (lines.length <= 1) return []

  const users: ParsedCsvUser[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = (lines[i] as string).split(",").map((c) => c.trim())
    const email = (cols[1] ?? "") as string
    const name = (cols[3] ?? "") as string
    const userType = (cols[9] ?? "") as string
    if (email) {
      users.push({ email, name, userType })
    }
  }
  return users
}

export default function MassEmailsPage() {
  const sendMassEmail = useMutation(api.emails.sendMassEmail)
  const sendReturningUserInvites = useAction(api.emails.sendReturningUserInvites)
  const [recipientType, setRecipientType] = useState<"all" | "owners" | "renters" | "custom">("all")
  const [customRecipients, setCustomRecipients] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlContent, setHtmlContent] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Returning user invites state
  const [csvUsers, setCsvUsers] = useState<ParsedCsvUser[]>([])
  const [fixHostOnboarding, setFixHostOnboarding] = useState(true)
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ownerCount = csvUsers.filter(
    (u) => u.userType.toLowerCase() === "owner" || u.userType.toLowerCase() === "both"
  ).length

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

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const parsed = parseCsv(text)
      setCsvUsers(parsed)
      if (parsed.length === 0) {
        toast.error("No valid users found in CSV")
      }
    }
    reader.readAsText(file)
  }

  const handleSendInvites = async () => {
    if (csvUsers.length === 0) {
      toast.error("Please upload a CSV file first")
      return
    }

    setIsSendingInvites(true)

    try {
      const hostEmails = fixHostOnboarding
        ? csvUsers
            .filter(
              (u) => u.userType.toLowerCase() === "owner" || u.userType.toLowerCase() === "both"
            )
            .map((u) => u.email)
        : []

      const result = await sendReturningUserInvites({
        users: csvUsers.map((u) => ({ email: u.email, name: u.name })),
        fixHostOnboarding,
        hostEmails,
      })

      toast.success(
        `Invites sent! ${result.successful} sent, ${result.failed} failed${result.hostsFixed > 0 ? `, ${result.hostsFixed} hosts fixed` : ""}`
      )

      // Reset
      setCsvUsers([])
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (error) {
      handleErrorWithContext(error, { action: "send invites", entity: "emails" })
    } finally {
      setIsSendingInvites(false)
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

      <Card>
        <CardHeader>
          <CardTitle>Returning User Invites</CardTitle>
          <CardDescription>
            Upload a CSV of migrated users to send &quot;welcome back&quot; invite emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="csvFile">Upload CSV</Label>
            <Input
              accept=".csv"
              id="csvFile"
              onChange={handleCsvUpload}
              ref={fileInputRef}
              type="file"
            />
            <p className="text-muted-foreground text-xs">
              Expected format: ID, Email, Password, Full Name, ..., User Type (col 10)
            </p>
          </div>

          {csvUsers.length > 0 && (
            <>
              <div className="rounded-md border bg-muted/50 p-4">
                <p className="font-medium text-sm">
                  Found {csvUsers.length} users ({ownerCount} owners)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={fixHostOnboarding}
                  id="fixHostOnboarding"
                  onCheckedChange={(checked) => setFixHostOnboarding(checked === true)}
                />
                <Label className="font-normal" htmlFor="fixHostOnboarding">
                  Fix host onboarding for owners (mark as completed)
                </Label>
              </div>

              <Button
                className="w-full"
                disabled={isSendingInvites}
                onClick={handleSendInvites}
                size="lg"
              >
                {isSendingInvites ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Sending Invites...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 size-4" />
                    Send {csvUsers.length} Invites
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
