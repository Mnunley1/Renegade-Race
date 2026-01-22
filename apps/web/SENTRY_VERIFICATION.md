# Sentry Setup Verification

## ✅ Setup Complete!

Your Sentry DSN has been added. Here's how to verify everything is working:

## 🧪 Testing Sentry

### Option 1: Test in Development (Recommended First)

1. **Enable debug mode** in `.env.local`:
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
SENTRY_DEBUG=true
```

2. **Restart your dev server:**
```bash
cd apps/web
pnpm dev
```

3. **Trigger a test error:**
   - Navigate to any page
   - Open browser console (F12)
   - You should see Sentry initialization logs
   - Trigger an error (e.g., click a button that causes an error)
   - Check your Sentry dashboard for the error

### Option 2: Check Sentry Dashboard

1. Go to: https://sentry.io/organizations/renegade-i0/projects/javascript-nextjs/
2. Navigate to **Issues** tab
3. You should see errors appear here when they occur

### Option 3: Verify Configuration

Check browser console for Sentry logs:
- With `SENTRY_DEBUG=true`, you'll see: `[Sentry] Initializing...`
- No errors about missing DSN
- No errors about Sentry initialization

## 📊 What Gets Tracked

Sentry will automatically track:
- ✅ Errors from `handleError()` and `handleErrorWithContext()` functions
- ✅ React component errors (via ErrorBoundary)
- ✅ Next.js route errors (via error.tsx)
- ✅ Unhandled promise rejections
- ✅ Session replays (10% sample rate, 100% on errors)

## 🚀 Production

In production:
- Remove `SENTRY_DEBUG=true` (or don't set it)
- Errors will automatically be sent to Sentry
- No console logs in production
- 10% performance trace sampling
- 10% session replay sampling

## 🔔 Setting Up Alerts

1. Go to Sentry dashboard
2. Navigate to **Alerts** → **Create Alert**
3. Set up conditions (e.g., error rate > threshold)
4. Configure notification channels (email, Slack, etc.)

## ✅ Verification Checklist

- [ ] DSN added to `.env.local`
- [ ] Dev server restarted
- [ ] Sentry dashboard accessible
- [ ] Test error appears in Sentry (with `SENTRY_DEBUG=true`)
- [ ] No console errors about Sentry
- [ ] Production DSN configured (when deploying)

## 🆘 Troubleshooting

**Not seeing errors in Sentry?**
- Make sure `SENTRY_DEBUG=true` is set for development testing
- Check that DSN is correct (copy from Sentry dashboard)
- Verify DSN starts with `NEXT_PUBLIC_`
- Restart dev server after adding DSN
- Check browser console for Sentry errors

**Sentry not initializing?**
- Check browser console for errors
- Verify DSN format is correct
- Make sure `@sentry/nextjs` is installed (`pnpm list @sentry/nextjs`)
- Check that `instrumentation.ts` exists

**Need help?**
- Sentry Dashboard: https://sentry.io/organizations/renegade-i0/projects/javascript-nextjs/
- Sentry Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
