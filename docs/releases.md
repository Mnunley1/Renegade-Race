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
`packages/backend` owns the shared Convex project for both apps. Use the
[shared backend workflow](backend-workflow.md) for canonical local/staging
commands, explicit target selection and matching the reviewed runtime.
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

## Failed rental refund settlement review (REN-51)

A failed or canceled rental refund creates a durable **held** settlement review.
Customer refund totals still follow Stripe's current succeeded refunds; a payment
returning to paid does not prove the host's allocation was restored. Both rental
participants see a narrow review notice. Operators see the retained provider
references and ledger evidence. Unresolved reviews block both participants'
account deletion and further refund requests on that payment. No new transfer,
capture, refund or payout is initiated by review refresh or resolution.

Failed-refund history is reconciled through the admin `rentalSettlement.refresh`
action using a payment ID. It re-reads the verified charge's complete refund list,
records customer outcomes, and captures immutable evidence snapshots. It does not
fabricate webhook receipts or change provider balances. This explicit refresh can
bring historical failed refunds under review without issuing another refund.

`rentalSettlement.resolve` requires an authenticated admin, the current evidence
ID, an operator reference and notes, followed by fresh provider reads and atomic
review/refund-version checks. It refuses closure when allocation or any required
binding is unknown. Evidence verifies captured amount/currency, charge and intent,
destination transfer and application fee, reversal/refund references, platform
failure credit and actual connected-account net debits/credits. The known sandbox
case has an original host allocation of 95 cents, a 50-cent reversal and 15-cent
fee return: 60 cents remain allocated, so the hold cannot be closed without
independent evidence accounting for the 35-cent difference. These are Stripe
balance allocations; they do not establish a completed bank payout.

An operator can supply existing compensation-transfer IDs as evidence only.
The server requires exact destination/currency and metadata
`rentalSettlementPaymentId`, `rentalSettlementRefundId`, and
`rentalSettlementOwnerId`, plus unreversed provider transfer and destination net
entries. It rejects duplicate references and over/under-compensation. No component
creates those transfers, and this feature does not authorize making one.

All-success or all-failed/canceled refund sets can be reconciled from their exact
ledger entries. Mixed successful/failed sets and pending refunds remain held when
fee attribution cannot be independently established: application-fee refund
objects do not identify their originating rental refund, so no time/proportional
guess is used. Missing or inconsistent ledger coverage likewise remains held.
Resolution actor, notes, references, timestamp and evidence are retained in the
audit log. Meaningful changed evidence reopens a resolved review; normal balance
availability changes preserve resolution while retaining the new full snapshot.

Deploy this additive schema/backend and the matching admin/participant UI to
staging first. Retain financial evidence and the prior runtime/frontend baseline.
Production rollout remains a separately approved REN-7 release decision.

## Listing data guards (REN-9)

New or changed rental-vehicle years, onboarding draft years, and optional team-car
years must be four-digit integers. This is a format guard, not an approved
business eligibility window. Unchanged legacy years remain intact when saving
unrelated edits; publishing a new listing still requires a valid year. Draft
hydration preserves legacy zero values instead of substituting the current year.

Current web vehicle labels and image descriptions use **Year unconfirmed** for
invalid legacy years, preserving the supplied make/model text. Opaque legacy
Recently Viewed cache labels remain unchanged: those entries lack structured
year/make/model fields and have no active writer, so this release neither parses
them nor guesses a replacement year. Public blank/nullish names use **User**,
including legacy nullish-only placeholder strings, while account-email display
fallbacks remain suppressed.

This change does not correct historical records, choose canonical listings,
merge duplicates, replace owner/coach names, alter image-host permissions or
broaden CSP. Those data and asset decisions require independent owner evidence.
No backfill or data migration is included. Verify the additive backend guard
and web presentation in staging before any separately approved production release.

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

## Invoice lifecycle reconciliation (REN-40)

Invoice webhooks are signals to fetch current Stripe state, not ordered commands
to change local status. The backend verifies the Stripe invoice, Basil
InvoicePayment relationship, current intent, customer, participant metadata,
USD amounts, original payout owner and application fee. Paid settlement also
requires captured charge proof. Missing registration or inconsistent evidence
retries delivery without recording a successful receipt. State and receipt commit
atomically; an optional payment-sync version detects concurrent changes during
provider reads. Old failed/processing events cannot undo newer provider state.

Terminal invoices can reconcile without a payment intent. Settled local states
remain settled; a later verified event may fill a missing paid charge reference
without notifying twice. No historical rows are bulk rewritten. Existing public
payment-method and deposit-refund actions retain their ownership safeguards.

Deploy the compatible backend before accepting staging. Keep existing Stripe
platform subscriptions and include `payment_intent.processing`, `invoice.paid`,
`invoice.payment_failed`, `invoice.voided`, and `invoice.marked_uncollectible`.
Verify card and ACH processing/success/failure with synthetic Stripe test methods,
including destination transfer/application-fee proof and unrelated-user denial.
Do not infer readiness from unit tests or manually mark an invoice paid.

## Paddock Following and team posting (REN-41)

Following contains the current user, followed users, and followed teams, including
public activities from those actors or explicit followed-team targets. Indexed
per-source reads avoid a fixed recent-global window hiding older matching posts.
Results are deduplicated, sorted, and limited; anonymous Following is empty.
Global and For You retain their existing public behavior. Posting as a team
requires its owner or an active team membership. Two additive indexes support
team posts and team-target activities; no content/privacy migration is performed.

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

## Paddock and invoice acceptance fixes (REN-47–50)

Invoice workspace and detail queries mount only after Clerk and Convex agree on
an authenticated account/session. Switching accounts or sessions discards drafts
and ignores completions from the prior session. Backend participant checks remain
required. Paid invoice details show the historical amount paid and zero remaining
balance; the stored `amountDue` remains the expected original charge used by
payment reconciliation.

Paddock author links resolve an active driver's actual `driverProfiles` document
ID. Other members have a public `/profile/[externalId]` page using the same public
field allowlist for guests and signed-in callers; own `/profile` editing stays
protected. Missing or banned authors display without a profile link. People is
not added to primary navigation.

Paddock feed/discussion routes are public reads. Comment writes require a ready
signed-in session and backend authentication. Deleting one's comment is idempotent
and decrements the post count once. A deleted post's comments are unavailable;
new comments and replies to deleted or mismatched parents are rejected. Discussion
loading, unavailable and retry states retain a route back to the Paddock.

Deploy the additive backend before staging frontends. No schema or financial-data
migration is required. Verify guest reading, two-user commenting, follow/profile
navigation and post/comment counts, plus invoice sign-in and paid balance, on the
same staging revision. Production remains unchanged until a separate release.
