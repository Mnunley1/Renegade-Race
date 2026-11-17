# REN-6 staging smoke test

Run this only against `earnest-panther-585` and the `dev` staging web application.
The script refuses other Convex URLs, live Stripe/Clerk keys, unmarked users,
inactive sessions, and vehicles not owned by the synthetic host. It uses real
Clerk `convex` JWTs and the application's public functions; it never impersonates
users with a Convex admin key or directly patches booking/payment records.

## Prerequisites

- Deploy the reconciled backend to the dev deployment. Verify both staging apps
  use its URL, Clerk's `sure-rattler-22` test instance, and matching Stripe test
  publishable keys. Keep production frontend/backend builds unchanged.
- Verify dev storage uses `renegade-race-dev`, `RESEND_TEST_MODE=true`, and `WEB_URL`
  points to the staging web app. Set `NEXT_PUBLIC_SKIP_REQUIRED_PHOTOS=false` for
  the web staging build so the onboarding test includes required uploads.
- Verify actual Clerk `user.created`/`user.updated` delivery to
  `https://earnest-panther-585.convex.site/clerk-users-webhook` and actual Stripe
  delivery to `https://earnest-panther-585.convex.site/stripe/webhook`.
- Create distinct synthetic renter and host accounts in the Clerk test instance.
  Mark each user's `private_metadata` with `{ "ren6Smoke": true }`. Never reuse
  real customer accounts. Sign in through the app and verify their Convex user
  records came from the Clerk webhook. The Clerk `convex` JWT template must use
  audience `convex` and the expected issuer.
- Create the host's Stripe test Connect account through the ownership-safe app
  onboarding action, complete test onboarding, and verify its `renegadeUserId`
  metadata matches the host. Do not reuse or unblock an unverified legacy link.
- Create an approved, active synthetic vehicle belonging to that host, with
  `REN-6` in its description, a daily rate of 100–10000 **cents**, required photos,
  and an active track. Use the normal listing and admin approval flows. Ensure
  test-user notification preferences allow reservation/payment updates.

## Local configuration

Keep this file outside the repository, with mode `0600`. Replace placeholders
and choose a future date; `durationDays` is 1–3 occupied days inclusive.

```json
{
  "convexUrl": "https://earnest-panther-585.convex.cloud",
  "webUrl": "https://renegade-web-env-staging-nineonenine.vercel.app",
  "renterId": "user_REPLACE",
  "hostId": "user_REPLACE",
  "renterSessionId": "sess_REPLACE",
  "hostSessionId": "sess_REPLACE",
  "vehicleId": "REPLACE",
  "startDate": "2030-06-10",
  "durationDays": 2
}
```

Provide `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` through
the process environment using the approved secret source. Never paste keys in
command arguments, source control, screenshots or evidence. The script refreshes
short-lived JWTs from the supplied genuine Clerk sessions; it does not write JWTs
or payment client secrets. The local config receives booking/intent/event IDs so
cleanup can be resumed after a failure.

## Phases and browser checks

For each phase, run the same command with the phase name changed:

```sh
python3 scripts/ren6-staging-smoke.py preflight \
  --config /private/tmp/ren6-fixture.json \
  --evidence /private/tmp/ren6-smoke-evidence.json
```

1. `preflight`: verifies the allowlisted service targets, test credentials,
   synthetic identities, active genuine Clerk sessions, and synthetic vehicle.
2. `request`: creates a renter request and asserts pending state, inclusive
   duration and the persisted amount. In the renter browser, verify the pending
   trip. In the host browser, verify the incoming request. Capture screenshots.
3. `approve`: approves as the host. Verify host approval and renter's payment
   action in `/host/reservations` and `/trips`.
4. `decline`: creates the payment through the app and confirms with Stripe's
   `pm_card_chargeDeclined`. Waits for actual Stripe webhook delivery and asserts
   reservation remains approved, payment is failed, and exactly one payment row
   exists. Open `/checkout/success?reservationId=...` as the renter: it must not
   show confirmed/success. Capture the failed/awaiting view.
5. `pay`: retries the same intent with `pm_card_visa`. Waits for the real webhook
   and asserts confirmed/paid state, charge/payment linkage, one financial record,
   and matching renter/host query projections. Verify both browser views and
   the success page. The API runner does not replace this browser verification.
6. `duplicate`: fetches the **real** Stripe success event and replays the same
   event ID/body to the staging webhook with a fresh test signing signature.
   This is a signed duplicate transport replay, not a fabricated Stripe event.
   It checks one financial record, one success notification, and unchanged paid
   state. Separately use a read-only operator query to verify one
   `webhookEvents` receipt for the recorded `successEventId`; the runner has no
   admin database access. Record the count, not raw records or secrets.
7. `cleanup`: cancels as the host through the application. For a paid booking,
   waits for the automatic full test refund and verifies Stripe's charge is fully
   refunded. For an unpaid booking, cancels its outstanding test intent. Financial
   rows remain for audit evidence. Verify cancelled state in both browser views.

If a phase times out, stop and inspect sanitized staging logs and provider
delivery status. Do not bypass the initial webhook with a synthetic event or
manually patch the expected state. Fix the integration and resume using the same
fixture config. `request` refuses a config that already has a reservation ID.

After evidence is collected, hide/remove the synthetic listing through the app
once no active bookings or pending payments remain. Keep test financial records;
do not bulk-delete existing staging data or copy production data into staging.
Revoke only the synthetic test sessions when finished. Record frontend/backend
revisions, deployment IDs, sanitized phase output, role screenshots, duplicate
receipt count, refund result and the final unchanged production baselines in
Linear. Account onboarding, listings, photo uploads, browser role views and
webhook receipt count remain explicit checks outside this API runner.

References: [Stripe testing](https://docs.stripe.com/testing),
[Clerk session JWTs](https://clerk.com/docs/reference/backend/sessions/get-token).
