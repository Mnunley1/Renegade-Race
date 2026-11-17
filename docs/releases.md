# Releases

## Merge gate

Open a pull request against `main`. The active GitHub ruleset requires the branch
to be up to date and these GitHub Actions checks to succeed:

- `Lint & Type Check`
- `Backend Tests`
- `Web Tests`
- `Build` (both web and admin)

CI runs on pull requests and pushes to `main` and `dev`, using Node 22 and
pnpm 10.4.1 with frozen lockfile installs. Tests use their isolated test runtimes;
CI has no production deployment credentials. Compilation uses placeholder service
configuration and is not an end-to-end staging test.

The ruleset requires a PR and resolution of review conversations, blocks force
pushes and deletion of `main`, and has no bypass actors. It does not require a
second GitHub account's approval: the repository owner can merge their own PR
after the checks pass. Record independent review evidence on significant changes.
Keep the required check names synchronized with the workflow when changing them.

## Production promotion gate

For both Vercel projects (`nineonenine/renegade-web` and
`nineonenine/renegade-race-admin`), Production tracks `main`, but **Auto-assign
Custom Production Domains is disabled**. Merging can build a production-target
deployment; it does not move the live domains. Preview deployments remain enabled.
Keep this setting disabled. Do not use the Ignored Build Step as a routine release
gate, and do not add a production Convex deploy to either app's build command.

An authorized operator can still explicitly promote a deployment in Vercel. This
is a manual promotion boundary, not a second-person approval mechanism or a check
on every use of Vercel's API. GitHub CI does not automatically deploy Convex or
promote Vercel. Changes to a deployment's domain assignment require a release
decision, even when its build is green.

## Release procedure

1. Select a reviewed, passing commit and record the current live Convex revision
   and both Vercel deployment IDs before changing anything.
2. Validate matching frontend/backend revisions in an isolated nonproduction
   environment. Exercise sign-in, authorization, uploads and sandbox payments.
   For production-parity checks, set `NEXT_PUBLIC_SKIP_REQUIRED_PHOTOS=false`.
3. Review schema/API compatibility, migrations, and rollback. One release operator
   deploys backward-compatible Convex changes once for the shared backend. Existing
   frontends and open browser sessions must keep working throughout the rollout.
4. Verify the exact production-target Vercel builds, their source SHAs, environment
   and backend URL. Test those staged builds before moving domains. Promoting a
   Preview build can rebuild it with Production variables; it is not proof that
   the identical preview artifact was released.
5. After explicit release approval, use **Promote** on the intended staged
   production deployment in each project's Vercel dashboard. Confirm the public
   domain serves the intended deployment and run production-safe smoke checks.
6. Record Git SHAs, Convex revision, Vercel deployment IDs, validation and any
   migration/rollback constraints in the release's Linear issue. Frontend rollback
   does not revert backend code or data; retain backward compatibility or follow
   the reviewed backend recovery procedure.

## Current release divergence

At adoption of this gate, live web is `3c0d1bc`, admin is `ceadf7f`, and Convex is
`c8c1265`. These are historical baseline identifiers, not dynamically updated
release pointers. Production's backend contains endurance-seat work absent from
`main`; `main` contains invoice/ACH and Paddock work absent from that backend.
Passing CI alone does not authorize deploying `main` over that backend. Reconcile
the feature/schema differences and complete staging validation first. Web's
existing staging environment still tracks `dev`; migrating that environment is
separate from this release gate.

References: [Vercel staged production promotion](https://vercel.com/docs/deployments/promoting-a-deployment),
[Convex deployment environments](https://docs.convex.dev/production/multiple-deployments).
