import { expect, test } from "vitest"

// Temporary REN-5 negative control. Remove after GitHub records the failed check.
test("CI rejects a failing web assertion", () => {
  expect(1).toBe(2)
})
