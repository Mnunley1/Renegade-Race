// biome-ignore-all lint/style/noDoneCallback: Node supplies TestContext for cleanup, not a completion callback.
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const checkScript = fileURLToPath(new URL("./check-public-documents.mjs", import.meta.url))
const knownNames = [
  "MERGER-OVERVIEW.md",
  "VALUATION-COMPARISON.md",
  "deferred-cash-model.html",
  "gridseat_nda.md",
  "gridseat_renegade_nda (1) copy.md",
  "RENEGADE-BUYER-INVESTMENT-SUMMARY.md",
]
const syntheticContent = "Synthetic guard fixture; never copy commercial content into this test."

function temporaryDirectory(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "ren8-document-guard-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

function repository(t) {
  const directory = temporaryDirectory(t)
  execFileSync("git", ["init", "--quiet"], { cwd: directory, stdio: "pipe" })
  return directory
}

function put(directory, name, { tracked = true, content = syntheticContent } = {}) {
  const target = path.join(directory, name)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content)
  if (tracked) execFileSync("git", ["add", "--force", "--", name], { cwd: directory })
}

function check(directory, env = process.env) {
  return spawnSync(process.execPath, [checkScript], { cwd: directory, env, encoding: "utf8" })
}

function rejectsKnownDocument(result, name) {
  return (
    result.status === 1 &&
    result.stderr.includes("Known private commercial documents are tracked") &&
    result.stderr.includes(JSON.stringify(name)) &&
    !result.stderr.includes(syntheticContent)
  )
}

test("permits an empty Git index", (t) => {
  assert.equal(check(repository(t)).status, 0)
})

for (const basename of knownNames) {
  test(`rejects the tracked known basename in a moved directory: ${basename}`, (t) => {
    const directory = repository(t)
    const name = `new-folder/nested copies/${basename}`
    put(directory, name)
    assert.ok(rejectsKnownDocument(check(directory), name))
  })
}

test("permits untracked local copies while checking tracked engineering documentation", (t) => {
  const directory = repository(t)
  put(directory, "README.md", { content: "Engineering setup and verification commands." })
  for (const basename of knownNames) put(directory, `local-private/${basename}`, { tracked: false })
  assert.equal(check(directory).status, 0)
})

test("permits names mentioned in text, near matches, and matching directory names", (t) => {
  const directory = repository(t)
  put(directory, "docs/private-documents.md", { content: knownNames.join("\n") })
  put(directory, "docs/merger-architecture.md")
  put(directory, "docs/VALUATION-COMPARISON.md.example")
  put(directory, "MERGER-OVERVIEW.md/engineering.md")
  assert.equal(check(directory).status, 0)
})

test("normalizes basename case, Unicode spaces and repeated filename whitespace", (t) => {
  const directory = repository(t)
  const name = "nested/ GRIDSEAT_RENEGADE_NDA\t (1)\n\u00a0 COPY.MD "
  put(directory, name)
  assert.ok(rejectsKnownDocument(check(directory), name))
  assert.equal(check(directory).stderr.split("\n").length, 4, "Quote filename newlines in logs")
})

test("normalizes Unicode compatibility characters in known basenames", (t) => {
  const directory = repository(t)
  const name = "nested/ＭＥＲＧＥＲ-ＯＶＥＲＶＩＥＷ.md"
  put(directory, name)
  assert.ok(rejectsKnownDocument(check(directory), name))
})

test("checks the entire index when invoked from a subdirectory", (t) => {
  const directory = repository(t)
  const name = "other-folder/merger-overview.MD"
  put(directory, name)
  const workingDirectory = path.join(directory, "unrelated/subdirectory")
  mkdirSync(workingDirectory, { recursive: true })
  assert.ok(rejectsKnownDocument(check(workingDirectory), name))
})

test("still rejects an indexed document removed only from the working directory", (t) => {
  const directory = repository(t)
  const name = "copies/VALUATION-COMPARISON.md"
  put(directory, name)
  unlinkSync(path.join(directory, name))
  assert.ok(rejectsKnownDocument(check(directory), name))
})

test("permits a local copy after its removal from the Git index is staged", (t) => {
  const directory = repository(t)
  const name = "copies/gridseat_nda.md"
  put(directory, name)
  execFileSync("git", ["rm", "--cached", "--force", "--", name], { cwd: directory })
  assert.equal(check(directory).status, 0)
})

test("fails closed outside a Git repository", (t) => {
  const result = check(temporaryDirectory(t))
  assert.equal(result.status, 1)
  assert.ok(result.stderr.includes("Unable to inspect the Git index"))
})

test("fails closed when Git cannot be executed", (t) => {
  const result = check(repository(t), { ...process.env, PATH: "" })
  assert.equal(result.status, 1)
  assert.ok(result.stderr.includes("Unable to inspect the Git index"))
})
