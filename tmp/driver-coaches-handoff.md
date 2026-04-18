# Driver coaches — handoff notes (temp context file)

**Last updated:** 2026-04-14 (evening)

## Branch & commit

- **Branch:** `feature/driver-coaches-backend`
- **Latest pushed commit:** `79917df` — `feat(backend): driver coach listings, availability, and bookings`
- Push with: `git push -u origin feature/driver-coaches-backend` (already done when this file was written)

## What was built (backend)

- **Schema** (`packages/backend/convex/schema.ts`): `coachServices`, `coachServiceImages`, `coachAvailability`, `coachBookings`; `users` got `isCoach` + `coachOnboardingStatus`.
- **Pricing / validation (TDD):** `coachPricing.ts` + `coachPricing.test.ts`; `coachBookingValidation.ts` + `coachBookingValidation.test.ts`.
- **Convex modules:** `coachServices.ts`, `coachAvailability.ts`, `coachBookings.ts`.
- **Errors:** `CANNOT_BOOK_OWN_COACH_SERVICE` in `errors.ts`.
- **API types:** `packages/backend/convex/_generated/api.d.ts` registers `coachServices`, `coachAvailability`, `coachBookings`, `coachPricing`, `coachBookingValidation`.

### Public / app surface (Convex)

- **coachServices:** `listPublic`, `getById`, `listByCoach`, `createWithImages`, `update`, `softDelete`
- **coachAvailability:** `getByService`, `checkRange`, `setDay`, `blockDateRange`
- **coachBookings:** `create`, `getByUser`, `getById`, `updateStatus`

## Repo cleanup (web-only)

**iOS / Expo / React Native** artifacts (`ios/`, root `app.json`, Expo deps in root `package.json`) were removed; this repo targets web apps only.

## Follow-ups (next session)

1. **Convex deploy / dev** — Run `pnpm dev` / `convex dev` (or deploy) so the deployed Convex project has the new schema and functions.
2. **Stripe checkout** — Coach bookings have no vehicle-style `payments` row yet; add a coach payment flow parallel to reservations (or generalize payments later).
3. **Admin** — Approve coach listings via `isApproved` on `coachServices` (same idea as vehicles).
4. **Web UI** — Routes and pages: browse `api.coachServices.listPublic`, detail, coach dashboard, booking flow, etc.

## Quick commands

```bash
cd packages/backend && pnpm test    # Vitest (includes coach tests)
cd packages/backend && pnpm exec tsc --noEmit
```

## Design reference

Parallel listing model to vehicles: coach service listing → images → per-day availability → bookings; `driverProfiles` remains separate (team matching), not the coach marketplace listing.
