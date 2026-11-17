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
