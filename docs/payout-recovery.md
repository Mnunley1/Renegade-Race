# Owner-return payment setup

Returning owners with an imported recovery case must finish payment setup before
accepting new destination payments. No outreach is sent. Trusted owners without a
recovery case retain the existing setup flow. Payout setup remains optional for
publishing listings and reading reservations/messages/history.

## Separate hold and provider health

`payoutRecoveryCases` retains the subject, case key, original account, current
binding, hold, revision and restricted evidence reference. `payoutRecoveryAttempts`
retains a server-created candidate, expected original binding, platform/mode and
provider creation idempotency key. These rows are independent of provider enabled
flags, owner tags and webhook receipt TTLs.

The owner-facing query `payoutRecovery.getMyStatus({})` exposes only a sanitized
state and available setup actions. It accepts no owner/account ID. A held,
otherwise healthy destination still fails both rental payment entrypoints with
`PAYOUT_VERIFICATION_REQUIRED`. Checks run before provider mutations, before
publishing a URL/client secret, and after operation completion. A provider object
created in flight stays recorded while payment access is withheld.

Legacy onboarding cannot replace an untagged destination even before case import.
Existing legacy denials remain effective until held rows are imported. After
import, changing an owner tag cannot clear a hold. Importing cases does not alter
any user account link or provider metadata.
Legacy onboarding/login-link APIs cannot bypass an imported hold. Existing Stripe
revocation, account deletion and settlement barriers remain separate blockers.

## Owner flow

1. The signed-in owner opens Finish payment setup and explicitly starts fresh
   Express onboarding. Page views and sign-in do not create provider accounts.
2. `startOnboarding({ reauthToken })` verifies a recent native Clerk session using
   the same bound instance/issuer/session checks as account deletion, without
   calling any deletion method. The frontend uses Clerk reverification and obtains
   a fresh native token for each retry. A Convex template token or operator
   impersonation is not recent claimant authentication.
3. The backend checks the Stripe key mode and actual platform account against
   `STRIPE_CONNECT_REVOCATION_BINDING.platformAccountId`; no new secret is needed.
   The verified provider key/platform creates the candidate. Both subject and
   recovery attempt tags are established server-side, never accepted from a client.
4. Attempt journalling precedes creation. Concurrent/retried starts reuse the
   account-creation idempotency key and candidate, with an independent durable
   operation lease per invocation. Unknown creation outcomes remain active until
   reconciled; a successful concurrent call never clears another call's lease.
5. Expired onboarding links use a new generation for the same candidate. URLs
   return only to the configured web origin and fixed payout route. URLs and
   credentials are never persisted as evidence. Return query flags convey no
   verification permission; authenticated refresh re-reads the exact candidate.
6. Provider readiness becomes Ready for review. The original binding and hold
   remain unchanged. No status refresh or ordinary account.updated webhook can
   promote the candidate or release the hold.

This first recovery flow deliberately offers fresh setup instead of pretending
that a platform-generated login link, matching email or metadata proves control
of a legacy account. Stripe performs candidate onboarding directly. Original
ownership/history gaps remain recorded; setup does not retroactively verify the
legacy binding. Standard destinations are not converted, closed or disconnected.

## Restricted import and operator disposition

All administrative recovery functions are **internal**, not callable through the
public API, regardless of a client's claimed admin role. Inputs and outputs below
remain in the restricted incident register, never source or Linear.

* `importCases({ dryRun, evidenceRef, cases })`: each mapping contains `caseKey`,
  actual `subject`, `expectedUserId`, and `expectedAccountId`. Run dry-run first,
  review exact expected mappings, then apply the same manifest under separate
  production approval. Validate all rows before writing; fail on drift, duplicate
  subjects/keys/legacy accounts or ambiguous user bindings. Retries preserve
  progressed and released cases without clearing their hold or resetting state.
* `getOperatorCase({ caseId })`: inspect retained case/attempt records. Refresh
  candidate provider facts with `reviewCandidate({ caseId })` before disposition.
* `promoteVerifiedCandidate`: requires exact case revision, current/candidate
  account IDs, operator ID, explicit promotion approval, independent verification
  evidence and obligations-review references. It retains the legacy ID and moves
  the current binding **under hold**, with immutable audit evidence. No past
  payment, refund, reservation or settlement record is rewritten.
* `releaseVerifiedHold`: a separate internal decision after promotion, requiring
  the updated expected revision/current account and a **different release approval
  reference**. The candidate observation must be fresh (five minutes); the exact
  promoted candidate can be re-observed without rewriting original binding facts.

Both transitions reject revocation of old/new accounts, deletion, unresolved
account operations, current-link/candidate drift, duplicate bindings, processing
or pending rental payments, held settlement reviews, open disputes and latest
nonterminal refund observations. Evidence references must include relevant
connected-account historical obligations; empty platform lists do not establish
that an old Standard destination has no direct-account activity. Ambiguous history
requires operator review rather than automatic disposition.

Internal approval references document an already authorized operator action;
they are not owner-supplied bearer tokens or an automatic approval mechanism.
If a mutation response is lost, inspect current state/audit before retrying. Do
not overwrite revisions, forge evidence, reset leases or bypass writer guards.

## Verification and release

Regression tests exercise dry-run/retry/drift imports, role privacy and recent
authentication, candidate provenance/mode, concurrent/unknown creation outcomes,
expired links, readiness without release, separate promotion/release and delayed
fresh observations, financial blockers and payment races before/after provider
creation and operation completion. Existing trusted onboarding and revocation
suites remain required.

Shared staging uses only synthetic profiles and sandbox accounts. Recheck the
exact provider/Clerk/backend bindings before any staging push. Deploying this code
or importing real production cases requires the separately approved rollout. Never
merge to main merely to test: main automatically deploys production frontends.
Use the shared backend/release procedures in [backend workflow](backend-workflow.md)
and [releases](releases.md). A frontend rollback must not clear durable holds,
case/attempt history, original destination references or uncertain provider facts.
