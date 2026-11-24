import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { StatusBadge } from "../components/status-badge"

const unknownLabel = />Unknown<\/div>/
const neutralStyle = /bg-secondary/
const financialStyle = /bg-emerald|bg-yellow|bg-destructive/
const paidLabel = /bg-emerald-600[^>]*>paid<\/div>/
const pendingLabel = /border-yellow-500[^>]*>pending<\/div>/
const failedLabel = /bg-destructive[^>]*>failed<\/div>/
const partiallyRefundedLabel = />partially refunded<\/div>/
const unfamiliarLabel = /bg-secondary[^>]*>future state<\/div>/

function render(status?: string | null) {
  return renderToStaticMarkup(createElement(StatusBadge, { status }))
}

test("missing optional payment states render Unknown without asserting paid or unpaid", () => {
  for (const status of [undefined, null, ""]) {
    const html = render(status)
    assert.match(html, unknownLabel)
    assert.match(html, neutralStyle)
    assert.doesNotMatch(html, financialStyle)
  }
  assert.match(renderToStaticMarkup(createElement(StatusBadge)), unknownLabel)
})

test("known and unfamiliar provider states retain their labels and variants", () => {
  assert.match(render("paid"), paidLabel)
  assert.match(render("pending"), pendingLabel)
  assert.match(render("failed"), failedLabel)
  assert.match(render("partially_refunded"), partiallyRefundedLabel)
  assert.match(render("future_state"), unfamiliarLabel)
})
