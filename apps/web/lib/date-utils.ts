/**
 * Date utility functions for consistent date handling across the application.
 * All dates are stored in the database as YYYY-MM-DD strings (date-only, no time).
 * These utilities ensure dates are handled consistently without timezone issues.
 */

/**
 * Parse a YYYY-MM-DD date string as a local date (not UTC).
 * This prevents timezone shifts when parsing date-only strings.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in local timezone, or null if invalid
 */
export function parseLocalDate(dateString: string): Date | null {
  try {
    const parts = dateString.split("-")
    if (parts.length !== 3) return null

    const year = Number.parseInt(parts[0] || "0", 10)
    const month = Number.parseInt(parts[1] || "0", 10) - 1 // Month is 0-indexed
    const day = Number.parseInt(parts[2] || "0", 10)

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null

    // Create date in local timezone
    const date = new Date(year, month, day)

    // Validate the date is correct (handles invalid dates like Feb 30)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null
    }

    return date
  } catch {
    return null
  }
}

/**
 * Format a Date object to YYYY-MM-DD string (local date, not UTC).
 * This prevents timezone shifts when converting dates to strings.
 *
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Format a YYYY-MM-DD date string for display to users.
 * Parses the date as local to avoid timezone issues.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @param options - Optional formatting options
 * @returns Formatted date string (e.g., "Jan 19, 2024")
 */
export function formatDateForDisplay(
  dateString: string,
  options?: {
    month?: "short" | "long" | "numeric" | "2-digit"
    day?: "numeric" | "2-digit"
    year?: "numeric" | "2-digit"
  }
): string {
  const date = parseLocalDate(dateString)
  if (!date) return dateString

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }

  return date.toLocaleDateString("en-US", defaultOptions)
}

/**
 * Calculate the number of days between two date strings.
 * Uses local date parsing to avoid timezone issues.
 *
 * @param startDateString - Start date in YYYY-MM-DD format
 * @param endDateString - End date in YYYY-MM-DD format
 * @returns Number of days (inclusive, so same day = 1)
 */
export function calculateDaysBetween(
  startDateString: string,
  endDateString: string
): number {
  const start = parseLocalDate(startDateString)
  const end = parseLocalDate(endDateString)

  if (!start || !end) return 0

  // Set both to midnight local time for accurate calculation
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays > 0 ? diffDays : 0
}

/**
 * Generate an array of date strings between start and end dates (inclusive).
 * Uses local date parsing to avoid timezone issues.
 *
 * @param startDateString - Start date in YYYY-MM-DD format
 * @param endDateString - End date in YYYY-MM-DD format
 * @returns Array of date strings in YYYY-MM-DD format
 */
export function generateDateRange(
  startDateString: string,
  endDateString: string
): string[] {
  const start = parseLocalDate(startDateString)
  const end = parseLocalDate(endDateString)

  if (!start || !end) return []

  const dates: string[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  while (current <= end) {
    dates.push(formatDateToISO(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}
