# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Renegade Rentals is a marketplace platform for track day vehicle rentals, connecting vehicle owners with drivers who want to rent high-performance cars. Includes a motorsports networking module for driver-team matching.

## Commands

```bash
# Development
pnpm dev              # Start all services (web, admin, backend)
pnpm dev:web          # Web app only (customer marketplace)
pnpm dev:admin        # Admin dashboard only
pnpm dev:backend      # Convex backend only

# Building
pnpm build            # Build all packages

# Code Quality
pnpm lint             # Run Biome linting
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format code with Biome

# Type checking
pnpm typecheck            # All packages via turbo

# Convex backend
pnpm --filter @renegade/backend convex:deploy  # Deploy to production

# Add shadcn/ui component
pnpm dlx shadcn@latest add <component> -c apps/web
```

## Tech Stack

- **Monorepo:** Turborepo + pnpm 10.4.1 (Node >= 20)
- **Frontend:** Next.js 16 (React 19), TypeScript 5.7+, Tailwind CSS v4
- **Backend:** Convex (serverless database, functions, real-time subscriptions)
- **Auth:** Clerk (externalId maps to Convex users)
- **Payments:** Stripe Connect (marketplace payouts)
- **Storage:** Cloudflare R2 + ImageKit
- **Email:** Resend
- **UI:** shadcn/ui + Radix UI
- **Linting:** Biome (not ESLint)

## Architecture

### Monorepo Structure

```
apps/
├── web/           # Customer marketplace (Next.js)
└── admin/         # Internal admin dashboard (Next.js)
packages/
├── backend/       # Convex schema and functions
├── ui/            # Shared component library (@workspace/ui)
└── typescript-config/
```

### Backend (Convex)

All backend code is in `packages/backend/convex/`. Key modules:
- `schema.ts` - Database tables: users, vehicles, reservations, payments, conversations, messages, teams, driverProfiles, disputes
- `users.ts` - User management, Stripe Connect account linking
- `vehicles.ts` - Vehicle CRUD with soft deletes
- `reservations.ts` - Booking workflow (pending → confirmed → completed)
- `stripe.ts` - Payment processing with Stripe Connect transfers
- `conversations.ts`, `messages.ts` - Messaging system with unread counts
- `teams.ts`, `driverProfiles.ts`, `teamApplications.ts` - Motorsports networking

Convex function types:
- `query` - Read-only, cached, real-time subscriptions
- `mutation` - Write operations, transactional
- `action` - External API calls (Stripe, Resend, etc.), not transactional

### Key Patterns

- Users have `externalId` (Clerk ID) indexed for lookups
- Vehicles use soft delete (`deletedAt` timestamp)
- Reservations track status: pending, confirmed, cancelled, completed, declined
- Payments use Stripe Connect: platform takes fee, rest transfers to owner's account
- Real-time features via Convex subscriptions

### UI Components

Import from shared package:
```typescript
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
```

Use CVA (class-variance-authority) for variant-based styling.

## Code Style

Biome handles formatting and linting:
- 2-space indentation, double quotes, no semicolons (asNeeded)
- Max line width: 100 characters
- Trailing commas: ES5 style

TypeScript:
- Explicit types for function parameters and return types
- Use `import type` for type-only imports
- Prefer `interface` for object shapes, `type` for unions/intersections
- Avoid `any` - use `unknown` if type is truly unknown

React:
- Server components by default (only `"use client"` when needed)
- Named exports for components, default exports for pages
- Use `React.ComponentProps` and utility types for component props

## Git Workflow

Do not mention Claude Code co-authored commit messages.
Branch from `dev` for new features. PRs target `dev`; `dev` merges into `main` for releases.
Pre-commit hooks run Biome via lint-staged. CI runs lint, typecheck, and build on PRs to `main` and `dev`.

## Known Issues

`ignoreBuildErrors` is set to `false` in both next.config.mjs files.
