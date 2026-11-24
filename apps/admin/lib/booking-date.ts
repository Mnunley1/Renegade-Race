const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
}

/** Format stored calendar dates without interpreting them in the viewer's timezone.
 * The UTC anchor is only for presentation, never booking duration or timestamps.
 * Preserve malformed legacy values rather than normalizing them to another day.
 */
export function formatBookingDate(
  value: string,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone"> = DEFAULT_FORMAT
): string {
  if (!DATE_ONLY.test(value)) return value
  const date = new Date(`${value}T00:00:00.000Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.toISOString().slice(0, 10) !== value
  )
    return value
  return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" })
}
