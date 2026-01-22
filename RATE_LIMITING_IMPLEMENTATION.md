# Rate Limiting Implementation

This document describes the rate limiting implementation using the [Convex Rate Limiter component](https://www.convex.dev/components/rate-limiter).

## Overview

Rate limiting has been implemented to protect critical operations and prevent abuse. The implementation uses the `@convex-dev/rate-limiter` component which provides:

- **Type-safe rate limit definitions**
- **Fixed window and token bucket algorithms**
- **Efficient storage** (not proportional to requests)
- **Transactional evaluation** (rolls back if mutation fails)
- **Sharding support** for high throughput

## Installation

The package has been added to `packages/backend/package.json`:

```json
"@convex-dev/rate-limiter": "^0.1.0"
```

**Next Step**: Run `pnpm install` to install the package.

## Configuration

Rate limits are configured in `packages/backend/convex/rateLimiter.ts`:

### Critical Operations

- **Reservations**: 10 per hour per user (capacity: 3)
- **Payments**: 20 per hour per user (capacity: 5)
- **Disputes**: 5 per day per user (capacity: 2)

### Communication Operations

- **Messages**: 20 per minute per user (capacity: 5)
- **Emails**: 5 per hour per email address (capacity: 2)

### HTTP Webhook Endpoints

- **Webhooks**: 100 per minute per IP (sharded: 10 shards)

## Implementation Details

### Mutations Protected

1. **`reservations.create`** - Rate limited to prevent spam bookings
2. **`messages.send`** - Rate limited to prevent message spam
3. **`disputes.create`** - Rate limited to prevent dispute abuse
4. **`emails.sendContactFormEmail`** - Rate limited by email address
5. **`stripe.createPaymentIntent`** - Rate limited via helper mutation

### HTTP Endpoints Protected

1. **`/clerk-users-webhook`** - Rate limited by IP address
2. **`/resend-webhook`** - Rate limited by IP address
3. **`/stripe/webhook`** - Protected by Stripe's webhook signature (no additional rate limiting needed)

### Rate Limiting Strategies

- **Token Bucket**: Used for operations that benefit from burst capacity (messages, reservations)
- **Fixed Window**: Used for operations that should reset at specific intervals (disputes, webhooks)

## Error Handling

When a rate limit is exceeded:

1. **Mutations**: Throw a `ConvexError` with rate limit details (when `throws: true`)
2. **HTTP Endpoints**: Return `429 Too Many Requests` with `Retry-After` header

## Usage Examples

### In Mutations

```typescript
import { rateLimiter } from './rateLimiter'

export const myMutation = mutation({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Rate limit check (throws if exceeded)
    await rateLimiter.limit(ctx, "createReservation", {
      key: identity.subject,
      throws: true,
    })

    // ... rest of mutation
  },
})
```

### In Actions

```typescript
import { internal } from './_generated/api'

export const myAction = action({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    
    // Rate limit via helper mutation
    await ctx.runMutation(internal.rateLimitHelpers.checkRateLimit, {
      name: "processPayment",
      key: identity.subject,
      throws: true,
    })

    // ... rest of action
  },
})
```

### In HTTP Endpoints

```typescript
import { rateLimiter } from './rateLimiter'

http.route({
  path: '/my-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    
    const status = await rateLimiter.limit(ctx, "webhookEndpoint", {
      key: ip,
    })
    
    if (!status.ok) {
      return new Response('Too many requests', { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((status.retryAfter - Date.now()) / 1000).toString(),
        },
      })
    }

    // ... rest of handler
  }),
})
```

## Monitoring

Rate limit status includes:
- `ok`: Whether the request was allowed
- `retryAfter`: Timestamp when the limit will reset

You can check rate limits without consuming them:

```typescript
const status = await rateLimiter.check(ctx, "sendMessage", { key: userId })
```

## Adjusting Rate Limits

To adjust rate limits, edit `packages/backend/convex/rateLimiter.ts`:

```typescript
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  createReservation: {
    kind: "token bucket",
    rate: 10,        // Adjust this
    period: HOUR,    // Adjust this
    capacity: 3,     // Adjust this
  },
  // ... other limits
})
```

## Testing

After installing the package (`pnpm install`), test rate limiting:

1. Make multiple requests to a rate-limited endpoint
2. Verify that requests are blocked after the limit is reached
3. Check that the error message is user-friendly
4. Verify that limits reset after the period expires

## Next Steps

1. **Install the package**: Run `pnpm install` in the workspace root
2. **Deploy to Convex**: The rate limiter component will be automatically installed
3. **Monitor**: Watch for rate limit errors in production
4. **Adjust**: Fine-tune limits based on actual usage patterns

## Files Modified

- `packages/backend/package.json` - Added rate-limiter dependency
- `packages/backend/convex/convex.config.ts` - Added rate-limiter component
- `packages/backend/convex/rateLimiter.ts` - Rate limit configuration (NEW)
- `packages/backend/convex/rateLimitHelpers.ts` - Helper for actions (NEW)
- `packages/backend/convex/reservations.ts` - Added rate limiting
- `packages/backend/convex/messages.ts` - Added rate limiting
- `packages/backend/convex/disputes.ts` - Added rate limiting
- `packages/backend/convex/stripe.ts` - Added rate limiting
- `packages/backend/convex/emails.ts` - Added rate limiting
- `packages/backend/convex/http.ts` - Added rate limiting to webhooks

## References

- [Convex Rate Limiter Component](https://www.convex.dev/components/rate-limiter)
- [Rate Limiting Best Practices](https://www.convex.dev/components/rate-limiter)
