import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

const formatterUrl = new URL("../lib/booking-date.ts", import.meta.url).href
const dates = [
  "2026-05-27",
  "2026-05-01",
  "2027-01-01",
  "2028-02-29",
  "2026-03-08",
  "2026-03-09",
  "2026-11-01",
  "2011-12-30",
]
const expected = [
  "May 27, 2026",
  "May 1, 2026",
  "Jan 1, 2027",
  "Feb 29, 2028",
  "Mar 8, 2026",
  "Mar 9, 2026",
  "Nov 1, 2026",
  "Dec 30, 2011",
]

for (const timezone of [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
  "Pacific/Apia",
]) {
  test(`keeps booking calendar days and display formats in ${timezone}`, () => {
    // Fresh processes exercise actual timezone rules instead of mutating a shared
    // test worker's timezone. Samoa also covers a historically skipped local day.
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        `import { formatBookingDate } from ${JSON.stringify(formatterUrl)};
        const dates = ${JSON.stringify(dates)};
        console.log(JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          dates: dates.map(value => formatBookingDate(value)),
          shortStart: formatBookingDate('2026-05-27', {month:'short',day:'numeric'}),
          pickup: formatBookingDate('2026-05-27', {weekday:'long',month:'long',day:'numeric',year:'numeric'}),
          invalid: ['2026-02-30','2026-13-01','not a date','2026-05-27T00:00:00Z',''].map(value => formatBookingDate(value)),
          previousParserDay: new Date('2026-05-27').getDate()
        }));`,
      ],
      { env: { ...process.env, TZ: timezone }, encoding: "utf8", timeout: 15_000 }
    )
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.timezone, timezone)
    assert.deepEqual(output.dates, expected)
    assert.equal(output.shortStart, "May 27")
    assert.equal(output.pickup, "Wednesday, May 27, 2026")
    assert.deepEqual(output.invalid, [
      "2026-02-30",
      "2026-13-01",
      "not a date",
      "2026-05-27T00:00:00Z",
      "",
    ])
    if (["America/New_York", "America/Los_Angeles", "Pacific/Honolulu"].includes(timezone)) {
      assert.equal(output.previousParserDay, 26, "The timezone must reproduce the former bug")
    }
  })
}
