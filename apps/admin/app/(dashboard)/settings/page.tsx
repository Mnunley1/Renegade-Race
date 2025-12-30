"use client"

import { useQuery, useMutation } from "convex/react"
import { useState, useEffect } from "react"
import { api } from "@/lib/convex"
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
import { Loader2, Save, Settings as SettingsIcon, DollarSign } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const settings = useQuery(api.stripe.getPlatformSettings)
  const updateSettings = useMutation(api.stripe.updatePlatformSettings)
  
  const [platformFeePercentage, setPlatformFeePercentage] = useState("")
  const [minimumPlatformFee, setMinimumPlatformFee] = useState("")
  const [maximumPlatformFee, setMaximumPlatformFee] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Load settings into form when they're fetched
  useEffect(() => {
    if (settings) {
      setPlatformFeePercentage(settings.platformFeePercentage.toString())
      setMinimumPlatformFee((settings.minimumPlatformFee / 100).toFixed(2))
      setMaximumPlatformFee(
        settings.maximumPlatformFee ? (settings.maximumPlatformFee / 100).toFixed(2) : ""
      )
    }
  }, [settings])

  const handleSave = async () => {
    if (!platformFeePercentage || !minimumPlatformFee) {
      toast.error("Please fill in all required fields")
      return
    }

    const feePercentage = parseFloat(platformFeePercentage)
    const minFee = parseFloat(minimumPlatformFee)
    const maxFee = maximumPlatformFee ? parseFloat(maximumPlatformFee) : undefined

    if (isNaN(feePercentage) || feePercentage < 0 || feePercentage > 100) {
      toast.error("Platform fee percentage must be between 0 and 100")
      return
    }

    if (isNaN(minFee) || minFee < 0) {
      toast.error("Minimum platform fee must be a positive number")
      return
    }

    if (maxFee !== undefined && (isNaN(maxFee) || maxFee < minFee)) {
      toast.error("Maximum platform fee must be greater than or equal to minimum fee")
      return
    }

    setIsSaving(true)
    try {
      await updateSettings({
        platformFeePercentage: feePercentage,
        minimumPlatformFee: Math.round(minFee * 100), // Convert to cents
        maximumPlatformFee: maxFee !== undefined ? Math.round(maxFee * 100) : undefined,
      })
      toast.success("Platform settings updated successfully")
    } catch (error) {
      console.error("Failed to update platform settings:", error)
      toast.error("An error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  if (settings === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage platform fee structure and payment settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="size-5" />
            <CardTitle>Platform Fee Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure how platform fees are calculated for each rental transaction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="feePercentage">
              Platform Fee Percentage <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="feePercentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={platformFeePercentage}
                onChange={(e) => setPlatformFeePercentage(e.target.value)}
                placeholder="5.0"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Percentage of each transaction that goes to the platform (e.g., 5 for 5%)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minFee">
              Minimum Platform Fee <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="minFee"
                type="number"
                min="0"
                step="0.01"
                value={minimumPlatformFee}
                onChange={(e) => setMinimumPlatformFee(e.target.value)}
                placeholder="1.00"
                className="pl-7"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Minimum fee amount in USD (e.g., $1.00). The platform will always charge at least
              this amount.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxFee">Maximum Platform Fee (Optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="maxFee"
                type="number"
                min="0"
                step="0.01"
                value={maximumPlatformFee}
                onChange={(e) => setMaximumPlatformFee(e.target.value)}
                placeholder="50.00"
                className="pl-7"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Maximum fee amount in USD (e.g., $50.00). Leave empty for no maximum limit.
            </p>
          </div>

          {settings && (
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-semibold mb-2">Current Settings</h4>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Fee Percentage:</span>{" "}
                  {settings.platformFeePercentage}%
                </p>
                <p>
                  <span className="text-muted-foreground">Minimum Fee:</span> $
                  {(settings.minimumPlatformFee / 100).toFixed(2)}
                </p>
                {settings.maximumPlatformFee && (
                  <p>
                    <span className="text-muted-foreground">Maximum Fee:</span> $
                    {(settings.maximumPlatformFee / 100).toFixed(2)}
                  </p>
                )}
                <p className="text-muted-foreground text-xs mt-2">
                  Last updated: {new Date(settings.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5" />
            <CardTitle>How Platform Fees Work</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-1">Fee Calculation</h4>
              <p>
                Platform fees are calculated as a percentage of the total transaction amount,
                with minimum and maximum limits applied.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Example</h4>
              <p>
                For a $100 rental with 5% fee, $1 minimum, and $50 maximum:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Calculated fee: $100 × 5% = $5.00</li>
                <li>Applied fee: $5.00 (within min/max range)</li>
                <li>Owner receives: $95.00</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Important Notes</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Changes take effect immediately for new transactions</li>
                <li>Existing transactions are not affected</li>
                <li>Fees are automatically handled by Stripe Connect</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
