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

CI cancels superseded runs within the same pull request or pushed branch. Pull
request runs and push runs have separate concurrency groups, so editing a merged
PR cannot cancel the branch's post-merge checks. PR edits still rerun checks to
validate changes to the target branch.

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

## Rental currency displays (REN-31)

Rental rates, add-on prices, reservation totals, payment amounts, card fees, and
refunds remain integer USD cents. Web rental views use `formatRentalUsd` from
`apps/web/lib/rental-checkout.ts` at the display boundary, preserving two decimal
places. Keep aggregation in cents; do not round each booking to whole dollars.
This release does not rescale stored values or change historical Stripe charges.

A reservation total is the rental subtotal, before the renter's card-processing
fee. Payment checkout shows the server-returned processing fee and total due.
Trips and rental confirmation use the existing authenticated self-scoped payment
query for the reservation's current payment: only captured payment states display
paid subtotal, fee, total charged, and succeeded refunds. A pending/failed payment
or missing ledger record never implies a charge. Captured totals use the recorded
capture when available, otherwise the verified subtotal plus processing fee.
Host reservation aggregates are labeled rental subtotals, not net earnings.

Cancellation amounts are estimates against the paid rental subtotal under the
vehicle's current cancellation policy, excluding card-processing fees and reduced
by recorded succeeded refunds. The server still determines the final amount at
cancellation, including pending refunds and settlement. Missing payment data
shows an unavailable estimate instead of a promised refund.

REN-31 is frontend-only: no Convex deployment or data migration is required.
Listing price-entry/filter unit boundaries and required add-on validation remain
separate follow-ups; no rental-date or host-approval rules change here.

## Rental dollar inputs and filters (REN-33)

Editable rental rate and add-on fields contain USD dollar text. Convert with
`dollarsToCents` in `apps/web/lib/rental-money.ts` when accepting an edit or
submitting a new value. The helper parses decimal text, rounds half-up to the
nearest cent, and rejects negative, malformed, or unsafe amounts. New or changed
daily rates must be positive; free add-ons are allowed. Pending add-on records, onboarding
drafts, API payloads, and persisted prices remain cents. Render existing values
with `centsToDollarInput` when opening an editor; never multiply stored records.
Untouched legacy values are preserved, including fractional-cent records that
require separate historical review. A formatting change is not a data migration.

Catalog inputs and slider values are dollars, with inclusive cent-valued bounds
used for comparison. New links use explicit dollar parameters such as
`priceUsd=10.23-20.00`. Existing `price=1023-2000` links and saved cent-valued
filter state keep their original meaning. When both URL parameters exist,
`priceUsd` takes precedence. Clearing price filters removes both parameters.
Invalid or reversed user input does not replace the current valid filter.

This is a frontend boundary fix with no Convex deployment or stored-data
correction. Historical listing/draft values need independent evidence before
remediation; magnitude alone cannot establish whether a host intended dollars
or cents. Historical reservations and Stripe amounts remain unchanged. Required
add-on enforcement remains REN-16.

## Validated rental quotes (REN-16)

New rental requests validate every selected add-on against the listing, reject
duplicates, altered prices or cadence, and require all mandatory add-ons. The
server stores the canonical quote with `quoteVersion: 1`. Its daily rate, occupied
day count, add-ons and rental subtotal stay fixed through host approval and both
Stripe payment entry points. Later listing edits apply to new requests. Card
processing fees remain separate and are calculated by the server at payment.

Unversioned unpaid requests must exactly match the current listing's rate,
required add-ons, prices, cadence and stored total before approval or payment.
Approval can mark that verified quote; an unverifiable request must be submitted
again for host approval. There is no bulk migration or historical financial
rewrite. Existing rental duration and overlapping-date rules remain unchanged.

Request confirmation, host approval and payment display the saved quote. A failed
payment initialization stops until an explicit retry or a meaningful booking
change; repeated query updates do not create an automatic retry loop.

Deploy this additive backend/schema change before the frontend. Old clients can
continue sending their existing add-on shape, but invalid or incomplete selections
will be rejected. Reverting the frontend preserves validation; reverting the
backend would remove the quote guarantee and is not a safe routine rollback.
Verify both payment paths in Stripe test mode, including listing edits after the
request and rejection of unverifiable legacy bookings, before production approval.

## Rental date holds (REN-34)

Rental requests still use 1–3 inclusive occupied days and keep their validated
quote. Pending requests may compete for otherwise free dates. Host-blocked dates
and approved/confirmed bookings exclude the vehicle from date search and prevent
new requests or conflicting approvals. Approval checks and declining competing
pending requests happen in one transaction. Hosts cannot add a block across an
approved/confirmed booking; resolve the booking first. No existing booking is
automatically cancelled, repriced or refunded by this release.

