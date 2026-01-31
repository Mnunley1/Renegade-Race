"use client"

import { useUser } from "@clerk/nextjs"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import { useAction, useMutation, useQuery } from "convex/react"
import {
  Bell,
  CreditCard,
  Download,
  Info,
  Link2 as LinkIcon,
  Loader2,
  Mail,
  Monitor,
  Moon,
  Receipt,
  Shield,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  User,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

type Section = "account" | "security" | "billing" | "notifications" | "preferences"

type NavItem = {
  id: Section
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { id: "account", label: "Account", icon: <User className="size-4" /> },
  { id: "security", label: "Security", icon: <Shield className="size-4" /> },
  { id: "billing", label: "Billing", icon: <CreditCard className="size-4" /> },
  {
    id: "notifications",
    label: "Notifications",
    icon: <Bell className="size-4" />,
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: <SlidersHorizontal className="size-4" />,
  },
]

function PageSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="hidden w-[220px] shrink-0 space-y-1 md:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton className="h-10 w-full rounded-lg" key={i} />
          ))}
        </div>
        <div className="flex-1 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function BillingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div className="rounded-lg border p-4" key={i}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-28 shrink-0 text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm">
        {value || <span className="text-muted-foreground">Not set</span>}
      </span>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  heading,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  heading: string
  description: string
}) {
  return (
    <div className="py-10 text-center">
      <Icon className="mx-auto mb-3 size-10 text-muted-foreground/50" />
      <p className="font-medium text-muted-foreground">{heading}</p>
      <p className="mx-auto mt-1 max-w-sm text-muted-foreground/70 text-sm">{description}</p>
    </div>
  )
}

