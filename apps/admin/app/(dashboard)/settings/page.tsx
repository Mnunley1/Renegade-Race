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
import { useMutation, useQuery } from "convex/react"
import { DollarSign, Loader2, Save, Settings as SettingsIcon, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

function dateInputFromMs(ms: number | null | undefined): string {
  if (ms == null) return ""
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Local calendar date → start of that day (local) as ms. */
function startOfLocalDayMs(dateStr: string): number {
  const [yStr, mStr, dStr] = dateStr.split("-")
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

/** Local calendar date → end of that day (local) as ms. */
function endOfLocalDayMs(dateStr: string): number {
  const [yStr, mStr, dStr] = dateStr.split("-")
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

export default function SettingsPage() {
  const settings = useQuery(api.stripe.getPlatformSettings)
  const updateSettings = useMutation(api.stripe.updatePlatformSettings)
  const backfillEarlyAdopters = useMutation(api.admin.backfillEarlyAdopters)

  const [platformFeePercentage, setPlatformFeePercentage] = useState("")
  const [promoStartsAt, setPromoStartsAt] = useState("")
  const [promoEndsAt, setPromoEndsAt] = useState("")
  const [earlyAdopterFeeCap, setEarlyAdopterFeeCap] = useState("3")
  const [isSaving, setIsSaving] = useState(false)
  const [isBackfilling, setIsBackfilling] = useState(false)

  useEffect(() => {
    if (settings) {
      setPlatformFeePercentage(settings.platformFeePercentage.toString())
      setPromoStartsAt(dateInputFromMs(settings.earlyAdopterPromoStartsAt))
      setPromoEndsAt(dateInputFromMs(settings.earlyAdopterPromoEndsAt))
      setEarlyAdopterFeeCap((settings.earlyAdopterFeeCapPercentage ?? 3).toString())
    }
  }, [settings])

  const handleSave = async () => {
    if (!platformFeePercentage) {
      toast.error("Please enter a platform fee percentage")
      return
    }

    const feePercentage = Number.parseFloat(platformFeePercentage)
    const feeCap = Number.parseFloat(earlyAdopterFeeCap)

    if (Number.isNaN(feePercentage) || feePercentage < 0 || feePercentage > 100) {
      toast.error("Platform fee percentage must be between 0 and 100")
      return
    }

    if (Number.isNaN(feeCap) || feeCap < 0 || feeCap > 100) {
      toast.error("Early adopter fee cap must be between 0 and 100")
      return
    }

    if ((promoStartsAt && !promoEndsAt) || (!promoStartsAt && promoEndsAt)) {
      toast.error("Set both promo start and end dates, or clear both")
      return
    }

    if (
      promoStartsAt &&
      promoEndsAt &&
      endOfLocalDayMs(promoEndsAt) < startOfLocalDayMs(promoStartsAt)
    ) {
      toast.error("Promo end date must be on or after the start date")
      return
    }

    setIsSaving(true)
    try {
      await updateSettings({
        platformFeePercentage: feePercentage,
        earlyAdopterFeeCapPercentage: feeCap,
        earlyAdopterPromoStartsAt: promoStartsAt ? startOfLocalDayMs(promoStartsAt) : null,
        earlyAdopterPromoEndsAt: promoEndsAt ? endOfLocalDayMs(promoEndsAt) : null,
      })
      toast.success("Platform settings updated successfully")
    } catch (error) {
      handleErrorWithContext(error, { action: "update platform settings" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleBackfill = async () => {
    setIsBackfilling(true)
    try {
      const result = await backfillEarlyAdopters({})
      toast.success(`Early adopter status granted to ${result.granted} of ${result.total} users`)
    } catch (error) {
      handleErrorWithContext(error, { action: "backfill early adopters" })
    } finally {
      setIsBackfilling(false)
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
        <h1 className="font-bold text-3xl">Platform Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage platform fee structure and early adopter promo
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="size-5" />
            <CardTitle>Platform Fee Configuration</CardTitle>
          </div>
          <CardDescription>
            Global fee percentage for providers. Providers with a fee cap pay the lower of global
            and their cap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="feePercentage">
              Platform Fee Percentage <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                className="pr-8"
                id="feePercentage"
                max="100"
                min="0"
                onChange={(e) => setPlatformFeePercentage(e.target.value)}
                placeholder="5.0"
                step="0.1"
                type="number"
                value={platformFeePercentage}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Default percentage of each transaction that goes to the platform (e.g., 5 for 5%)
            </p>
          </div>

          {settings && (
            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 font-semibold">Current Settings</h4>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Fee Percentage:</span>{" "}
                  {settings.platformFeePercentage}%
                </p>
                <p className="mt-2 text-muted-foreground text-xs">
                  Last updated:{" "}
                  {new Date(settings.updatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <Button className="min-w-[120px]" disabled={isSaving} onClick={handleSave}>
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
            <Users className="size-5" />
            <CardTitle>Early Adopter Promo</CardTitle>
          </div>
          <CardDescription>
            New accounts created during this window get a permanent fee cap. Effective fee is always
            min(global, cap).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="promoStart">Promo start date</Label>
              <Input
                id="promoStart"
                onChange={(e) => setPromoStartsAt(e.target.value)}
                type="date"
                value={promoStartsAt}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promoEnd">Promo end date</Label>
              <Input
                id="promoEnd"
                onChange={(e) => setPromoEndsAt(e.target.value)}
                type="date"
                value={promoEndsAt}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="earlyAdopterCap">Early adopter fee cap (%)</Label>
            <div className="relative max-w-xs">
              <Input
                className="pr-8"
                id="earlyAdopterCap"
                max="100"
                min="0"
                onChange={(e) => setEarlyAdopterFeeCap(e.target.value)}
                step="0.1"
                type="number"
                value={earlyAdopterFeeCap}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Providers in the promo never pay more than this rate. Clear both dates to pause
              auto-grants for new signups.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button
              disabled={isBackfilling}
              onClick={handleBackfill}
              type="button"
              variant="outline"
            >
              {isBackfilling ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Backfilling...
                </>
              ) : (
                "Grant early adopter to all existing users"
              )}
            </Button>
            <Button className="min-w-[120px]" disabled={isSaving} onClick={handleSave}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Save Promo
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
          <div className="space-y-4 text-muted-foreground text-sm">
            <div>
              <h4 className="mb-1 font-semibold text-foreground">Fee Calculation</h4>
              <p>
                Platform fees are a percentage of the transaction. If a provider has a fee cap, they
                pay the lower of the global rate and their cap.
              </p>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-foreground">Example</h4>
              <p>For a $100 rental with a 5% global fee and a 3% early-adopter cap:</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li>Effective fee: min(5%, 3%) = 3%</li>
                <li>Platform fee: $3.00</li>
                <li>Provider receives: $97.00</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-foreground">Important Notes</h4>
              <ul className="list-inside list-disc space-y-1">
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
