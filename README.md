# Renegade Rentals

A marketplace platform for track day vehicle rentals, connecting vehicle owners with drivers who want to rent high-performance cars for track days. Includes a motorsports networking module for driver-team matching.

## Tech Stack

- **Framework:** Next.js 16 (React 19) with TypeScript
- **Backend:** [Convex](https://convex.dev) (serverless database, functions, and scheduling)
- **Auth:** [Clerk](https://clerk.com)
- **Payments:** [Stripe Connect](https://stripe.com/connect) (marketplace payouts)
- **Storage:** Cloudflare R2 + ImageKit (image optimization)
- **Email:** Resend
- **Monitoring:** Sentry
- **UI:** shadcn/ui + Tailwind CSS 4
- **Monorepo:** Turborepo + pnpm

## Project Structure

```
renegade-rentals/
├── apps/
│   ├── web/           # Customer-facing marketplace (Next.js)
│   └── admin/         # Internal admin dashboard (Next.js)
├── packages/
│   ├── backend/       # Convex backend — schema, functions, APIs
│   ├── ui/            # Shared component library (shadcn/ui)
│   └── typescript-config/
└── scripts/           # Migration & utility scripts
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 10+
- A [Convex](https://convex.dev) account
- A [Clerk](https://clerk.com) account
- A [Stripe](https://stripe.com) account

### Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment files and fill in your keys:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp packages/backend/.env.example packages/backend/.env.local
```

3. Start all services:

```bash
pnpm dev
```

Or start individual services:

```bash
pnpm dev:web       # Web app only
pnpm dev:admin     # Admin dashboard only
pnpm dev:backend   # Convex backend only
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run linting |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format code with Biome |

## Environment Variables

See `.env.example` files in each app/package for required variables:

- **Convex** — `CONVEX_DEPLOYMENT`, `CONVEX_URL`
- **Clerk** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Resend** — `RESEND_API_KEY`
- **Cloudflare R2** — `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- **Google Maps** — `GOOGLE_MAPS_API_KEY`
- **ImageKit** — `IMAGEKIT_URL_ENDPOINT`
- **Sentry** — `NEXT_PUBLIC_SENTRY_DSN`

## Adding UI Components

Components are shared via the `@workspace/ui` package. To add a new shadcn/ui component:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Import in your app:

```tsx
import { Button } from "@workspace/ui/components/button"
```