function NotificationRow({
  id,
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <Label className="font-semibold text-base" htmlFor={id}>
            {label}
          </Label>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      <Switch checked={checked} id={id} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          Paid
        </Badge>
      )
    case "draft":
      return <Badge variant="secondary">Draft</Badge>
    case "open":
      return <Badge variant="secondary">Open</Badge>
    case "void":
      return <Badge variant="secondary">Void</Badge>
    case "uncollectible":
      return <Badge variant="destructive">Uncollectible</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser()
  const router = useRouter()
  const user = useQuery(
    api.users.getByExternalId,
    clerkUser?.id ? { externalId: clerkUser.id } : "skip"
  )

  const [activeSection, setActiveSection] = useState<Section>("account")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  // Account editing
  const [isEditingAccount, setIsEditingAccount] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  useEffect(() => {
    if (clerkUser) {
      setFirstName(clerkUser.firstName || "")
      setLastName(clerkUser.lastName || "")
    }
  }, [clerkUser])

  const handleSaveAccount = async () => {
    if (!clerkUser) return
    setIsSavingAccount(true)
    try {
      await clerkUser.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })
      toast.success("Account information updated")
      setIsEditingAccount(false)
    } catch (error: unknown) {
      const clerkError = error as {
        errors?: Array<{ longMessage?: string; message?: string }>
      }
      const message =
        clerkError?.errors?.[0]?.longMessage
        || clerkError?.errors?.[0]?.message
        || (error instanceof Error ? error.message : null)
        || "Failed to update account. Please try again."
      toast.error(message)
    } finally {
      setIsSavingAccount(false)
    }
  }

  const handleCancelAccountEdit = () => {
    setFirstName(clerkUser?.firstName || "")
    setLastName(clerkUser?.lastName || "")
    setIsEditingAccount(false)
  }

  // Password management
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const hasPassword = clerkUser?.passwordEnabled ?? false

  const handleSavePassword = async () => {
    if (!clerkUser) return
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setIsSavingPassword(true)
    try {
      await clerkUser.updatePassword({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
      })
      toast.success(
        hasPassword ? "Password updated" : "Password created"
      )
      setIsChangingPassword(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: unknown) {
      // Clerk errors have an `errors` array with structured messages
      const clerkError = error as {
        errors?: Array<{ longMessage?: string; message?: string }>
      }
      const message =
        clerkError?.errors?.[0]?.longMessage
        || clerkError?.errors?.[0]?.message
        || (error instanceof Error ? error.message : null)
        || "Failed to update password. Please try again."
      toast.error(message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  // Notification preferences
  const notificationPreferences = useQuery(
    api.users.getNotificationPreferences,
    clerkUser?.id ? {} : "skip"
  )
  const updateNotificationPreferences = useMutation(api.users.updateNotificationPreferences)

  const [notificationSettings, setNotificationSettings] = useState({
    reservationUpdates: true,
    messages: true,
    reviewsAndRatings: true,
    paymentUpdates: true,
    marketing: false,
  })
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)

  useEffect(() => {
    if (notificationPreferences) {
      setNotificationSettings(notificationPreferences)
    }
  }, [notificationPreferences])

  const isNotificationsDirty = useMemo(() => {
    if (!notificationPreferences) {
      return false
    }
    return (
      notificationSettings.reservationUpdates !== notificationPreferences.reservationUpdates ||
      notificationSettings.messages !== notificationPreferences.messages ||
      notificationSettings.reviewsAndRatings !== notificationPreferences.reviewsAndRatings ||
      notificationSettings.paymentUpdates !== notificationPreferences.paymentUpdates ||
      notificationSettings.marketing !== notificationPreferences.marketing
    )
  }, [notificationSettings, notificationPreferences])

  // Billing
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false)
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)

  const getPaymentMethods = useAction(api.stripe.getCustomerPaymentMethods)
  const getInvoices = useAction(api.stripe.getCustomerInvoices)

  useEffect(() => {
    const loadBillingData = async () => {
      if (!user?.stripeCustomerId) {
        return
      }

      setIsLoadingPaymentMethods(true)
      setIsLoadingInvoices(true)

      try {
        const [methods, invoiceData] = await Promise.all([
          getPaymentMethods({ customerId: user.stripeCustomerId }),
          getInvoices({ customerId: user.stripeCustomerId, limit: 10 }),
        ])
        setPaymentMethods(methods)
        setInvoices(invoiceData)
      } catch (error) {
        handleErrorWithContext(error, {
          action: "load billing data",
        })
      } finally {
        setIsLoadingPaymentMethods(false)
        setIsLoadingInvoices(false)
      }
    }

    void loadBillingData()
  }, [user?.stripeCustomerId, getPaymentMethods, getInvoices])

  const formatCardBrand = (brand: string) => brand.charAt(0).toUpperCase() + brand.slice(1)

  const formatCurrency = (amount: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  const handleSaveNotificationPreferences = async () => {
    setIsSavingNotifications(true)
    try {
      await updateNotificationPreferences({
        preferences: notificationSettings,
      })
      toast.success("Notification preferences saved successfully")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "save notification preferences",
        customMessages: {
          generic: "Failed to save notification preferences. Please try again.",
        },
      })
    } finally {
      setIsSavingNotifications(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm account deletion')
      return
    }

    if (!clerkUser) {
      toast.error("Unable to delete account. Please try again.")
      return
    }

    setIsDeleting(true)
    try {
      await clerkUser.delete()
      toast.success("Account deleted successfully")
      router.push("/")
    } catch (error) {
      handleErrorWithContext(error, {
        action: "delete account",
        customMessages: {
          generic: "Failed to delete account. Please contact support if the issue persists.",
        },
      })
      setIsDeleting(false)
    }
  }

  // Loading state
  if (!isClerkLoaded) {
    return <PageSkeleton />
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-bold text-2xl tracking-tight">Settings</h1>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Mobile nav — horizontal scroll */}
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Button
              className={`shrink-0 gap-2 ${
                activeSection === item.id ? "bg-accent text-accent-foreground" : ""
              }`}
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              size="sm"
              variant="ghost"
            >
              {item.icon}
              {item.label}
            </Button>
          ))}
        </div>

        {/* Desktop sidebar */}
        <nav aria-label="Settings navigation" className="hidden w-[220px] shrink-0 md:block">
          <div className="sticky top-24 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  activeSection === item.id
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                type="button"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="min-w-0 max-w-3xl flex-1">
          {/* ============ ACCOUNT ============ */}
          {activeSection === "account" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Account Information</CardTitle>
                      <CardDescription>Your personal details</CardDescription>
                    </div>
                    {!isEditingAccount && (
                      <Button
                        onClick={() => setIsEditingAccount(true)}
                        size="sm"
                        variant="outline"
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditingAccount ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="first-name">First Name</Label>
                          <Input
                            id="first-name"
                            onChange={(e) => setFirstName(e.target.value)}
                            value={firstName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last-name">Last Name</Label>
                          <Input
                            id="last-name"
                            onChange={(e) => setLastName(e.target.value)}
                            value={lastName}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          disabled
                          value={
                            clerkUser?.primaryEmailAddress?.emailAddress
                              || ""
                          }
                        />
                        <p className="text-muted-foreground text-xs">
                          Email changes require verification and must be
                          updated through your account provider
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          disabled
                          value={
                            clerkUser?.primaryPhoneNumber?.phoneNumber
                              || ""
                          }
                        />
                        <p className="text-muted-foreground text-xs">
                          Phone changes require verification and must be
                          updated through your account provider
                        </p>
                      </div>
                      <Separator />
                      <div className="flex gap-2">
                        <Button
                          disabled={isSavingAccount}
                          onClick={handleSaveAccount}
                        >
                          {isSavingAccount ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                        <Button
                          disabled={isSavingAccount}
                          onClick={handleCancelAccountEdit}
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <InfoRow
                        label="Full Name"
                        value={clerkUser?.fullName}
                      />
                      <InfoRow
                        label="Email"
                        value={
                          clerkUser?.primaryEmailAddress?.emailAddress
                        }
                      />
                      <InfoRow
                        label="Phone"
                        value={
                          clerkUser?.primaryPhoneNumber?.phoneNumber
                        }
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Delete Account</Label>
                    <p className="text-muted-foreground text-sm">
                      Once you delete your account, there is no going back. This will permanently
                      delete your account, profile, and all associated data. Please be certain.
                    </p>
                    <Button
                      className="mt-2"
                      disabled={isDeleting}
                      onClick={() => setShowDeleteDialog(true)}
                      variant="destructive"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 size-4" />
                          Delete Account
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============ SECURITY ============ */}
          {activeSection === "security" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Manage your account security settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Two-Factor Authentication</p>
                        <p className="text-muted-foreground text-sm">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <Badge
                        className={
                          clerkUser?.twoFactorEnabled
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : ""
                        }
                        variant={clerkUser?.twoFactorEnabled ? "default" : "secondary"}
                      >
                        {clerkUser?.twoFactorEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Password</p>
                        <p className="text-muted-foreground text-sm">
                          {hasPassword
                            ? "Update your account password"
                            : "Add a password to sign in with email and password"}
                        </p>
                      </div>
                      {!isChangingPassword && (
                        <Button
                          onClick={() => setIsChangingPassword(true)}
                          size="sm"
                          variant="outline"
                        >
                          {hasPassword ? "Change" : "Create"}
                        </Button>
                      )}
                    </div>
                    {isChangingPassword && (
                      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                        {hasPassword && (
                          <div className="space-y-2">
                            <Label htmlFor="current-password">
                              Current Password
                            </Label>
                            <Input
                              id="current-password"
                              onChange={(e) =>
                                setCurrentPassword(e.target.value)
                              }
                              type="password"
                              value={currentPassword}
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="new-password">
                            New Password
                          </Label>
                          <Input
                            id="new-password"
                            onChange={(e) =>
                              setNewPassword(e.target.value)
                            }
                            placeholder="Min. 8 characters"
                            type="password"
                            value={newPassword}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">
                            Confirm Password
                          </Label>
                          <Input
                            id="confirm-password"
                            onChange={(e) =>
                              setConfirmPassword(e.target.value)
                            }
                            type="password"
                            value={confirmPassword}
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            disabled={
                              isSavingPassword
                                || (hasPassword && !currentPassword)
                                || !newPassword
                                || !confirmPassword
                            }
                            onClick={handleSavePassword}
                            size="sm"
                          >
                            {isSavingPassword ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Saving...
                              </>
                            ) : hasPassword ? (
                              "Update Password"
                            ) : (
                              "Create Password"
                            )}
                          </Button>
                          <Button
                            disabled={isSavingPassword}
                            onClick={handleCancelPasswordChange}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="font-medium text-sm">Connected Accounts</p>
                    <p className="text-muted-foreground text-sm">
                      Sign in with your social accounts or link them for
                      easier access
                    </p>

                    {clerkUser?.externalAccounts &&
                      clerkUser.externalAccounts.length > 0 && (
                        <div className="space-y-2">
                          {clerkUser.externalAccounts.map((account) => (
                            <div
                              className="flex items-center justify-between rounded-lg border p-3"
                              key={account.id}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                                  {account.imageUrl ? (
                                    <img
                                      alt={account.providerTitle()}
                                      className="size-5 rounded-sm"
                                      src={account.imageUrl}
                                    />
                                  ) : (
                                    <LinkIcon className="size-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {account.providerTitle()}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {account.emailAddress
                                      || account.username
                                      || "Connected"}
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={async () => {
                                  try {
                                    await account.destroy()
                                    toast.success(
                                      `${account.providerTitle()} disconnected`
                                    )
                                  } catch (err: unknown) {
                                    const clerkErr = err as {
                                      errors?: Array<{
                                        longMessage?: string
                                        message?: string
                                      }>
                                    }
                                    toast.error(
                                      clerkErr?.errors?.[0]?.longMessage
                                        || "Cannot disconnect this account"
                                    )
                                  }
                                }}
                                size="sm"
                                variant="outline"
                              >
                                Disconnect
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {(
                        [
                          { strategy: "oauth_google", label: "Google" },
                          { strategy: "oauth_github", label: "GitHub" },
                          { strategy: "oauth_apple", label: "Apple" },
                        ] as const
                      )
                        .filter(
                          (provider) =>
                            !clerkUser?.externalAccounts?.some(
                              (a) =>
                                `oauth_${a.provider}` === provider.strategy
                            )
                        )
                        .map((provider) => (
                          <Button
                            key={provider.strategy}
                            onClick={async () => {
                              try {
                                await clerkUser?.createExternalAccount({
                                  strategy: provider.strategy,
                                  redirectUrl: window.location.href,
                                })
                              } catch (err: unknown) {
                                const clerkErr = err as {
                                  errors?: Array<{
                                    longMessage?: string
                                    message?: string
                                  }>
                                }
                                toast.error(
                                  clerkErr?.errors?.[0]?.longMessage
                                    || `Failed to connect ${provider.label}`
                                )
                              }
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <LinkIcon className="mr-2 size-4" />
                            Connect {provider.label}
                          </Button>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============ BILLING ============ */}
          {activeSection === "billing" && (
            <div className="space-y-6">
              {user?.stripeCustomerId ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment Methods</CardTitle>
                      <CardDescription>Manage your payment information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {isLoadingPaymentMethods ? (
                        <BillingSkeleton />
                      ) : paymentMethods.length === 0 ? (
                        <EmptyState
                          description="Payment methods are saved automatically when you complete a reservation."
                          heading="No payment methods saved"
                          icon={CreditCard}
                        />
                      ) : (
                        <div className="space-y-3">
                          {paymentMethods.map((pm) => (
                            <div className="rounded-lg border bg-muted/30 p-4" key={pm.id}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                                    <CreditCard className="size-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-semibold">
                                      {pm.card
                                        ? `${formatCardBrand(pm.card.brand)} •••• ${pm.card.last4}`
                                        : "Payment Method"}
                                    </p>
                                    {pm.card && (
                                      <p className="text-muted-foreground text-sm">
                                        Expires {String(pm.card.expMonth).padStart(2, "0")}/
                                        {pm.card.expYear}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  aria-label="Remove payment method"
                                  onClick={() => toast.info("Payment method removal coming soon")}
                                  size="sm"
                                  variant="destructive"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <Separator />

                      <p className="text-muted-foreground text-sm">
                        To add a new payment method, complete a reservation and your payment method
                        will be saved for future use.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Billing History</CardTitle>
                      <CardDescription>View and download past invoices</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingInvoices ? (
                        <BillingSkeleton />
                      ) : invoices.length === 0 ? (
                        <EmptyState
                          description="Invoices will appear here after your first transaction."
                          heading="No invoices found"
                          icon={Receipt}
                        />
                      ) : (
                        <div className="space-y-3">
                          {invoices.map((invoice) => (
                            <div
                              className="flex items-center justify-between rounded-lg border p-4"
                              key={invoice.id}
                            >
                              <div className="space-y-1">
                                <p className="font-semibold">
                                  {invoice.description || `Invoice ${invoice.number || invoice.id}`}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                  {formatDate(invoice.created)}
                                </p>
                                <InvoiceStatusBadge status={invoice.status} />
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  {formatCurrency(invoice.amount, invoice.currency)}
                                </p>
                                {invoice.hostedInvoiceUrl && (
                                  <div className="mt-2 flex gap-2">
                                    <Button
                                      onClick={() =>
                                        window.open(invoice.hostedInvoiceUrl, "_blank")
                                      }
                                      size="sm"
                                      variant="outline"
                                    >
                                      View
                                    </Button>
                                    {invoice.invoicePdf && (
                                      <Button
                                        aria-label="Download invoice PDF"
                                        onClick={() => window.open(invoice.invoicePdf, "_blank")}
                                        size="sm"
                                        variant="outline"
                                      >
                                        <Download className="size-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-0">
                    <EmptyState
                      description="Payment methods will be saved when you make your first reservation."
                      heading="No billing information"
                      icon={CreditCard}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ============ NOTIFICATIONS ============ */}
          {activeSection === "notifications" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose what email notifications you want to receive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Essential notifications */}
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Essential
                    </p>
                  </div>
                  <div className="space-y-3">
                    <NotificationRow
                      checked={notificationSettings.reservationUpdates}
                      description="Reservation confirmations, cancellations, and changes"
                      icon={Mail}
                      id="notif-reservations"
                      label="Reservation Updates"
                      onCheckedChange={(checked) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          reservationUpdates: checked,
                        }))
                      }
                    />
                    <NotificationRow
                      checked={notificationSettings.messages}
                      description="New messages from owners and renters"
                      icon={Bell}
                      id="notif-messages"
                      label="Messages"
                      onCheckedChange={(checked) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          messages: checked,
                        }))
                      }
                    />
                    <NotificationRow
                      checked={notificationSettings.paymentUpdates}
                      description="Payment confirmations and refunds"
                      icon={CreditCard}
                      id="notif-payments"
                      label="Payment Updates"
                      onCheckedChange={(checked) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          paymentUpdates: checked,
                        }))
                      }
                    />
                  </div>

                  <Separator />

                  {/* Optional notifications */}
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Optional
                    </p>
                  </div>
                  <div className="space-y-3">
                    <NotificationRow
                      checked={notificationSettings.reviewsAndRatings}
                      description="New reviews or ratings on your listings"
                      icon={Star}
                      id="notif-reviews"
                      label="Reviews & Ratings"
                      onCheckedChange={(checked) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          reviewsAndRatings: checked,
                        }))
                      }
                    />
                    <NotificationRow
                      checked={notificationSettings.marketing}
                      description="New features, special offers, and platform news"
                      icon={Bell}
                      id="notif-marketing"
                      label="Marketing & Promotions"
                      onCheckedChange={(checked) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          marketing: checked,
                        }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isNotificationsDirty && (
                        <span className="text-muted-foreground text-sm">Unsaved changes</span>
                      )}
                    </div>
                    <Button
                      disabled={isSavingNotifications || !isNotificationsDirty}
                      onClick={handleSaveNotificationPreferences}
                    >
                      {isSavingNotifications ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Preferences"
                      )}
                    </Button>
                  </div>

                  <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                      Critical notifications (like reservation confirmations and payment receipts)
                      cannot be disabled for security and legal reasons.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============ PREFERENCES ============ */}
          {activeSection === "preferences" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Customize your experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Theme */}
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <p className="text-muted-foreground text-sm">
                      Choose your preferred color scheme
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="w-full justify-start sm:w-auto" variant="outline">
                          {theme === "light" && (
                            <>
                              <Sun className="mr-2 size-4" />
                              Light
                            </>
                          )}
                          {theme === "dark" && (
                            <>
                              <Moon className="mr-2 size-4" />
                              Dark
                            </>
                          )}
                          {theme === "system" && (
                            <>
                              <Monitor className="mr-2 size-4" />
                              System
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setTheme("light")}>
                          <Sun className="mr-2 size-4" />
                          Light
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")}>
                          <Moon className="mr-2 size-4" />
                          Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")}>
                          <Monitor className="mr-2 size-4" />
                          System
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Delete Account Dialog */}
      <Dialog
        onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) {
            setDeleteConfirmText("")
          }
        }}
        open={showDeleteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account, profile,
              vehicles, reservations, and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="font-medium text-destructive text-sm">
                Warning: This action is permanent and irreversible.
              </p>
              <ul className="mt-2 ml-4 list-disc space-y-1 text-destructive/80 text-sm">
                <li>Your account will be permanently deleted</li>
                <li>All your vehicle listings will be removed</li>
                <li>All your reservations will be cancelled</li>
                <li>All your messages and conversations will be deleted</li>
                <li>You will lose access to all platform features</li>
              </ul>
            </div>
            <div>
              <Label htmlFor="delete-confirm">
                Type <strong>DELETE</strong> to confirm:
              </Label>
              <Input
                className="mt-2"
                id="delete-confirm"
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                value={deleteConfirmText}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={isDeleting}
              onClick={() => {
                setShowDeleteDialog(false)
                setDeleteConfirmText("")
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isDeleting || deleteConfirmText !== "DELETE"}
              onClick={handleDeleteAccount}
              variant="destructive"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
