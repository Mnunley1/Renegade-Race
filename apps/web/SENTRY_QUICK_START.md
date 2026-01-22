# Sentry Quick Start Guide

Sentry has been configured for your Next.js application. Follow these steps to complete the setup.

## ✅ Already Configured

The following has been set up:
- ✅ Sentry configuration files (client, server, edge)
- ✅ Error handler integration
- ✅ Error boundary integration  
- ✅ Next.js instrumentation hook
- ✅ Package added to `package.json`

## 📦 Installation

1. **Install dependencies:**
```bash
# From project root
pnpm install

# Or from apps/web directory
cd apps/web
pnpm install
```

## 🔑 Configuration

### 1. Get Your Sentry DSN

1. Go to https://sentry.io/organizations/renegade-i0/projects/javascript-nextjs/settings/keys/
2. Copy your **DSN** (it looks like: `https://xxxxx@sentry.io/xxxxx`)

### 2. Add Environment Variable

Add to your `.env.local` file (development) and production environment:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

**Important:** The DSN must start with `NEXT_PUBLIC_` to be available in the browser.

### 3. (Optional) Enable Development Testing

To test Sentry in development, add:

```env
SENTRY_DEBUG=true
```

This will send errors to Sentry even in development mode.

## 🧪 Testing

1. **Start your development server:**
```bash
cd apps/web
pnpm dev
```

2. **Trigger a test error:**
   - Add `SENTRY_DEBUG=true` to `.env.local`
   - Navigate to a page and trigger an error
   - Check your Sentry dashboard for the error

3. **Verify in Sentry Dashboard:**
   - Go to https://sentry.io/organizations/renegade-i0/projects/javascript-nextjs/
   - You should see the error appear in the Issues tab

## 📊 What Gets Tracked

Sentry automatically tracks:
- ✅ Errors from `handleError()` and `handleErrorWithContext()`
- ✅ React component errors (via ErrorBoundary)
- ✅ Next.js route errors (via error.tsx)
- ✅ Unhandled promise rejections
- ✅ Session replays (10% sample rate in production, 100% on errors)

## 🚀 Production Deployment

1. **Set environment variable in production:**
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

2. **Deploy your application**

3. **Monitor errors:**
   - Errors will automatically be sent to Sentry
   - Set up alerts in Sentry dashboard for critical errors
   - Monitor error trends and patterns

## 🔧 Source Maps (Optional)

For better error details with source maps:

1. **Install Sentry CLI:**
```bash
cd apps/web
pnpm add -D @sentry/cli
```

2. **Get your auth token:**
   - Go to https://sentry.io/settings/account/api/auth-tokens/
   - Create a new token with `project:releases` scope

3. **Create `sentry.properties` file:**
```properties
defaults.org=renegade-i0
defaults.project=javascript-nextjs
auth.token=your-auth-token-here
```

4. **Update build script** (optional):
```json
{
  "scripts": {
    "build": "next build --webpack && sentry-cli sourcemaps upload --org renegade-i0 --project javascript-nextjs ./next"
  }
}
```

## 📚 Documentation

- [Sentry Setup Guide](./SENTRY_SETUP.md) - Detailed setup instructions
- [Sentry Wizard Instructions](./SENTRY_WIZARD_INSTRUCTIONS.md) - Running the wizard
- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

## 🆘 Troubleshooting

### Errors not appearing in Sentry?

1. Check that `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify the DSN is accessible (not blocked by ad blockers)
3. Check browser console for Sentry initialization errors
4. Set `SENTRY_DEBUG=true` to see Sentry logs

### Development errors not sending?

By default, Sentry filters out development errors. To test:
- Set `SENTRY_DEBUG=true` in your `.env.local`
- Or check production deployment

### Need help?

- Check Sentry dashboard: https://sentry.io/organizations/renegade-i0/projects/javascript-nextjs/
- Review Sentry documentation: https://docs.sentry.io/platforms/javascript/guides/nextjs/
