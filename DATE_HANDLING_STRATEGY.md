# Date Handling Strategy

## Overview

This document outlines the date handling strategy for the Renegade Rentals application to prevent timezone-related bugs and ensure consistent date handling across the frontend and backend.

## Core Principle

**All dates are stored in the database as `YYYY-MM-DD` strings (date-only, no time component).** This ensures:
- No timezone ambiguity
- Consistent date comparisons
- Simple date range queries
- Predictable behavior across different timezones

## The Problem

JavaScript's `Date` object and date parsing can cause timezone shifts:

1. **`new Date("2024-01-19")`** - Parses as UTC midnight, which can shift to the previous day in timezones behind UTC (e.g., PST/PDT)
2. **`date.toISOString().split("T")[0]`** - Converts local date to UTC, which can shift the date by a day
3. **Inconsistent parsing** - Different parts of the codebase parsing dates differently

### Example of the Bug

User in PST (UTC-8) selects January 19:
- Date object: `2024-01-19 00:00:00 PST` (local)
- `toISOString()`: `2024-01-19T08:00:00Z` (UTC)
- `split("T")[0]`: `"2024-01-19"` ✅ (correct in this case)

But if the date was created from a string:
- `new Date("2024-01-19")`: `2024-01-19 00:00:00 UTC`
- Displayed in PST: `2024-01-18 16:00:00 PST` ❌ (wrong day!)

## Solution

### Backend (`packages/backend/convex/date-utils.ts`)

Centralized date utilities for the backend:

- **`parseLocalDate(dateString: string)`** - Parses YYYY-MM-DD as local date (not UTC)
- **`formatDateToISO(date: Date)`** - Formats Date to YYYY-MM-DD using local date components
- **`calculateDaysBetween(start, end)`** - Calculates days between two date strings
- **`generateDateRange(start, end)`** - Generates array of date strings in range

### Frontend (`apps/web/lib/date-utils.ts`)

Centralized date utilities for the frontend:

- **`parseLocalDate(dateString: string)`** - Parses YYYY-MM-DD as local date (not UTC)
- **`formatDateToISO(date: Date)`** - Formats Date to YYYY-MM-DD using local date components
- **`formatDateForDisplay(dateString: string)`** - Formats date string for user display
- **`calculateDaysBetween(start, end)`** - Calculates days between two date strings
- **`generateDateRange(start, end)`** - Generates array of date strings in range

## Usage Guidelines

### When Creating Dates from User Input

```typescript
// ✅ CORRECT: Use Date object directly from calendar/date picker
const pickupDate = new Date(2024, 0, 19) // January 19, 2024 (local)

// ❌ WRONG: Don't parse date strings with new Date()
const pickupDate = new Date("2024-01-19") // Parses as UTC!
```

### When Converting Dates to Strings for Backend

```typescript
// ✅ CORRECT: Use formatDateToISO utility
import { formatDateToISO } from "@/lib/date-utils"
const dateString = formatDateToISO(pickupDate)

// ❌ WRONG: Don't use toISOString()
const dateString = pickupDate.toISOString().split("T")[0] // Can shift dates!
```

### When Parsing Date Strings from Backend

```typescript
// ✅ CORRECT: Use parseLocalDate utility
import { parseLocalDate } from "@/lib/date-utils"
const date = parseLocalDate("2024-01-19")

// ❌ WRONG: Don't use new Date() directly
const date = new Date("2024-01-19") // Parses as UTC!
```

### When Displaying Dates to Users

```typescript
// ✅ CORRECT: Use formatDateForDisplay utility
import { formatDateForDisplay } from "@/lib/date-utils"
const display = formatDateForDisplay("2024-01-19") // "Jan 19, 2024"

// ❌ WRONG: Don't parse and format manually
const date = new Date("2024-01-19")
const display = date.toLocaleDateString() // Can show wrong day!
```

## Files Updated

### Backend
- ✅ `packages/backend/convex/date-utils.ts` - New utility module
- ✅ `packages/backend/convex/reservations.ts` - Fixed date calculation
- ✅ `packages/backend/convex/availability.ts` - Fixed date range generation

### Frontend
- ✅ `apps/web/lib/date-utils.ts` - New utility module
- ✅ `apps/web/app/checkout/page.tsx` - Fixed date formatting when sending to backend
- ✅ `apps/web/app/checkout/success/page.tsx` - Fixed date display
- ✅ `apps/web/components/trip-card.tsx` - Updated to use centralized utility

## Testing Checklist

When working with dates, verify:

- [ ] Dates are stored as YYYY-MM-DD strings in the database
- [ ] Date parsing uses `parseLocalDate()` utility
- [ ] Date formatting uses `formatDateToISO()` utility
- [ ] Date display uses `formatDateForDisplay()` utility
- [ ] Date calculations use utility functions
- [ ] No direct use of `new Date(dateString)` for YYYY-MM-DD strings
- [ ] No use of `toISOString().split("T")[0]` for date formatting

## Migration Notes

If you encounter existing code that needs updating:

1. **Find date parsing**: Search for `new Date("` or `new Date(dateString)`
2. **Find date formatting**: Search for `toISOString().split("T")[0]`
3. **Replace with utilities**: Use the appropriate utility function
4. **Test in different timezones**: Verify dates don't shift

## Future Considerations

- Consider using a date library like `date-fns` or `dayjs` for more complex date operations
- Add timezone information if we need to support international users with different timezones
- Consider storing dates as ISO 8601 strings with timezone if we need time components
