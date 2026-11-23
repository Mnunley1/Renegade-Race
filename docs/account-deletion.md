# Account deletion boundary (REN-52)

Account deletion is initiated only by `users.requestAccountDeletion({ reauthToken })`.
The authenticated Convex subject is the target; callers cannot supply another user
ID. The native Clerk session token is short-lived input, never persisted or logged.
The existing Clerk SDK verifies its signature and expiration against Clerk's fixed
Backend API. The server then binds its signed issuer/subject to the Convex caller,
checks the exact live Backend API session, and requires the strongest enrolled
factor to be less than ten minutes old, including elapsed time since token issue.
This preserves the project's existing Clerk deletion reverification window. A stale
factor returns Clerk's official reverification hint before any intent is written;
the web uses Clerk's verification UI and fetches a fresh native token on retry.
The old Convex token alone cannot satisfy this boundary.

The deployment must have `CLERK_SECRET_KEY`, `CLERK_INSTANCE_ID`, and its existing
`CLERK_JWT_ISSUER_DOMAIN` (or `CLERK_FRONTEND_API_URL`). Before a provider deletion,
Clerk's authenticated `/v1/domains` must include the exact configured issuer origin,
and `/v1/instance` must match the configured instance ID and the secret's test/live
mode. Backend requests use the fixed `https://api.clerk.com/v1` base. A caller cannot
supply a provider URL, instance, secret, or session ID. Missing/mismatched settings
fail closed. Keep all secret values outside the repository.

Disable Clerk Frontend API self-deletion in the instance's default user policy and
apply that policy to existing users. Never temporarily enable it for the custom
flow. The server uses the Backend API, which can delete under that policy. Provider
policy and application code are separate deployment gates: verify both against the
intended instance. Production requires its own explicit release/configuration approval.

## Transaction and provider sequence

A subject-keyed `accountDeletionIntents` row survives removal of sign-in access.
The first transaction checks local obligations and writes a durable `locked` intent.
Both parties' deletion intents are read in the same transactions that create or
approve rental, invoice, coaching, damage, seat, dispute, and return obligations.
Profile writes and late Clerk upserts cannot recreate a deleting identity. Existing
clients go through the same server guards.

Checkout, invoice creation/payment, Connect setup, and direct rental refunds reserve
`accountOperations` before provider I/O. Each invocation has its own reservation so
one successful concurrent retry cannot release another in-flight call. Paid
cancellations reserve scheduled refunds in the cancellation transaction. Coaching
and seat conflict callbacks record provider-originated refund holds even when a
subject is already tombstoned; real payment facts are never discarded by a deletion
guard. A cancelled-during-creation seat checkout throws rather than returning an
untracked payable URL. Invoice deposit refund reservations and latest pending rental
refund observations also block deletion.

After locking, the action rechecks local obligations and all returned Stripe balance
buckets. Any nonzero available, pending, reserved, or refund/dispute prefunding amount
(including negative liabilities) blocks deletion. Active/approved rentals, confirmed
rentals awaiting return even if their dates passed, payment attempts, settlement
review holds, issued unpaid invoices, held/pending deposits, active coaching/seats,
and unresolved damage/disputes/returns must resolve first. Settled financial history
alone remains eligible.

Clerk DELETE is followed by an exact-subject GET. Only an authoritative deletion
response plus absence, or later authoritative absence while recovering the durable
intent, permits the transition to `provider_deleted`. Unknown responses retain the
lock. Confirmed cleanup replaces the local profile with a minimal financial actor:
subject, neutral deleted-user name, and existing Stripe linkage. Other private profile
fields are removed; booking, payment, refund, and settlement history is retained.
The intent becomes `completed`. Financial IDs are never relinked by email.

A signed `user.deleted` event records the provider fact before cleanup. It is
acknowledged even if cleanup must be deferred, and duplicates may safely retry
cleanup. Late `user.created`/`user.updated` events cannot restore the profile.

## Recovery and limits

`deleted: true` means provider sign-in deletion is confirmed. `cleanupPending: true`
means local cleanup remains held; the UI signs out and says final cleanup is under
review. An uncertain provider outcome throws instead of reporting success.

The intent schedules GET-only internal reconciliation, bounded to an initial check
and two retries on errors. `users.reconcileAccountDeletion` can also reconcile an
existing intent without a still-valid user JWT. It never issues DELETE or creates
an intent for an arbitrary subject. An existing provider user stays locked for the
same user's explicit retry; an absent provider user may finish cleanup after all
obligations resolve. Repeated outages or unresolved obligations remain durable for
operator review. There is no timer-based unlock.

Read-only failures and definitive validation errors before any possible provider
mutation complete their temporary operation reservation. Unknown financial-operation
outcomes after a possible provider mutation remain support-held. A successful new retry
does not prove an earlier invocation stopped, so it cannot clear that hold. Existing
coaching/seat refund implementations do not establish final provider settlement;
their new refund operation holds deliberately remain until independently investigated.
This change does not add general payment/refund recovery or authorize operators to
blindly clear holds. Investigate exact provider references, pending work and ledger
outcomes before a separately reviewed correction; do not delete operation rows or
financial history to make deletion pass.

Clerk, Convex and Stripe do not share a transaction. Late signed settlement facts may
arrive after sign-in removal. The retained actor/tombstone and immutable financial
history preserve those facts and any new review hold; the system does not pretend
an external deletion can be rolled back. Cleanup cannot resume new obligations.

## First release activation gate

Before enabling the new deletion action in another deployment, reconcile or drain
financial actions and queued refunds that started under the older code. Those
executions cannot retroactively acquire the new operation reservations. Keep the
new provider secret/instance activation fail-closed until that check is complete,
then activate the server boundary and matching web flow together. This is a
release prerequisite, not an automatic global pause or production authorization.
