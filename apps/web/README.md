# Renegade Rentals - Web Application

Track car rental platform built with Next.js 15, Clerk authentication, and a modern UI.

## Project Structure

### Pages

- **Home** (`/`) - Hero section, featured vehicles, categories
- **Sign In** (`/sign-in`) - Clerk authentication
- **Sign Up** (`/sign-up`) - Clerk registration
- **Reset Password** (`/reset-password`) - Password recovery
- **Vehicle Search** (`/vehicles`) - Search with filters and sorting
- **Vehicle Details** (`/vehicles/[id]`) - Detailed view with booking
- **Messages** (`/messages`) - Messaging interface
- **Profile** (`/profile`) - User dashboard with trips/favorites/reviews
- **Settings** (`/profile/settings`) - Account settings

### Components

- `Navigation` - Header with auth integration
- `Footer` - Site footer
- `VehicleCard` - Vehicle listing card

### Authentication

Uses Clerk for authentication:
- Sign in/Sign up flows
- Protected routes via middleware
- User profile management

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables in `.env.local`:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key_here
CLERK_SECRET_KEY=your_secret_here
NEXT_PUBLIC_CONVEX_URL=your_convex_url
```

3. Run development server:
```bash
pnpm dev
```

## Next Steps

- Connect to Convex backend for data fetching
- Integrate Clerk user data with Convex
- Add booking functionality
- Implement messaging features
- Connect to payment processing

## Tech Stack

- Next.js 15 (App Router)
- TypeScript 5.7+
- React 19
- Clerk (Authentication)
- Tailwind CSS v4
- shadcn/ui components
- Biome (Linting & Formatting)

