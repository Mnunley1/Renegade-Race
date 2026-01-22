# Where to Add Sentry DSN

## 📍 Location: `.env.local` file

Create or edit the `.env.local` file in the `apps/web` directory.

### File Path:
```
apps/web/.env.local
```

### Add This Line:
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

## 📝 Step-by-Step Instructions

### 1. Navigate to the web app directory:
```bash
cd apps/web
```

### 2. Create or edit `.env.local`:
```bash
# If file doesn't exist, create it
touch .env.local

# Or open it in your editor
code .env.local
# or
nano .env.local
```

### 3. Add the Sentry DSN:
```env
# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

### 4. Get Your DSN:
1. Go to: https://sentry.io/organizations/renegade-i0/projects/javascript-nextjs/settings/keys/
2. Copy the **DSN** (it looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)
3. Paste it after `NEXT_PUBLIC_SENTRY_DSN=`

## 🔍 Example `.env.local` File

Your `.env.local` file should look something like this:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Optional: Enable Sentry debugging in development
# SENTRY_DEBUG=true
```

## 🚀 Production Deployment

For production, add the DSN to your hosting platform's environment variables:

### Vercel:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add: `NEXT_PUBLIC_SENTRY_DSN` = `https://your-dsn@sentry.io/your-project-id`
4. Select "Production" environment
5. Redeploy

### Other Platforms:
Add `NEXT_PUBLIC_SENTRY_DSN` to your production environment variables in your hosting platform's dashboard.

## ✅ Verify It's Working

After adding the DSN:

1. **Restart your dev server:**
```bash
cd apps/web
pnpm dev
```

2. **Test error tracking** (optional):
   - Add `SENTRY_DEBUG=true` to `.env.local`
   - Trigger an error in your app
   - Check Sentry dashboard for the error

3. **Check browser console:**
   - You should see Sentry initialization logs (if `SENTRY_DEBUG=true`)
   - No errors related to Sentry DSN

## ⚠️ Important Notes

- **File name must be `.env.local`** (not `.env` or `.env.development.local`)
- **Variable must start with `NEXT_PUBLIC_`** to be available in the browser
- **`.env.local` is gitignored** - it won't be committed to your repository
- **Restart your dev server** after adding the DSN for changes to take effect

## 🆘 Troubleshooting

**DSN not working?**
- Make sure it starts with `NEXT_PUBLIC_`
- Verify the DSN is correct (copy from Sentry dashboard)
- Restart your dev server
- Check browser console for errors

**Not seeing errors in Sentry?**
- By default, Sentry filters development errors
- Add `SENTRY_DEBUG=true` to test in development
- Or check production deployment
