import { Separator } from "@workspace/ui/components/separator"
import { formatRentalUsd } from "@/lib/rental-checkout"

type RentalQuote = {
  dailyRate: number
  totalDays: number
  totalAmount: number
  addOns?: { name: string; price: number; priceType?: "daily" | "one-time" }[]
}

/** Read the reservation snapshot, never the listing's current prices. */
export function RentalQuoteSummary({ quote }: { quote: RentalQuote }) {
  const daysLabel = `${quote.totalDays} ${quote.totalDays === 1 ? "day" : "days"}`
  return (
    <section aria-label="Saved rental quote" className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <span>
          <span>{formatRentalUsd(quote.dailyRate)}/day</span> × {daysLabel}
        </span>
        <span>{formatRentalUsd(quote.dailyRate * quote.totalDays)}</span>
      </div>
      {quote.addOns?.map((addOn) => (
        <div className="flex flex-wrap justify-between gap-x-4" key={addOn.name}>
          <span>{addOn.name}</span>
          <span>
            {formatRentalUsd(addOn.price * (addOn.priceType === "daily" ? quote.totalDays : 1))}
          </span>
          <span className="w-full text-muted-foreground text-xs">
            {formatRentalUsd(addOn.price)}
            {addOn.priceType === "daily" ? `/day × ${daysLabel}` : " one-time"}
          </span>
        </div>
      ))}
      <Separator />
      <div className="flex justify-between gap-4 font-medium">
        <span>Rental subtotal</span>
        <span>{formatRentalUsd(quote.totalAmount)}</span>
      </div>
    </section>
  )
}
