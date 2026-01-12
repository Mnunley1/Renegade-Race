# Launch Checklist - Renegade Race Rentals

## 🚨 Critical Issues (Must Fix Before Launch)

### 1. Remove/Protect Debug & Admin Pages
- **Location**: `apps/web/app/admin/seed/page.tsx`
- **Issue**: Seed database page is publicly accessible
- **Action**: 
  - Remove the page entirely OR
  - Add authentication/authorization protection
  - Consider moving to admin app only

- **Location**: `apps/admin/app/debug/page.tsx`
- **Issue**: Debug page exposes sensitive user information
- **Action**: 
  - Remove debug logging in production
  - Add environment check: `if (process.env.NODE_ENV === 'production') return null`
  - Or restrict to super-admin only

### 2. Remove Console.log Statements
- **Found**: 105+ console.log/error/warn statements throughout codebase
- **Action**: 
  - Remove all `console.log()` statements
  - Keep `console.error()` for error tracking but wrap in production logger
  - Consider using a logging service (Sentry, LogRocket, etc.)

**Key files with excessive logging:**
- `apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx` (lines 54-55, 71, 75, 80-81, 107-108)
- `apps/admin/proxy.ts` (lines 42-48) - Already has dev check, but should be removed
- `packages/backend/convex/r2.ts` (line 97)
- `packages/backend/convex/http.ts` (lines 72, 91, 121)

### 3. Fix TypeScript Build Configuration
- **Location**: `apps/web/next.config.mjs` & `apps/admin/next.config.mjs`
- **Issue**: `ignoreBuildErrors: true` is enabled
- **Action**: 
  - Fix all TypeScript errors
  - Remove `ignoreBuildErrors: true`
  - Ensure type safety for production

### 4. Complete TODO Items

#### High Priority TODOs:
1. **Rating Calculations** (Multiple locations)
   - `apps/web/app/vehicles/page.tsx` (lines 214-215, 219)
   - `apps/web/app/page.tsx` (lines 36-37)
   - `apps/web/app/r/[id]/page.tsx` (lines 38-39)
   - `apps/web/app/favorites/page.tsx` (lines 40-41)
   - `apps/web/app/host/vehicles/[id]/page.tsx` (line 96)
   - **Action**: Implement rating calculation from reviews

2. **Photo Upload Implementation** (Multiple locations)
   - `apps/web/app/trips/review/[reservationId]/page.tsx` (line 125)
   - `apps/web/app/trips/return/[reservationId]/page.tsx` (line 102)
   - `apps/web/app/trips/dispute/[reservationId]/page.tsx` (line 86)
   - `apps/web/app/host/returns/[reservationId]/page.tsx` (line 72)
   - **Action**: Implement photo upload to R2 storage

3. **User Rating Updates**
   - `packages/backend/convex/reviews.ts` (lines 556, 636)
   - `packages/backend/convex/rentalCompletions.ts` (line 404)
   - **Action**: Implement scheduler to update user ratings after review creation/deletion

### 5. Production Environment Variables

**Status**: ✅ Comprehensive checklist created in `PRODUCTION_ENV_CHECKLIST.md`

**Action Items:**
- [ ] Review `PRODUCTION_ENV_CHECKLIST.md` before deployment
- [ ] Set up production Clerk instance
- [ ] Deploy Convex to production
- [ ] Set up Stripe production account
- [ ] Configure Resend production API key
- [ ] **CRITICAL**: Set `RESEND_TEST_MODE=false` in production
- [ ] Verify all webhook endpoints are configured
- [ ] Test all external service integrations

### 6. ✅ Remove Development-Only Code - COMPLETED
- **Status**: Development-specific messaging made conditional
- **Files Updated**:
  - ✅ `apps/web/app/(auth)/verify-email/page.tsx` - Test email messaging now only shows in development
  - ✅ Development-specific error messages wrapped in `process.env.NODE_ENV === "development"` checks
- **Note**: `apps/admin/proxy.ts` debug logging is already wrapped in development check (acceptable)

## ⚠️ Important Issues (Should Fix Before Launch)

### 7. Error Handling & User Experience
- **Issue**: Many `console.error()` calls without user-facing error messages
- **Action**: 
  - Implement proper error boundaries
  - Add user-friendly error messages
  - Consider error tracking service (Sentry)

