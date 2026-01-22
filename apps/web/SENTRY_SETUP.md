# Sentry Setup Guide

This guide will help you set up Sentry error tracking for the Renegade Race Rentals web application.

## Installation

1. Install Sentry packages:
```bash
cd apps/web
pnpm add @sentry/nextjs
```

2. Run Sentry wizard (optional, but recommended for first-time setup):
```bash
pnpm exec @sentry/wizard@latest -i nextjs
```

The wizard will help configure Sentry automatically. If you prefer manual setup, follow the steps below.

## Configuration

### 1. Environment Variables

Add the following to your `.env.local` (development) and production environment:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

**Optional (for source maps and releases):**
```env
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### 2. Get Your DSN

1. Sign up or log in to [Sentry](https://sentry.io)
2. Create a new project (select "Next.js" as the platform)
3. Copy your DSN from the project settings
4. Add it to your environment variables

### 3. Files Created

The following Sentry configuration files have been created:

- `sentry.client.config.ts` - Client-side error tracking
- `sentry.server.config.ts` - Server-side error tracking
- `sentry.edge.config.ts` - Edge runtime error tracking
- `instrumentation.ts` - Next.js instrumentation hook

### 4. Integration Points

Sentry has been integrated into:

- ✅ Error handler (`lib/error-handler.ts`) - Captures errors from `handleError` and `handleErrorWithContext`
- ✅ Error boundary (`components/error-boundary.tsx`) - Captures React component errors
- ✅ Next.js error page (`app/error.tsx`) - Captures route-level errors

## Features

### Error Tracking
- Automatic error capture from error handlers
- React error boundary integration
- Next.js route error handling
- Context-aware error reporting

### Session Replay
- Enabled for error sessions (100% sample rate)
- 10% sample rate for normal sessions in production
- Masks sensitive data (text and media)

### Performance Monitoring
- 10% trace sample rate in production
- 100% in development (for testing)

### Privacy & Security
- Errors are filtered in development (unless `SENTRY_DEBUG=true`)
- Sensitive data is masked in session replays
- Only sends errors in production environment

## Testing

To test Sentry in development:

1. Set `SENTRY_DEBUG=true` in your `.env.local`
2. Trigger an error in your app
3. Check your Sentry dashboard for the error

## Production Deployment

1. Ensure `NEXT_PUBLIC_SENTRY_DSN` is set in your production environment
2. Deploy your application
3. Errors will automatically be sent to Sentry
4. Set up alerts in Sentry dashboard for critical errors

## Source Maps (Optional)

To enable source maps for better error details:

1. Install Sentry CLI: `pnpm add -D @sentry/cli`
2. Add build script to upload source maps:
```json
{
  "scripts": {
    "build": "next build && sentry-cli sourcemaps inject --org=your-org --project=your-project ./next",
    "sentry:sourcemaps": "sentry-cli sourcemaps upload --org=your-org --project=your-project ./next"
  }
}
```

3. Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` environment variables

## Monitoring & Alerts

Set up alerts in Sentry dashboard:

1. Go to Alerts → Create Alert
2. Configure conditions (e.g., error rate > threshold)
3. Set up notification channels (email, Slack, etc.)
4. Monitor error trends and patterns

## Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)
