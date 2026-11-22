# Shared Convex backend

`packages/backend` owns the Convex project for both web and admin. Its
`convex/` directory contains the functions, schema, component configuration and
checked-in generated API. Both frontends import that API through
`@renegade/backend`; their `NEXT_PUBLIC_CONVEX_URL` selects the running deployment.

Do not assume `convex codegen` is local or read-only. With components, it can
contact a selected deployment and upload component definitions while generating
bindings. Use an isolated development deployment or an explicitly reviewed target
and CLI version, inspect its output, and follow the same target checks used for
deployment. During REN-51, such a codegen run was audited: staging application
modules and runtime remained unchanged. This does not make future runs read-only.
The app directories are not separate Convex projects.

Run the commands below from the repository root; backend commands explicitly
enter `packages/backend` in a subshell. With no `convex.json` there,
Convex uses the default `convex/` functions directory. The removed web config
pointed at `apps/packages/backend/convex`, which did not exist. Removing it does
not redirect a CLI invocation from `apps/web` to the backend: always use the
workspace commands below.

## Frontend development

Install with `pnpm install --frozen-lockfile`. Set the web and admin environment
files from their examples, using the same verified nonproduction Convex URL and
matching Clerk/Stripe test configuration. Run these in separate terminals:

```sh
pnpm dev:web
pnpm dev:admin
```

These commands start Next.js only. They do not push backend functions. When the
existing shared backend already supports a frontend or documentation change,
there is no need to start a backend watcher or redeploy Convex.

## Personal backend development

Use a personal nonproduction deployment for backend experiments. Create a
separate selector file outside source control containing only:

```dotenv
CONVEX_DEPLOYMENT=dev:YOUR_PERSONAL_DEPLOYMENT
```

Authenticate with the Convex CLI using the approved account, then run:

```sh
(
  cd packages/backend
  node node_modules/convex/bin/main.js dev --env-file /absolute/path/personal-convex.env
)
```

`dev` watches and **pushes code**, and may regenerate the local API. The explicit
selector file overrides default dotenv files and ambient deployment selection;
keep deploy keys, self-hosted credentials and other target selectors out of it.
Review generated changes before committing.

This invokes the lockfile CLI directly with Node. Some standalone `pnpm`
executables consume `--env-file` before forwarding it to Convex; the explicit
Node invocation preserves the selector argument. pnpm remains the workspace
package manager.

The existing `pnpm dev:backend` shortcut uses the same backend workspace and
lockfile CLI, but reads its normal environment. Use it only after verifying that
`packages/backend/.env.local` and the shell select the intended personal dev
deployment and contain no deploy key. `pnpm dev` also starts this backend watcher.

## Shared staging backend

Shared staging is `earnest-panther-585`, used by both staging frontends. It uses
Clerk's `sure-rattler-22` test instance, Stripe test mode and the separate
`renegade-race-dev` bucket. Verify these bindings before a backend change; setting
the frontend URL alone does not configure backend secrets or webhooks.

The CLI version also selects the uploaded Convex runtime. On 2026-11-20 the
lockfile CLI was **1.34.1**, while the reviewed staging and production backends
ran **1.50.0**. Verify the current deployed runtime before a push. Use the reviewed,
matching CLI version for staging; do not use the personal-development shortcut
to replace the shared runtime. The version-specific `npm exec` command below
runs a temporary CLI without changing workspace dependencies or the pnpm lockfile.

First pass `pnpm typecheck`, `pnpm lint:check`,
`pnpm --filter @renegade/backend test`, and the required PR checks. Record the
reviewed commit and backend baseline. API/schema changes must include reviewed
generated API updates before staging; the promotion command disables codegen
so it does not introduce unreviewed generated changes.

Create a separate staging selector file outside source control containing only:

```dotenv
CONVEX_DEPLOYMENT=dev:earnest-panther-585
```

Check the target with this read-only command:

```sh
(
  cd packages/backend
  npm exec --yes --package=convex@1.50.0 -- convex dashboard --no-open --deployment earnest-panther-585
)
```

After approval of the backend change and confirmation that the selector file has
only the staging entry above, deploy once for both apps:

```sh
(
  cd packages/backend
  npm exec --yes --package=convex@1.50.0 -- convex dev --once --env-file /absolute/path/staging-convex.env --codegen disable --typecheck disable --tail-logs disable
)
```

`--once` stops after the first push; it is not a dry run. Typechecking is performed
by the explicit preflight and CI above. Record the deployed runtime/revision,
then verify both staging apps and the affected flows. For payment changes, use
the [staging smoke-test procedure](../scripts/ren6-staging-smoke.md).

## Production and frontend releases

`convex deploy` (including the backend `convex:deploy` script) targets production
by default. Deployment keys can override a deployment selected through
`CONVEX_DEPLOYMENT`; an explicit selector file must contain no deploy key.
Production backend changes require a separately approved, compatible release
from the verified production baseline. The staging command above is not a
production release command.

Vercel Git builds and GitHub CI do not deploy Convex. Feature PRs merge into `dev`
for staging; accepted `dev` → `main` release PRs automatically deploy the frontend
production builds. A frontend rollback does not roll back backend code or data.
Keep the existing required checks and deployment separation described in
[Releases](releases.md).

## Clerk account deletion configuration

REN-52 requires deployment-owned `CLERK_SECRET_KEY` and `CLERK_INSTANCE_ID` matching
the configured Clerk issuer and provider account. Direct frontend self-deletion
must be disabled in the default and existing-user policies. The backend checks
the exact provider instance, domains and key mode before deletion. See
[account deletion](account-deletion.md) for the authenticated action, reverification,
transaction guards, retained financial actors and bounded recovery procedure.
Staging verification does not authorize changing the production instance.
