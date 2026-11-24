import { execFileSync } from "node:child_process"
import path from "node:path"

// These owner-classified filenames must not return to the public tracked tree.
// This is a filename guard, not content classification or historical remediation.
const privateBasenames = new Set(
  [
    "MERGER-OVERVIEW.md",
    "VALUATION-COMPARISON.md",
    "deferred-cash-model.html",
    "gridseat_nda.md",
    "gridseat_renegade_nda (1) copy.md",
    "RENEGADE-BUYER-INVESTMENT-SUMMARY.md",
  ].map(normalizeBasename)
)

function normalizeBasename(filePath) {
  return path.posix.basename(filePath).normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase()
}

let trackedPaths
try {
  // NUL delimiters preserve spaces and line breaks. The root pathspec also
  // checks the whole repository when this command is run from a subdirectory.
  trackedPaths = execFileSync("git", ["ls-files", "--cached", "--full-name", "-z", "--", ":/"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\0")
    .filter(Boolean)
} catch {
  process.stderr.write("Unable to inspect the Git index; the public-document check cannot pass.\n")
  process.exit(1)
}

const matches = [...new Set(trackedPaths)].filter((filePath) =>
  privateBasenames.has(normalizeBasename(filePath))
)
if (matches.length > 0) {
  process.stderr.write(
    "Known private commercial documents are tracked in this public repository:\n"
  )
  for (const filePath of matches) {
    // Quote paths so untrusted filename newlines cannot create extra log lines.
    process.stderr.write(`  ${JSON.stringify(filePath)}\n`)
  }
  process.stderr.write(
    "Remove these tracked files and keep their contents in approved private storage.\n"
  )
  process.exit(1)
}

process.stdout.write("Known commercial-document filenames are absent from the Git index.\n")
