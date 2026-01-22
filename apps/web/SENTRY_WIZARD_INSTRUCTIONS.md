# Running Sentry Wizard in Monorepo

Since this is a monorepo with pnpm workspaces, you need to run the Sentry wizard from the `apps/web` directory.

## Steps

1. **Navigate to the web app directory:**
```bash
cd apps/web
```

2. **Run the Sentry wizard:**
```bash
npx @sentry/wizard@latest -i nextjs --saas --org renegade-i0 --project javascript-nextjs
```

## What the Wizard Will Do

The wizard will:
- ✅ Detect existing Sentry config files (we've already created them)
- ✅ Install `@sentry/nextjs` package if not already installed
- ✅ Update `next.config.mjs` with Sentry webpack plugin (if needed)
- ✅ Create/update `sentry.properties` file (for source maps)
- ✅ Set up build scripts for source map uploads (optional)

## Important Notes

### Already Configured
We've already set up:
- ✅ `sentry.client.config.ts`
- ✅ `sentry.server.config.ts`
- ✅ `sentry.edge.config.ts`
- ✅ `instrumentation.ts`
- ✅ Error handler integration
- ✅ Error boundary integration
- ✅ Next.js config with instrumentation hook

### What You May Need to Adjust

After running the wizard, check:

1. **`next.config.mjs`** - The wizard may add Sentry webpack plugin. Our current config should work, but verify it doesn't conflict.

2. **`sentry.properties`** - This file will be created for source map uploads. It should contain:
```properties
defaults.org=renegade-i0
defaults.project=javascript-nextjs
auth.token=your-auth-token-here
```

3. **Environment Variables** - Make sure you have:
```env
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

4. **Build Scripts** - The wizard may add source map upload scripts. You can add these to `package.json`:
```json
{
  "scripts": {
    "build": "next build --webpack",
    "sentry:sourcemaps": "sentry-cli sourcemaps upload --org renegade-i0 --project javascript-nextjs ./next"
  }
}
```

## Alternative: Manual Setup

If you prefer not to run the wizard (since we've already configured everything), you can:

1. **Install the package:**
```bash
cd apps/web
pnpm add @sentry/nextjs
```

2. **Add your DSN to environment variables:**
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

3. **Test it:**
Set `SENTRY_DEBUG=true` in development to test error tracking.

## Verifying Setup

After running the wizard:

1. Check that `@sentry/nextjs` is in `package.json` dependencies
2. Verify `sentry.properties` exists (if using source maps)
3. Test error tracking by triggering an error in your app
4. Check your Sentry dashboard at https://sentry.io/organizations/renegade-i0/projects/javascript-nextjs/
