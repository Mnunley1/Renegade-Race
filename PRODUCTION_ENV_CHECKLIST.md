# Production Environment Variables Checklist

This document lists all environment variables that need to be configured for production deployment.

## 🔴 Critical (Must Set Before Launch)

### Clerk Authentication
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/verify-email
```

**Action Items:**
- [ ] Create production Clerk instance
- [ ] Configure production domain in Clerk dashboard
- [ ] Set up production webhooks (if needed)
- [ ] Update redirect URLs for production domain

### Convex Backend
```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=your-deploy-key
```

**Action Items:**
- [ ] Deploy Convex to production
- [ ] Set up production Convex deployment
- [ ] Configure environment variables in Convex dashboard
- [ ] Verify all Convex functions work in production

### Stripe Payment Processing
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Action Items:**
- [ ] Set up Stripe production account
- [ ] Configure Stripe Connect for host payouts
- [ ] Set up webhook endpoints in Stripe dashboard:
  - [ ] Payment intent succeeded
  - [ ] Payment intent failed
  - [ ] Account updated (for Connect accounts)
- [ ] Test payment processing with real cards (small amounts)
- [ ] Verify refund processing works

### Resend Email Service
```env
RESEND_API_KEY=re_...
RESEND_TEST_MODE=false  # ⚠️ CRITICAL: Must be false for production
```

**Action Items:**
- [ ] Set up Resend production account
- [ ] Verify sender domain (if using custom domain)
- [ ] **CRITICAL**: Set `RESEND_TEST_MODE=false` in production
- [ ] Test email delivery (verification emails, notifications)
- [ ] Configure SPF/DKIM records for custom domain (if applicable)

### R2 Storage (Cloudflare)
```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

**Action Items:**
- [ ] Set up Cloudflare R2 bucket
- [ ] Configure CORS settings for R2 bucket
- [ ] Set up public access policy (if needed)
- [ ] Test file uploads (vehicle images, dispute photos, etc.)

### ImageKit (Image Optimization)
```env
IMAGEKIT_PUBLIC_KEY=your-public-key
IMAGEKIT_PRIVATE_KEY=your-private-key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id
```

**Action Items:**
- [ ] Set up ImageKit account
- [ ] Configure image transformations
- [ ] Test image optimization and CDN delivery

## 🟡 Important (Should Set Before Launch)

### Site Configuration
```env
NEXT_PUBLIC_SITE_URL=https://renegaderentals.com
NEXT_PUBLIC_APP_NAME=Renegade Race Rentals
```

**Action Items:**
- [ ] Set production domain URL
- [ ] Update all references to use production domain
- [ ] Configure SSL certificate
- [ ] Set up domain DNS records

### Analytics & Monitoring (Optional but Recommended)
```env
# Google Analytics (if using)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Sentry Error Tracking (✅ Configured in codebase)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
# Optional: For source maps and releases
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

**Action Items:**
- [ ] Set up Sentry account at https://sentry.io
- [ ] Create a new project for the web app
- [ ] Copy the DSN and add to `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Configure Sentry project settings:
  - [ ] Set up alerting rules
  - [ ] Configure release tracking (optional)
  - [ ] Set up source maps (optional, for better error details)
- [ ] Set up Google Analytics (or alternative)
- [ ] Configure uptime monitoring
- [ ] Set up performance monitoring

## 🔵 Optional (Can Set Post-Launch)

### Social Media Integration
```env
# If adding social login or sharing
FACEBOOK_APP_ID=...
TWITTER_API_KEY=...
```

### Additional Services
```env
# If using additional services
MAPS_API_KEY=...  # For location features
```

## Pre-Launch Verification Checklist

Before going live, verify:

- [ ] All environment variables are set in production environment
- [ ] `RESEND_TEST_MODE=false` is set (critical!)
- [ ] All API keys are production keys (not test keys)
- [ ] Webhook endpoints are configured and tested
- [ ] Email delivery works (send test emails)
- [ ] Payment processing works (test with real cards, small amounts)
- [ ] File uploads work (test image uploads)
- [ ] Authentication flows work (sign up, sign in, password reset)
- [ ] All external services are accessible from production
- [ ] Error tracking is configured and working
- [ ] Analytics are tracking correctly

## Security Checklist

- [ ] No API keys are committed to git
- [ ] Environment variables are set securely in deployment platform
- [ ] Production database is separate from development
- [ ] Rate limiting is configured
- [ ] CORS is properly configured
- [ ] SSL/TLS is enabled
- [ ] Security headers are configured

## Post-Launch Monitoring

After launch, monitor:

- [ ] Error rates in error tracking service
- [ ] Payment success/failure rates
- [ ] Email delivery rates
- [ ] API response times
- [ ] Server resource usage
- [ ] User sign-up and authentication success rates

---

**Last Updated:** $(date)
**Next Review:** After production deployment
