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
import { Separator } from "@workspace/ui/components/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/profile">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="size-4" />
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
                <Input defaultValue="John Doe" id="name" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input defaultValue="john@example.com" id="email" type="email" />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input defaultValue="+1 (555) 123-4567" id="phone" type="tel" />
              </div>
              <Separator />
              <Button>Save Changes</Button>
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
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button className="mt-2" variant="destructive">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your payment information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Payment Method */}
              <div>
                <Label className="mb-3 block text-muted-foreground text-sm">
                  Current Payment Method
                </Label>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                        <span className="font-bold text-primary">••••</span>
                      </div>
                      <div>
                        <p className="font-semibold">•••• •••• •••• 4242</p>
                        <p className="text-muted-foreground text-sm">Expires 12/2025</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive">
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Add New Payment Method */}
              <div>
                <Label className="mb-3 block text-muted-foreground text-sm">
                  Add New Payment Method
                </Label>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input id="cardNumber" placeholder="1234 5678 9012 3456" type="text" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" type="text" />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" type="text" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cardName">Name on Card</Label>
                    <Input id="cardName" placeholder="John Doe" type="text" />
                  </div>
                  <Button>Add Payment Method</Button>
                </div>
              </div>

              <Separator />

              {/* Billing Address */}
              <div>
                <Label className="mb-3 block text-muted-foreground text-sm">Billing Address</Label>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="address">Street Address</Label>
                    <Input id="address" placeholder="123 Main Street" type="text" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input id="city" placeholder="Daytona Beach" type="text" />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input id="state" placeholder="FL" type="text" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input id="zipCode" placeholder="32114" type="text" />
                    </div>
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" placeholder="United States" type="text" />
                    </div>
                  </div>
                  <Button variant="outline">Update Billing Address</Button>
                </div>
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
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-semibold">Trip #12345</p>
                    <p className="text-muted-foreground text-sm">Mar 15, 2024</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">$899.00</p>
                    <Button className="mt-2" size="sm" variant="outline">
                      Download
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-semibold">Trip #12344</p>
                    <p className="text-muted-foreground text-sm">Feb 28, 2024</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">$1,299.00</p>
                    <Button className="mt-2" size="sm" variant="outline">
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Notification settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>User Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Preference settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
