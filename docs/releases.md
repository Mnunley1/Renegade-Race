# Releases

**Feature branch → `dev` (staging and testing) → `main` (production).**

## Daily work

1. Create a feature branch from the latest `dev` and open its PR against `dev`.
2. Pass CI and review the change, then merge. Vercel deploys `dev` to staging.
3. Test the combined changes on staging. Record the tested SHA and results on the
   release PR or Linear issue.
4. Open a PR from this repository's `dev` branch to `main`. Once staging is
   accepted and required checks pass, merge it to release. Both Vercel projects
   automatically build and assign the new production deployments to live domains.
5. Merge `main` back into `dev` through a passing PR after a release so the next
   release includes the previous release merge commit. Do not reset either branch.

`dev` is the default branch and PR target. Use merge commits in both directions
between `dev` and `main`; squash/rebase are only for short-lived feature PRs.
This preserves ancestry between the long-lived branches. A release PR is the production
approval boundary; there is no additional routine Vercel promotion step.

## Required checks

Both `dev` and `main` require an up-to-date PR, resolved review conversations and
these GitHub Actions checks:

- `Branch Flow` (PRs into `main` must come from this repository's `dev`)
- `Lint & Type Check`
- `Backend Tests`
- `Web Tests`
- `Build` (web and admin)

Force pushes and deletion are blocked, with no bypass actors. The owner can merge
their own passing PR; a second-account approval is not required. CI uses Node 22,
pnpm 10.4.1 and frozen installs on PRs and pushes to both branches. The build uses
placeholder service configuration; it is not a staging integration test.

## Environments and backend compatibility

Web's Vercel `staging` environment tracks `dev`. Admin's staging domain tracks
the `dev` Preview deployment. Production tracks `main` in both projects, with
**Auto-assign Custom Production Domains enabled**. Feature branches get previews.

Convex deployment is currently separate from Vercel Git builds. Neither frontend
build deploys the shared backend, and GitHub CI has no deployment credentials.
Before accepting staging, verify that both apps use the intended nonproduction
Convex revision. Exercise authentication, authorization, uploads and sandbox
payments. Set `NEXT_PUBLIC_SKIP_REQUIRED_PHOTOS=false` for production-parity tests.

Before merging a release to `main`, verify compatibility with the live backend.
If backend/schema changes are needed, obtain approval and deploy compatible
Convex changes once for both apps before the frontend release. Existing frontends
and open browser sessions must continue to work. Record backend and frontend SHAs,
migration steps and rollback constraints. Reverting a frontend does not revert
backend code or data. Coordinated backend automation is separate work; do not
silently add production deploy commands to frontend builds.

## Existing production baselines

The protected tags `production-web-2026-11-17`, `production-admin-2026-11-17` and
`production-convex-2026-11-17` record the verified live baselines when this branch
flow was adopted. Production's backend includes endurance-seat work absent from
`main`; `main` includes invoice/ACH and Paddock work absent from that backend.
REN-6 reconciles those backend features additively on `dev`: endurance seats and
timing coexist with invoices/ACH and Paddock. Legacy and endurance race-event
records remain valid. Rental requests retain the live inclusive 1–3 day rules;
REN-11 tracks any later policy change. Existing reservations retain their stored
duration at payment time.

The reconciled backend targets the nonproduction `earnest-panther-585` deployment,
with Clerk's `sure-rattler-22` test instance, Stripe test mode, and the separate
`renegade-race-dev` bucket. Run the [staging smoke test](../scripts/ren6-staging-smoke.md)
and record its exact frontend/backend revisions before an application release.
Production remains on the tagged baselines until a separately approved release.
Seat-specific frontend parity and seat checkout hardening require separate review;
the rental smoke test does not establish seat-flow readiness. Passing CI alone
does not establish production compatibility.

## Account deletion preflight (REN-18)

Settings calls the authenticated `users.checkUserDeletionEligibility` action before
requesting deletion of the Clerk identity. A blocking rental obligation, balance,
or failed eligibility check leaves sign-in intact and displays a reason. Retrying
always performs a fresh check; concurrent submissions and dialog dismissal are
blocked while the request is running. A Clerk failure leaves the dialog open for
retry and does not navigate away.

This preflight is not an atomic guarantee across Clerk, Stripe, and Convex. The
signed Clerk deletion webhook and final Convex transaction continue to recheck
eligibility; they remain authoritative if obligations change after preflight.
The flow does not cancel bookings or erase historical payment records. Validate
the frontend ordering tests and backend deletion ownership suite before release.

REN-32 extends the shared backend check to include approved bookings, even after
their rental dates, because they remain payable until resolved. Pending and
processing rental payments block both the renter and host regardless of booking
date or status. All payment attempts are checked, not just the booking's current
payment pointer. Cancellation alone does not unblock deletion while a payment
remains unsettled. Settled financial records are retained; eligibility resumes
only when the remaining rental and Stripe balance checks also pass. No schema
migration or payment-state rewrite is required.

## Public media ownership (REN-30)

Team logos, Paddock post attachments, and platform-hosted driver portfolio media
require the signed-in uploader's recorded general upload. Driver and coach
avatars require a recorded profile upload; the same profile upload can still be
used for both the user and driver profile. The validators bind the current bucket,
owner, purpose, and server-issued namespace. Booking evidence, listing/draft
uploads, foreign keys, and unissued references cannot be attached as public media.

The current driver form sends a full URL rather than a key. Convex's
`R2_PUBLIC_URL` must equal the frontend's public bucket origin (HTTPS, no trailing
slash); it defaults to `https://images.renegaderace.com` for compatibility with the
production client. Set staging to
`https://pub-a50e44fe83ed433f81cb9d89aa0e106b.r2.dev` before deploying this backend.
Platform URLs must match that origin and an authorized key exactly, with no query,
fragment, or alternate encoding. If a writer supplies both URL and key, they must
match. This origin configuration does not grant ownership of any object.

