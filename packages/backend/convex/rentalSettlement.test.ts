// @vitest-environment edge-runtime
import { convexTest } from "convex-test"
import { beforeEach, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const stripe = vi.hoisted(() => ({
  charges: { retrieve: vi.fn() },
  refunds: { list: vi.fn(), create: vi.fn() },
  transfers: { retrieve: vi.fn(), listReversals: vi.fn(), create: vi.fn() },
  applicationFees: { retrieve: vi.fn(), listRefunds: vi.fn() },
  balanceTransactions: { retrieve: vi.fn(), list: vi.fn() },
}))
vi.mock("stripe", () => ({
  default: class {
    charges = stripe.charges
    refunds = stripe.refunds
    transfers = stripe.transfers
    applicationFees = stripe.applicationFees
    balanceTransactions = stripe.balanceTransactions
  },
}))
vi.mock("./r2", () => ({ r2: {} }))
const modules = (
  import.meta as unknown as { glob: (p: string) => Record<string, () => Promise<unknown>> }
).glob("./**/*.ts")
beforeEach(() => {
  vi.resetAllMocks()
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture"
})

async function fixture() {
  const t = convexTest(schema, modules)
  const { paymentId, reservationId } = await t.run(async ({ db }) => {
    for (const subject of ["host", "renter"])
      await db.insert("users", { externalId: subject, name: subject })
    const trackId = await db.insert("tracks", { name: "Test", location: "Test", isActive: true })
    const vehicleId = await db.insert("vehicles", {
      trackId,
      ownerId: "host",
      make: "Test",
      model: "Car",
      year: 2026,
      dailyRate: 100,
      description: "Synthetic",
      amenities: [],
      addOns: [],
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    })
    const reservationId = await db.insert("reservations", {
      vehicleId,
      ownerId: "host",
      renterId: "renter",
      startDate: "2020-01-01",
      endDate: "2020-01-01",
      status: "completed",
      paymentStatus: "paid",
      totalDays: 1,
      dailyRate: 100,
      totalAmount: 100,
      createdAt: 1,
      updatedAt: 1,
    })
    const paymentId = await db.insert("payments", {
      reservationId,
      ownerId: "host",
      renterId: "renter",
      amount: 100,
      processingFee: 34,
      platformFee: 5,
      ownerAmount: 95,
      currency: "usd",
      status: "succeeded",
      stripePaymentIntentId: "pi",
      stripeChargeId: "ch",
      stripeTransferId: "tr",
      stripeAccountId: "acct_host",
      createdAt: 1,
      updatedAt: 1,
    })
    await db.patch(reservationId, { paymentId })
    return { paymentId, reservationId }
  })
  const refund = {
    id: "re",
    charge: "ch",
    payment_intent: "pi",
    status: "failed",
    amount: 50,
    currency: "usd",
    balance_transaction: "bt_refund",
    failure_balance_transaction: "bt_failure",
    failure_reason: "expired_or_canceled_card",
    transfer_reversal: "trr",
  }
  const graph = {
    charge: {
      id: "ch",
      paid: true,
      amount: 134,
      amount_captured: 134,
      currency: "usd",
      payment_intent: "pi",
      transfer: "tr",
      application_fee: "fee",
      balance_transaction: "bt_charge",
      transfer_data: { destination: "acct_host" },
      metadata: { reservationId, ownerId: "host", renterId: "renter" },
    },
    transfer: {
      id: "tr",
      amount: 134,
      amount_reversed: 50,
      currency: "usd",
      source_transaction: "ch",
      destination: "acct_host",
      destination_payment: "py",
      balance_transaction: "bt_transfer",
    },
    fee: {
      id: "fee",
      amount: 39,
      amount_refunded: 15,
      currency: "usd",
      originating_transaction: "ch",
      charge: "py",
      account: "acct_host",
      balance_transaction: "bt_fee",
    },
    destination: {
      id: "py",
      amount: 134,
      amount_refunded: 50,
      currency: "usd",
      application_fee: "fee",
      balance_transaction: "bt_destination",
    },
    reversal: {
      id: "trr",
      amount: 50,
      currency: "usd",
      transfer: "tr",
      source_refund: "re",
      destination_payment_refund: "pyr",
      balance_transaction: "bt_reversal",
    },
    feeRefund: {
      id: "fr",
      amount: 15,
      currency: "usd",
      fee: "fee",
      balance_transaction: "bt_fee_refund",
    },
    compensation: {
      id: "tr_comp",
      amount: 35,
      amount_reversed: 0,
      currency: "usd",
      destination: "acct_host",
      destination_payment: "py_comp",
      balance_transaction: "bt_comp",
      metadata: {
        rentalSettlementPaymentId: paymentId,
        rentalSettlementRefundId: "re",
        rentalSettlementOwnerId: "host",
      },
    },
    compensationDestination: {
      id: "py_comp",
      amount: 35,
      amount_refunded: 0,
      currency: "usd",
      application_fee: null,
      balance_transaction: "bt_comp_destination",
    },
  }
  function bt(
    id: string,
    amount: number,
    source: string,
    { fee = 0, type = "adjustment" }: { fee?: number; type?: string } = {}
  ) {
    return {
      id,
      amount,
      net: amount - fee,
      fee,
      source,
      currency: "usd",
      type,
      status: "pending",
      available_on: 999,
    }
  }
  const balances = {
    bt_charge: bt("bt_charge", 134, "ch", { fee: 34, type: "charge" }),
    bt_refund: bt("bt_refund", -50, "re", { fee: 0, type: "refund" }),
    bt_failure: bt("bt_failure", 50, "re", { fee: 0, type: "refund_failure" }),
    bt_transfer: bt("bt_transfer", -134, "tr", { fee: 0, type: "transfer" }),
    bt_fee: bt("bt_fee", 39, "fee", { fee: 0, type: "application_fee" }),
    bt_destination: bt("bt_destination", 134, "py", { fee: 39, type: "payment" }),
    bt_reversal: bt("bt_reversal", 50, "tr", { fee: 0, type: "transfer_refund" }),
    bt_fee_refund: bt("bt_fee_refund", -15, "fee", { fee: 0, type: "application_fee_refund" }),
    bt_destination_refund: bt("bt_destination_refund", -50, "pyr", {
      fee: 0,
      type: "payment_refund",
    }),
    bt_destination_credit: bt("bt_destination_credit", 15, "py"),
    bt_comp: bt("bt_comp", -35, "tr_comp", { fee: 0, type: "transfer" }),
    bt_comp_destination: bt("bt_comp_destination", 35, "py_comp", { fee: 0, type: "payment" }),
  }
  let refunds = [refund]
  stripe.refunds.list.mockImplementation(() => structuredClone(refunds))
  stripe.charges.retrieve.mockImplementation((id) =>
    id === "ch"
      ? structuredClone(graph.charge)
      : id === "py"
        ? structuredClone(graph.destination)
        : structuredClone(graph.compensationDestination)
  )
  stripe.transfers.retrieve.mockImplementation((id) =>
    structuredClone(id === "tr" ? graph.transfer : graph.compensation)
  )
  stripe.transfers.listReversals.mockImplementation(() => [structuredClone(graph.reversal)])
  stripe.applicationFees.retrieve.mockImplementation(() => structuredClone(graph.fee))
  stripe.applicationFees.listRefunds.mockImplementation(() => [structuredClone(graph.feeRefund)])
  stripe.balanceTransactions.retrieve.mockImplementation((id) =>
    structuredClone(balances[id as keyof typeof balances])
  )
  stripe.balanceTransactions.list.mockImplementation((params) =>
    params.source === "py"
      ? [structuredClone(balances.bt_destination), structuredClone(balances.bt_destination_credit)]
      : params.source === "pyr"
        ? [structuredClone(balances.bt_destination_refund)]
        : []
  )
  const admin = t.withIdentity({ subject: "admin", publicMetadata: { role: "admin" } }),
    host = t.withIdentity({ subject: "host" }),
    renter = t.withIdentity({ subject: "renter" }),
    other = t.withIdentity({ subject: "other" })
  const refresh = () => admin.action(api.rentalSettlement.refresh, { paymentId })
  const read = async () => {
    const reviews = await admin.query(api.rentalSettlement.getByPayment, { paymentId })
    return reviews.reviews[0]
  }
  const sync = () =>
    t.action(internal.stripe.syncChargeRefunds, { stripePaymentIntentId: "pi", chargeId: "ch" })
  return {
    t,
    admin,
    host,
    renter,
    other,
    paymentId,
    reservationId,
    graph,
    balances,
    refund,
    refresh,
    read,
    sync,
    setRefunds: (value: typeof refunds) => {
      refunds = value
    },
    resolve: async (ids: string[] = []) => {
      const r = await read()
      if (!r?.latestEvidenceId) throw new Error("No evidence")
      return await admin.action(api.rentalSettlement.resolve, {
        reviewId: r._id,
        expectedEvidenceId: r.latestEvidenceId,
        reference: "operator-case-1",
        notes: "Reviewed retained provider ledger",
        compensatingTransferIds: ids,
      })
    },
  }
}

it("records the real succeeded-to-failed shape durably, keeping refund outcome separate from the 35-cent host shortfall", async () => {
  const f = await fixture()
  f.refund.status = "succeeded"
  Object.assign(f.refund, { failure_balance_transaction: undefined })
  await f.sync()
  expect(await f.read()).toBeUndefined()
  expect((await f.t.run(({ db }) => db.get(f.paymentId)))?.refundAmount).toBe(50)
  f.refund.status = "failed"
  f.refund.failure_balance_transaction = "bt_failure"
  await f.refresh()
  const review = await f.read()
  expect(review).toMatchObject({
    status: "held",
    customerRefundStatus: "failed",
    evidence: {
      bindingVerified: true,
      allocationVerifiable: true,
      expectedHostAllocation: 95,
      currentHostAllocation: 60,
      differenceCents: 35,
      failureBalanceTransactionId: "bt_failure",
      transferReversalIds: ["trr"],
      feeRefundIds: ["fr"],
    },
  })
  expect(await f.t.run(({ db }) => db.get(f.paymentId))).toMatchObject({
    status: "succeeded",
    refundAmount: 0,
    settlementReviewStatus: "held",
  })
  await expect(f.resolve()).rejects.toThrow("hold remains")
  expect(stripe.refunds.create).not.toHaveBeenCalled()
  expect(stripe.transfers.create).not.toHaveBeenCalled()
  const summary = await f.host.query(api.rentalSettlement.participantStatus, {
    reservationId: f.reservationId,
  })
  expect(summary).toMatchObject({ status: "held", customerRefundStatus: "failed" })
  expect(summary).not.toHaveProperty("evidence")
})
it("keeps pending-to-success customer reconciliation normal with no settlement-review hold", async () => {
  const f = await fixture()
  f.refund.status = "pending"
  await f.sync()
  expect((await f.t.run(({ db }) => db.get(f.paymentId)))?.refundAmount).toBe(0)
  f.refund.status = "succeeded"
  await f.sync()
  expect((await f.t.run(({ db }) => db.get(f.paymentId)))?.refundAmount).toBe(50)
  expect(await f.read()).toBeUndefined()
})
it("duplicates reuse one review/evidence while preserving changing observation history", async () => {
  const f = await fixture()
  await f.refresh()
  await f.refresh()
  let rows = await f.t.run(async ({ db }) => ({
    reviews: await db.query("rentalSettlementReviews").collect(),
    evidence: await db.query("rentalSettlementEvidence").collect(),
    observations: await db.query("rentalSettlementObservations").collect(),
  }))
  expect(rows.reviews).toHaveLength(1)
  expect(rows.evidence).toHaveLength(1)
  expect(rows.observations).toHaveLength(1)
  f.refund.status = "succeeded"
  await f.sync()
  f.refund.status = "failed"
  await f.refresh()
  rows = await f.t.run(async ({ db }) => ({
    reviews: await db.query("rentalSettlementReviews").collect(),
    evidence: await db.query("rentalSettlementEvidence").collect(),
    observations: await db.query("rentalSettlementObservations").collect(),
  }))
  expect(rows.observations).toHaveLength(3)
  expect(rows.evidence).toHaveLength(1)
})
it("requires admin authorization and scopes participants without financial evidence leakage", async () => {
  const f = await fixture()
  await f.refresh()
  for (const caller of [f.t, f.host, f.renter, f.other]) {
    await expect(caller.query(api.rentalSettlement.listHeld, {})).rejects.toThrow()
    await expect(
      caller.query(api.rentalSettlement.getByPayment, { paymentId: f.paymentId })
    ).rejects.toThrow()
    await expect(
      caller.action(api.rentalSettlement.refresh, { paymentId: f.paymentId })
    ).rejects.toThrow()
  }
  for (const caller of [f.t, f.other])
    await expect(
      caller.query(api.rentalSettlement.participantStatus, { reservationId: f.reservationId })
    ).rejects.toThrow()
  for (const caller of [f.host, f.renter])
    expect(
      await caller.query(api.rentalSettlement.participantStatus, { reservationId: f.reservationId })
    ).toMatchObject({ status: "held" })
  await expect(f.admin.query(api.rentalSettlement.listHeld, { viewerId: "other" })).rejects.toThrow(
    "Account changed"
  )
})
it("blocks both participants' deletion and additional refund requests while held", async () => {
  const f = await fixture()
  await f.refresh()
  for (const clerkUserId of ["host", "renter"])
    expect(await f.t.query(internal.users.getRentalDeletionBlockers, { clerkUserId })).toContain(
      "Rental refund settlement requires operator review before deleting your account."
    )
  await expect(
    f.host.action(api.stripe.processRefund, {
      paymentId: f.paymentId,
      amount: 20,
      reason: "requested_by_customer",
      requestId: "new",
    })
  ).rejects.toThrow("settlement review")
  expect(stripe.refunds.create).not.toHaveBeenCalled()
})
it("requires exact verified compensation, preserves resolution audit, and permits a new refund request after resolution", async () => {
  const f = await fixture()
  await f.refresh()
  await f.resolve(["tr_comp"])
  const review = await f.read()
  expect(review).toMatchObject({
    status: "resolved",
    resolution: {
      operatorId: "admin",
      reference: "operator-case-1",
      notes: "Reviewed retained provider ledger",
      compensatingTransferIds: ["tr_comp"],
    },
    evidence: { currentHostAllocation: 95, differenceCents: 0 },
  })
  const audits = await f.t.run(({ db }) => db.query("auditLogs").collect())
  expect(audits.find((a) => a.action === "settlement_review_resolved")?.metadata).toMatchObject({
    notes: "Reviewed retained provider ledger",
    compensatingTransferIds: ["tr_comp"],
  })
  for (const clerkUserId of ["host", "renter"])
    expect(await f.t.query(internal.users.getRentalDeletionBlockers, { clerkUserId })).toEqual([])
  stripe.refunds.create.mockImplementation((args) => {
    const refund = {
      ...f.refund,
      id: "re_second",
      amount: args.amount,
      status: "pending",
      balance_transaction: null,
      transfer_reversal: null,
      failure_balance_transaction: null,
      metadata: args.metadata,
    }
    return refund
  })
  await f.host.action(api.stripe.processRefund, {
    paymentId: f.paymentId,
    amount: 20,
    reason: "requested_by_customer",
    requestId: "new",
  })
  expect(stripe.refunds.create).toHaveBeenCalledOnce()
  expect(stripe.transfers.create).not.toHaveBeenCalled()
})
it.each([
  "wrong-destination",
  "wrong-currency",
  "wrong-payment",
  "wrong-owner",
  "duplicate",
  "overcompensation",
  "destination-fee",
])("refuses %s compensation evidence", async (kind) => {
  const f = await fixture()
  await f.refresh()
  if (kind === "wrong-destination") f.graph.compensation.destination = "acct_other"
  if (kind === "wrong-currency") f.graph.compensation.currency = "eur"
  if (kind === "wrong-payment")
    f.graph.compensation.metadata.rentalSettlementPaymentId = "other" as typeof f.paymentId
  if (kind === "wrong-owner") f.graph.compensation.metadata.rentalSettlementOwnerId = "other"
  if (kind === "overcompensation") {
    f.graph.compensation.amount = 50
    f.graph.compensationDestination.amount = 50
    f.balances.bt_comp.amount = -50
    f.balances.bt_comp.net = -50
    f.balances.bt_comp_destination.amount = 50
    f.balances.bt_comp_destination.net = 50
  }
  if (kind === "destination-fee") {
    f.balances.bt_comp_destination.fee = 1
    f.balances.bt_comp_destination.net = 34
  }
  await expect(
    f.resolve(kind === "duplicate" ? ["tr_comp", "tr_comp"] : ["tr_comp"])
  ).rejects.toThrow("hold remains")
  expect((await f.read())?.status).toBe("held")
})
it.each([
  "initial-net",
  "failure-credit",
  "destination-reversal",
  "destination-fee-return",
  "fee-binding",
])("keeps unverifiable %s provider evidence held", async (kind) => {
  const f = await fixture()
  if (kind === "initial-net") f.balances.bt_destination.net = 94
  if (kind === "failure-credit") f.balances.bt_failure.source = "other"
  if (kind === "destination-reversal") f.balances.bt_destination_refund.net = -49
  if (kind === "destination-fee-return") f.balances.bt_destination_credit.amount = 14
  if (kind === "fee-binding") f.graph.fee.account = "acct_other"
  await f.refresh()
  expect((await f.read())?.evidence).toMatchObject({
    allocationVerifiable: false,
    expectedHostAllocation: null,
    differenceCents: null,
  })
  await expect(f.resolve()).rejects.toThrow("hold remains")
})
it("does not infer fee allocation for mixed successful/failed or pending refunds", async () => {
  const f = await fixture()
  const other = {
    ...f.refund,
    id: "re_success",
    amount: 10,
    status: "succeeded",
    transfer_reversal: undefined,
    balance_transaction: undefined,
    failure_balance_transaction: undefined,
  }
  f.setRefunds([f.refund, other] as (typeof f.refund)[])
  await f.refresh()
  expect((await f.read())?.evidence).toMatchObject({
    bindingVerified: true,
    allocationVerifiable: false,
    expectedHostAllocation: null,
  })
  await expect(f.resolve()).rejects.toThrow("hold remains")
})
it("rejects stale evidence and changing provider state before resolution", async () => {
  const f = await fixture()
  await f.refresh()
  const original = await f.read()
  if (!original?.latestEvidenceId) throw new Error("Missing snapshot")
  f.refund.status = "succeeded"
  await expect(
    f.admin.action(api.rentalSettlement.resolve, {
      reviewId: original._id,
      expectedEvidenceId: original.latestEvidenceId,
      reference: "case",
      notes: "reviewed",
      compensatingTransferIds: ["tr_comp"],
    })
  ).rejects.toThrow("changed")
  expect((await f.read())?.status).toBe("held")
  expect((await f.t.run(({ db }) => db.get(f.paymentId)))?.refundAmount).toBe(50)
})
it("rejects provider changes after the resolution sync without overwriting the stored customer outcome", async () => {
  const f = await fixture()
  await f.refresh()
  stripe.refunds.list
    .mockImplementationOnce(() => [structuredClone(f.refund)])
    .mockImplementationOnce(() => [{ ...f.refund, status: "succeeded" }])
    .mockImplementationOnce(() => [{ ...f.refund, status: "succeeded" }])
  await expect(f.resolve()).rejects.toThrow()
  expect((await f.read())?.status).toBe("held")
  expect((await f.t.run(({ db }) => db.get(f.paymentId)))?.refundAmount).toBe(0)
})
it("refuses resolution if another reconciliation commits while provider evidence is read", async () => {
  const f = await fixture()
  await f.refresh()
  const original = stripe.balanceTransactions.retrieve.getMockImplementation()
  stripe.balanceTransactions.retrieve.mockImplementationOnce(async (id) => {
    await f.sync()
    return original?.(id)
  })
  await expect(f.resolve(["tr_comp"])).rejects.toThrow("state changed")
  expect((await f.read())?.status).toBe("held")
})
it("reopens a previously resolved review when its compensation is reversed and retains the prior operator audit", async () => {
  const f = await fixture()
  await f.refresh()
  await f.resolve(["tr_comp"])
  f.graph.compensation.amount_reversed = 1
  await f.refresh()
  expect((await f.read())?.status).toBe("held")
  const audits = await f.t.run(({ db }) => db.query("auditLogs").collect())
  expect(audits.find((a) => a.action === "settlement_review_resolved")?.metadata).toMatchObject({
    reference: "operator-case-1",
    notes: "Reviewed retained provider ledger",
    compensatingTransferIds: ["tr_comp"],
  })
  expect(stripe.transfers.create).not.toHaveBeenCalled()
})
it("preserves a resolved review when only balance availability changes, retaining the new full evidence snapshot", async () => {
  const f = await fixture()
  await f.refresh()
  await f.resolve(["tr_comp"])
  const before = await f.read()
  for (const transaction of Object.values(f.balances)) {
    transaction.status = "available"
    transaction.available_on = 1000
  }
  await f.refresh()
  const after = await f.read()
  expect(after?.status).toBe("resolved")
  expect(after?.latestEvidenceId).not.toBe(before?.latestEvidenceId)
  expect(after?.evidence?.references.some((r) => r.status === "available")).toBe(true)
})
it("opens a new durable hold for a later failed refund after an earlier review was resolved", async () => {
  const f = await fixture()
  await f.refresh()
  await f.resolve(["tr_comp"])
  f.setRefunds([f.refund, { ...f.refund, id: "re_later", amount: 20 }])
  await f.sync()
  const reviews = (
    await f.admin.query(api.rentalSettlement.getByPayment, { paymentId: f.paymentId })
  ).reviews
  expect(reviews).toHaveLength(2)
  expect(reviews.find((r) => r.refundId === "re_later")?.status).toBe("held")
  expect((await f.t.run(({ db }) => db.get(f.paymentId)))?.settlementReviewStatus).toBe("held")
})
