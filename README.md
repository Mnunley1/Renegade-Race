# Renegade Rentals

A marketplace platform for track day vehicle rentals, connecting vehicle owners with drivers who want to rent high-performance cars for track days. Includes a motorsports networking module for driver-team matching.

## Tech Stack

- **Framework:** Next.js 16 (React 19) with TypeScript
- **Backend:** [Convex](https://convex.dev) (serverless database, functions, and scheduling)
- **Auth:** [Clerk](https://clerk.com)
- **Payments:** [Stripe Connect](https://stripe.com/connect) (marketplace payouts)
- **Storage:** Cloudflare R2 + Vercel image optimization; private Convex storage for return evidence
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
pnpm install --frozen-lockfile
```

2. Copy environment files and fill in your keys:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp packages/backend/.env.example packages/backend/.env.local
```

3. Point both apps at the same verified nonproduction backend, then start the
   frontends in separate terminals:

```bash
pnpm dev:web
pnpm dev:admin
```

4. For backend work, follow the [shared Convex workflow](docs/backend-workflow.md).
   `packages/backend` owns the backend for both apps. The `pnpm dev:backend` and
   `pnpm dev` commands start a watcher that pushes backend code; verify its target
   and runtime before using it. Frontend-only changes do not require a Convex push.

## Scripts

For required CI checks and the dev-to-main release procedure, see [Releases](docs/releases.md).
For backend ownership, personal development and version-matched staging commands,
see [Shared Convex backend](docs/backend-workflow.md).
For the isolated renter/host/payment staging check, see [Staging smoke test](scripts/ren6-staging-smoke.md).

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services, including the backend watcher (pushes code) |
| `pnpm dev:web` / `pnpm dev:admin` | Start one frontend without a backend push |
| `pnpm dev:backend` | Start the personal backend watcher; verify its environment first |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run linting |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format code with Biome |

## Verifying a payout destination

New rental, custom invoice, coaching, and damage payments require a unique local Stripe Connect link. At checkout, the backend reads the Express account from Stripe and checks that its `renegadeUserId` metadata matches the payee's Clerk user ID. New onboarding sets this value automatically.

For an older account, verify control of both the signed-in Renegade identity and the specific Stripe account through independent evidence. The saved link and a matching email alone do not establish ownership. Record the evidence in restricted support records. Once verified, a platform operator can set `renegadeUserId` on that one connected account in Stripe. The next checkout reads the updated ownership directly. Keep the hold in place if the evidence is incomplete or the account is linked to multiple users.

Custom invoices recheck the destination when opening a Stripe payment link or the billing portal. A payout hold still allows access to paid receipts. The invoice sender can refund a settled ACH damage deposit to its original charge. Pending refunds reserve that amount until Stripe confirms success or failure.

## Onboarding and listing photos

Convex records the uploader, R2 bucket, key, and intended use when it issues an upload URL. Saving a draft checks that record. Creating a listing binds the upload to its vehicle image, so clearing or restarting onboarding preserves published photos.

Cleanup removes unused onboarding photos issued to the signed-in user. Clearing a legacy draft or removing a legacy listing image removes its reference and retains the stored file when its uploader is unknown. A host resuming an older draft must re-upload any unverified photos before publishing. Older clients can still attach their newly issued general-purpose uploads. Cleanup retains those files because they may be used elsewhere.

## Return evidence

For participant access, private photo delivery, and migration of historical R2 attachments, see [Return evidence access and release](docs/return-evidence.md).

## Environment Variables

See `.env.example` files in each app/package for required variables:

- **Convex** — `CONVEX_DEPLOYMENT` (backend CLI target), `NEXT_PUBLIC_CONVEX_URL` (both frontends)
- **Clerk** — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Resend** — `RESEND_API_KEY`
- **Cloudflare R2** — `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- **Google Maps** — `GOOGLE_MAPS_API_KEY`
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