Checkout checks the whole chosen interval, including blocked middle days, and
waits for availability before enabling submission. Both Stripe entry points
check the same holds, and payment attachment/confirmation recheck after external
Stripe calls. An external capture that cannot safely confirm a booking remains
recorded as a genuine payment, with explicit reconciliation evidence and notices.
It must not silently confirm a second booking or trigger an automatic refund.
Duplicate events must not reopen a held booking after a conflict disappears.
Renter and host views show the review hold instead of another payment request.
Participant cancellation is blocked until support resolves the captured payment;
it must not enter ordinary automatic cancellation/refund handling.

Deploy the compatible backend first, then the checkout UI. Inventory historical
approved/confirmed overlaps and host-block conflicts before production rollout;
unresolved records need owner review. This is not a migration or a reinterpretation
of historical dates/prices. A frontend rollback cannot remove the backend holds.
Guest draft restoration and consistent date-entry presentation are REN-35;
terminal unpaid Stripe attempt reconciliation is REN-36.

## Guest rental selections (REN-35)

Guests may choose a vehicle, start date, 1–3 inclusive days and add-ons before
signing in. Only the request form at `/checkout` is public; payment, request
confirmation and other account routes remain protected. Authentication returns
to a validated same-origin relative destination across sign-in and sign-up.

A bounded, expiring draft in the current tab preserves choices, not an approved
price. Restore add-on identities against the current listing, retain current
mandatory add-ons, and use current prices/cadence and availability for review.
Restoration never submits a booking automatically. The server still validates
and freezes the quote when the renter explicitly sends the request. Existing
reservation quotes and dates are unchanged.

New rental requests use a start date plus 1, 2 or 3 occupied days. Unsupported
incoming ranges require correction instead of silently shortening them. Display
date-only rental values as local calendar dates to avoid timezone shifts. Legacy
listing duration preferences do not override the 1–3-day request policy and are
not migrated by this release. This is a frontend-only staging change on top of
REN-34; it requires no new backend deployment or data migration.

## Terminal unpaid rental attempts (REN-36)

A canceled Stripe PaymentIntent or expired unpaid Checkout Session is terminal.
Authenticated platform webhooks reconcile only the matching rental attempt,
checking its Stripe object, participants, currency and total. Duplicate or stale
events must never downgrade a captured/refunded payment or replace a newer
booking payment state. Financial records are retained.

An unpaid booking remains approved until a participant explicitly cancels it.
After a terminal attempt, the renter cancels that booking in My Trips and submits
a fresh request for host approval. The old reservation's fixed Stripe idempotency
keys are not reused to start another attempt. Ordinary failed card attempts may
still retry their existing PaymentIntent. An approved booking continues to block
account deletion; a terminal unpaid ledger alone must not block deletion after
that booking is canceled, while active attempts still do.

Deploy the compatible backend before the frontend. The staging platform webhook
must include `payment_intent.canceled`, `checkout.session.expired` and
`checkout.session.completed` in addition to its existing subscriptions. Review
production subscriptions separately before an authorized production rollout.
Reconcile old rows only from independently retrieved Stripe objects/events with
matching ownership and amounts; do not infer terminal status from age, rewrite
settled states, delete evidence, or automatically cancel approved bookings.

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

## Catalog request states (REN-10)

The catalog count means matching listings in the returned search set, after
client filters and before local pagination. It includes coming-soon listings;
it is not a count of guaranteed bookings or available rental dates. The existing
backend search cap of 500 remains unchanged. Catalog and mobile-filter counts
show loading until their required queries resolve, including review statistics
when a rating filter is active. Empty searches show recovery controls instead of
claiming the platform has no available inventory.

Grid and list cards use the same server readiness flag as vehicle details:
`true` means **Ready to request**, `false` means **Coming soon**, and an absent
flag makes no readiness claim and disables the detail request action. Cards
remain links to **View details**. Ready detail pages offer **Request rental** and
explain that host approval precedes payment. Selecting dates alone never adds an
**Available** badge. Existing date filtering, overlapping request rules, and
payment ownership checks are unchanged; request readiness is not a guarantee
that a payment will pass the later Stripe checks.

PR #33 already shipped PR #32's visibility change and the coming-soon gate.
The remaining unmerged PR #32 work is an interest table, cooldown/rate limit,
host notification/email, and Notify me UI. Its copy promises renter emails when
readiness changes, but that follow-up delivery was not implemented. REN-10 does
not import this separate feature or reintroduce Stripe account fields into
public owner profiles. Preserve PR #32 for a separately scoped decision.

Before a production release, verify slow initial loading, a zero-result search,
coming-soon and ready listings in grid/list and desktop/mobile details, plus
unchanged date propagation into checkout. No schema migration is required.
