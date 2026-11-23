# Stripe webhook routing (REN-53)

Stripe destination scope and its signing secret are independent from the backend
API key. A valid signature alone does not prove an event belongs to that key's
account. The backend checks all three before application or component side effects.

## Routes and secret binding

Use Convex's **HTTP action host** (`https://<deployment>.convex.site`), not its
`convex.cloud` API host. These are v1 **Snapshot** destinations, not Thin events.

| Route | Stripe Events from | Deployment signing secret |
| --- | --- | --- |
| `/stripe/platform-webhook` | Your account | `STRIPE_PLATFORM_WEBHOOK_SECRET` |
| `/stripe/connect-webhook` | Connected accounts | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| `/stripe/webhook` | Connected accounts, retained legacy route | existing `STRIPE_WEBHOOK_SECRET` |

Each route verifies only its own secret. There is no fallback or multi-secret
verification. New routes fail closed if their configured secret duplicates another
route's; a missing or invalid optional new secret does not disable the unchanged
legacy Connect route. Never replace the legacy secret with a new endpoint's secret.
`STRIPE_SECRET_KEY` is still the deployment's provider API key; its `sk_test_` or
`sk_live_` mode must agree with the signed event's boolean `livemode`. Connect live
destinations can receive test events too; wrong-mode deliveries intentionally fail
closed. If a resource also has a `livemode` field it must match the envelope.

Ingress uses Stripe's signature verifier on the raw body, including its normal
signature-age check. It then checks event/schema/version and route scope. Platform
events have no connected-account identity. Connect events require an `acct_` account;
`account.updated` also requires the object's account ID to equal that envelope.

Before any supported handler, receipt or component cache write, the exact event ID
must be retrieved with the configured API key. Connect retrieval also sends the
already signed account as `Stripe-Account`. The retrieved ID, type, resource ID,
mode and account must match. The handler processes the **provider-confirmed** event,
not unchecked delivery fields. A missing event, wrong account key or transient read
failure cannot create a receipt or cache row. Unsupported but otherwise valid
legacy subscriptions are acknowledged without handlers, receipts or component writes.

Stripe retains Events for approximately 30 days. An older event that can no longer
be retrieved fails closed; manual historical reconciliation requires a separately
reviewed, evidence-backed procedure. Do not bypass event binding or signatures to
make an old resend pass. Dashboard-generated fake events that do not exist in the
provider event store are not valid end-to-end proof; use retained genuine events.

## Subscription matrix

Configure the new platform destination with these **15** supported types:

- `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `payment_intent.processing`, `payment_intent.canceled`
- `checkout.session.completed`, `checkout.session.expired`
- `charge.refunded`, `charge.dispute.created`
- `refund.created`, `refund.updated`, `refund.failed`
- `invoice.paid`, `invoice.payment_failed`, `invoice.voided`,
  `invoice.marked_uncollectible`

Configure the new Connect destination with **`account.updated` and `payout.failed`**.
The existing legacy Connect destination's subscriptions and signing secret remain
in place during transition. Its existing payment/charge/Checkout subscriptions are
safely ignored; those connected-account objects must never update platform payments,
invoices, refunds or the shared Stripe component. Other unsupported types are also
acknowledged without effects after signature/scope/mode/version checks.

`transfer.failed` is not a supported Stripe event. The old unselectable handler has
been removed. `transfer.reversed` is not equivalent to failure and is not guessed as
a replacement. Existing refund/settlement reconciliation continues verifying actual
charge, refund, transfer, fee and ledger records; no money movement is added here.

**Deauthorization is explicitly deferred.** Do not subscribe the new endpoint to
`account.application.deauthorized`. Valid legacy deliveries are acknowledged with
zero local effects. Revocation may remove API access, so a failed account/event GET
(e.g. 403) is not proof of a particular application's revocation. This preserves the
verified existing production subscription behavior but does **not** claim complete
Connect lifecycle coverage. Legacy Standard links also exist; the limitation is not
just an Express-account assumption. Disconnect status may remain stale locally until
a separately verified callback is implemented. Financial paths still perform fresh
provider ownership/readiness checks and fail closed; no deauthorization event can
resume a payout hold or restore settlement.

Account updates read the **current** linked provider account, check exact account
identity and owner metadata, and derive current readiness instead of trusting an
old enabled snapshot. Status synchronization remains limited to verified linked
Express accounts, as before; this does not migrate legacy Standard links. Unverified
legacy ownership cannot be re-enabled. Verified Express payout failures are recorded in a deduplicated audit entry against the envelope's
connected account, never the payout's bank/card `destination`. This does not mark a
payment refunded, change settlement outcomes, or move funds.

## Versions, component mirror and retries

New destinations are pinned to **2025-08-27.basil**. Reviewed input versions are
**2022-11-15**, **2024-10-28.acacia** (used by the invoice integration), and Basil.
Validate incoming and retrieved versions independently: Stripe retrieval preserves
the Event's original format, which can differ from destination rendering. The
backend compares immutable routing identifiers rather than raw JSON equality;
financial handlers retain their authoritative current-provider amount, currency,
destination, ownership and attempt checks. Unknown versions fail before effects.
Changing a request header does not convert an old Event into a new version.

The installed Stripe component's `registerRoutes` processes its shared database
before custom callbacks. It is therefore not used as ingress. The new router runs
all guards and authoritative application handlers first, then mirrors only the
reviewed platform payment/Checkout/invoice subset into that component. No Connect
event reaches the component. Customer/subscription event subscriptions are not part
of the current release matrix; the secondary cache is not a payment or access
control authority. Existing component cache rows are not purged or rewritten by a
migration in this change.

Application receipt/dedup logic stays in the existing handlers. A failed provider
read, authoritative handler or mirror returns 500 so delivery can retry. If the
application handler succeeded but the secondary mirror failed, replay retains its
application dedup and retries the mirror. Rental refund updated/failed signals
intentionally reread the current provider refund set, even on duplicates. Identical
reconciliation can increment sync versions/update timestamps while preserving totals,
observation/review revisions and held settlement evidence; it is not a no-op. Changed
provider facts can append observations or reopen a review. Never clear holds or
change provider financial objects merely to obtain successful replay evidence.

## Staging and release gates

The inspected staging test destination was a **Your account** destination at the old
`/stripe/webhook` path, not a Connect proof. Provision additive platform and Connect
destinations and their own secrets; do not relabel that old destination or repurpose
its secret. Deploy the reviewed code with the pinned Convex 1.50 workflow, then prove
genuine signed delivery, exact provider account/route binding, reviewed snapshot
formats, rejection cases, and duplicate/retry behavior. Retire/correct the old staging
platform destination only after the new path is verified and that provider change is
authorized. Record exact source/runtime fingerprints and endpoint IDs without secrets.

Production endpoint creation, key/secret provisioning, subscription changes, resends,
or retirement of the legacy live-account destination targeting development require
separate approval. That destination's label does not prove it is a sandbox. Preserve
current production builds/settings during staging work. Refresh the cumulative release
packet after source changes; prior CI on an older candidate does not close this gate.

Primary references: [Connect webhook scopes](https://docs.stripe.com/connect/webhooks?accounts-namespace=v1),
[endpoint signing secrets and API versioning](https://docs.stripe.com/webhooks),
[provider-supported v1 event types](https://docs.stripe.com/api/events/types), and
[retrieving an Event](https://docs.stripe.com/api/events/retrieve).