### 8. Security Review
- [ ] Verify all API routes are protected
- [ ] Check for SQL injection vulnerabilities (if using raw queries)
- [ ] Review authentication middleware
- [ ] Ensure sensitive data is not logged
- [ ] Verify CORS settings for production domains
- [ ] Check rate limiting on API endpoints

### 9. Performance Optimization
- [ ] Review image optimization (ImageKit configuration)
- [ ] Check bundle size and code splitting
- [ ] Verify lazy loading for images
- [ ] Review database query optimization
- [ ] Check for N+1 query problems

### 10. Analytics & Monitoring
- **Current**: Basic vehicle analytics (views, shares)
- **Action**: 
  - Set up production analytics (Google Analytics, Plausible, etc.)
  - Configure error tracking (Sentry, LogRocket)
  - Set up uptime monitoring
  - Configure performance monitoring

### 11. Content & Copy Review
- [ ] Review all user-facing text
- [ ] Check for placeholder content
- [ ] Verify contact email (`support@renegade.com` - line 64 in contact page)
- [ ] Review terms of service and privacy policy links
- [ ] Check all help/documentation pages

### 12. Testing Checklist
- [ ] Test complete user registration flow
- [ ] Test vehicle booking flow end-to-end
- [ ] Test payment processing
- [ ] Test email notifications
- [ ] Test admin functions
- [ ] Test mobile responsiveness
- [ ] Test error scenarios
- [ ] Load testing for expected traffic

### 13. Legal & Compliance
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] Cookie consent (if applicable)
- [ ] GDPR compliance (if EU users)
- [ ] Payment processing compliance (PCI DSS)

### 14. ✅ SEO & Meta Tags - COMPLETED
- ✅ Added comprehensive meta tags to root layout
- ✅ Configured Open Graph tags for social sharing
- ✅ Set up sitemap.ts (Next.js 15 sitemap generation)
- ✅ Configured robots.txt
- ⚠️ Structured data (JSON-LD) - Can be added post-launch for specific pages

### 15. Deployment Configuration
- [ ] Set up production domain
- [ ] Configure SSL certificates
- [ ] Set up CDN (if applicable)
- [ ] Configure environment-specific builds
- [ ] Set up CI/CD pipeline
- [ ] Configure database backups
- [ ] Set up monitoring alerts

## 📋 Nice-to-Have (Can Fix Post-Launch)

### 16. Code Quality
- [ ] Add unit tests for critical functions
- [ ] Add integration tests for key flows
- [ ] Set up automated testing in CI/CD
- [ ] Improve TypeScript type coverage

### 17. Documentation
- [ ] Update README with production setup
- [ ] Document API endpoints
- [ ] Create runbook for common issues
- [ ] Document deployment process

## 🔍 Pre-Launch Verification

### Final Checks:
1. [ ] Run `pnpm build` successfully without errors
2. [ ] Run `pnpm lint` and fix all issues
3. [ ] Test in production-like environment
4. [ ] Verify all external services are configured
5. [ ] Check all links work correctly
6. [ ] Verify email delivery works
7. [ ] Test payment processing with test cards
8. [ ] Verify admin functions work correctly
9. [ ] Check mobile experience
10. [ ] Review browser console for errors

## 🚀 Launch Day Checklist

- [ ] Deploy to production
- [ ] Verify all environment variables are set
- [ ] Test critical user flows
- [ ] Monitor error logs
- [ ] Check analytics are tracking
- [ ] Verify email notifications work
- [ ] Test payment processing
- [ ] Monitor server performance
- [ ] Have rollback plan ready

---

## Priority Summary

**Must Fix (Blockers):**
1. ~~Remove/protect debug pages~~ ✅ COMPLETED
2. ~~Remove console.log statements~~ ✅ COMPLETED  
3. ⚠️ Fix TypeScript build errors (Can launch with ignoreBuildErrors, but should fix post-launch)
4. Set RESEND_TEST_MODE=false (Environment variable - set in production deployment)
5. ~~Complete critical TODOs (ratings, photo uploads, notifications)~~ ✅ COMPLETED

**Should Fix (Important):**
6. Production environment variables
7. Error handling improvements
8. Security review
9. Analytics setup

**Nice to Have:**
10. Testing infrastructure
11. Documentation
12. Performance optimizations

---

**Estimated Time to Complete Critical Items: 2-3 days**
**Estimated Time for Important Items: 1-2 days**