Driver portfolios retain their existing external HTTP(S) image/video links.
Known platform delivery, storage, and app hosts are not treated as external links;
their URLs cannot bypass upload checks. External links remain externally hosted
content, not proof of platform upload ownership. New arbitrary external URLs are
not accepted as team logos or driver/coach avatars; those clients use uploads.

Unrelated edits and exact unchanged media values on the same authorized record
preserve legacy display. Changing a media field validates the resulting URL/key
pair; clear a legacy counterpart or replace it with the matching verified value.
This does not authorize copying an unverified legacy reference onto another record.
Existing media is neither rewritten nor deleted. New coaching reviews reject
nonempty photo arrays because no ownership-bound coaching upload flow exists;
text-only reviews and historical photo display remain supported.

No schema migration is required. Verify both legacy/current clients and the
configured origin on staging before a separately approved production rollout.
Production source verification and any historical media remediation remain
separate from these write-boundary checks.

## Profile image ownership (REN-23)

New profile photos must use `r2.generateProfileImageUploadUrl`, then pass its key
to `users.updateProfileImage`. The backend checks the issuance record's bucket,
owner and profile namespace. Other users' uploads, unrecorded keys and reservation
evidence cannot be assigned as profile photos. Existing server-recorded profile
uploads remain supported; the current client does not need a metadata-sync call.

The unused `vehicles.generateUploadUrl` Convex-storage signer and new
`storageId` profile assignments are retired with a re-upload error. Legacy blobs
have no reliable uploader record, so their ownership cannot be inferred from a
supplied ID. Existing profile URLs and stored bytes remain unchanged. There is
no data migration, deletion or historical-publication audit in this change.

Validate the profile ownership, return evidence and onboarding ownership suites
against the reconciled backend and the production-compatible patch before a
separately approved backend release. Other public media writers are tracked in
REN-30; reservation attachment validation remains REN-25.
