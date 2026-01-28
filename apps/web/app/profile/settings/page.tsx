"use client"

import { useUser } from "@clerk/nextjs"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useAction, useMutation, useQuery } from "convex/react"
import {
  ArrowLeft,
  Bell,
  CreditCard,
  Download,
  Loader2,
  Mail,
  Moon,
  Star,
  Sun,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"
import { Checkbox } from "@workspace/ui/components/checkbox"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user: clerkUser } = useUser()
  const router = useRouter()
  const user = useQuery(
    api.users.getByExternalId,
    clerkUser?.id ? { externalId: clerkUser.id } : "skip"
  )

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

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

  // Load preferences when they're available
  useEffect(() => {
    if (notificationPreferences) {
      setNotificationSettings(notificationPreferences)
    }
  }, [notificationPreferences])

  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false)
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)

  const getPaymentMethods = useAction(api.stripe.getCustomerPaymentMethods)
  const getInvoices = useAction(api.stripe.getCustomerInvoices)

  useEffect(() => {
    const loadBillingData = async () => {
      if (!user?.stripeCustomerId) return

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
      // Delete user from Clerk - this will trigger the webhook which deletes from Convex
      await clerkUser.delete()
      toast.success("Account deleted successfully")
      // Redirect to home page
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
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/profile">
          <Button className="mb-6" variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            Back to Profile
          </Button>
        </Link>
        <h1 className="font-bold text-3xl">Settings</h1>
      </div>

      <Tabs className="w-full" defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Manage your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input defaultValue={clerkUser?.fullName || ""} id="name" readOnly />
                <p className="mt-1 text-muted-foreground text-xs">
                  Name is managed through your authentication provider
                </p>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  defaultValue={clerkUser?.primaryEmailAddress?.emailAddress || ""}
                  id="email"
                  readOnly
                  type="email"
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  Email is managed through your authentication provider
                </p>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  defaultValue={clerkUser?.primaryPhoneNumber?.phoneNumber || ""}
                  id="phone"
                  readOnly
                  type="tel"
                />
                <p className="mt-1 text-muted-foreground text-xs">
                  Phone number is managed through your authentication provider
                </p>
              </div>
              <Separator />
              <Button disabled>Save Changes</Button>
              <p className="text-muted-foreground text-xs">
                Account information is managed through your authentication provider. To update your
                name, email, or phone number, please update your account settings with your
                authentication provider.
              </p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Delete Account</Label>
                <p className="text-muted-foreground text-sm">
                  Once you delete your account, there is no going back. This will permanently delete
                  your account, profile, and all associated data. Please be certain.
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

          <Dialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
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
        </TabsContent>

        <TabsContent value="billing">
          {user?.stripeCustomerId ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>Manage your payment information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingPaymentMethods ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="py-8 text-center">
                      <CreditCard className="mx-auto mb-4 size-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No payment methods saved</p>
                      <p className="mt-2 text-muted-foreground text-sm">
                        Payment methods are saved automatically when you complete a reservation.
                      </p>
                    </div>
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
                            <Button size="sm" variant="destructive">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <div>
                    <p className="mb-4 text-muted-foreground text-sm">
                      To add a new payment method, complete a reservation and your payment method
                      will be saved for future use.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Billing History */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Billing History</CardTitle>
                  <CardDescription>View and download past invoices</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingInvoices ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">No invoices found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoices.map((invoice) => (
                        <div
                          className="flex items-center justify-between rounded-lg border p-4"
                          key={invoice.id}
                        >
                          <div>
                            <p className="font-semibold">
                              {invoice.description || `Invoice ${invoice.number || invoice.id}`}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              {formatDate(invoice.created)}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                              Status: <span className="capitalize">{invoice.status}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatCurrency(invoice.amount, invoice.currency)}
                            </p>
                            {invoice.hostedInvoiceUrl && (
                              <div className="mt-2 flex gap-2">
                                <Button
                                  onClick={() => window.open(invoice.hostedInvoiceUrl, "_blank")}
                                  size="sm"
                                  variant="outline"
                                >
                                  View
                                </Button>
                                {invoice.invoicePdf && (
                                  <Button
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
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No billing information available. Payment methods will be saved when you make your
                  first reservation.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what email notifications you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                      <Mail className="size-5 text-primary" />
                    </div>
                    <div>
                      <Label className="font-semibold text-base">Reservation Updates</Label>
                      <p className="text-muted-foreground text-sm">
                        Get notified about reservation confirmations, cancellations, and changes
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={notificationSettings.reservationUpdates}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        reservationUpdates: checked === true,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                      <Bell className="size-5 text-primary" />
                    </div>
                    <div>
                      <Label className="font-semibold text-base">Messages</Label>
                      <p className="text-muted-foreground text-sm">
                        Receive email notifications when you receive new messages
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={notificationSettings.messages}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        messages: checked === true,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                      <Star className="size-5 text-primary" />
                    </div>
                    <div>
                      <Label className="font-semibold text-base">Reviews & Ratings</Label>
                      <p className="text-muted-foreground text-sm">
                        Get notified when you receive new reviews or ratings
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={notificationSettings.reviewsAndRatings}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        reviewsAndRatings: checked === true,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                      <CreditCard className="size-5 text-primary" />
                    </div>
                    <div>
                      <Label className="font-semibold text-base">Payment Updates</Label>
                      <p className="text-muted-foreground text-sm">
                        Receive notifications about payment confirmations and refunds
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={notificationSettings.paymentUpdates}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        paymentUpdates: checked === true,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                      <Bell className="size-5 text-primary" />
                    </div>
                    <div>
                      <Label className="font-semibold text-base">Marketing & Promotions</Label>
                      <p className="text-muted-foreground text-sm">
                        Receive updates about new features, special offers, and platform news
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={notificationSettings.marketing}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        marketing: checked === true,
                      }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  disabled={isSavingNotifications}
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

              <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
                <p className="text-blue-900 text-sm dark:text-blue-100">
                  <strong>Note:</strong> Critical notifications (like reservation confirmations and
                  payment receipts) cannot be disabled for security and legal reasons.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>User Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Theme</Label>
                <p className="text-muted-foreground text-sm">Choose your preferred color scheme</p>
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
                          <Sun className="mr-2 size-4" />
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
                    <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
