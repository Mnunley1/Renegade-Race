import { expect, test } from "vitest"

// Temporary REN-5 negative control. Remove after GitHub records the failed check.
test("CI rejects a failing backend assertion", () => {
  expect(1).toBe(2)
})
