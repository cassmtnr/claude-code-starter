# Phase 11: Reliability Fixes

> Overhaul phase. Closes the still-pending findings from `docs/AUDIT.md`. Most Critical/High items were already resolved organically by prior work (see audit re-validation below) — this phase covers what's actually left.

## Goal

Close the remaining genuine audit findings as one bundled change: add test coverage for the two largest untested code paths (`runClaudeAnalysis`, `main()`) plus a full-flow E2E test, fix the remaining Python formatter detection bugs, surface CLI version in error output, and harden three edge cases. Single PR, semantic-release ships as `feat:` (minor) since several user-visible behaviors change.

## Audit re-validation (pre-spec, re-verified 2026-05-25)

10 findings already resolved by prior work:

| ID | Original finding | Where it was fixed |
|---|---|---|
| C1 | `isMain` realpathSync crash | `src/cli.ts:1171` adds `process.argv[1] &&` guard + try/catch at line 1183 |
| C2 | Dual npm publishing race | `.github/workflows/publish.yml` deleted |
| C3 | Release loop from publish.yml | Same as C2 |
| H1 | CI cache key `**/bun.lockb` | All workflows use `**/bun.lock` |
| H2 | VERSION crash on missing package.json | `__VERSION__` define + try/catch fallback to `"unknown"` (cli.ts:60-72) |
| H4 | No signal handling for Ctrl+C | SIGINT/SIGTERM handlers + cleanup (cli.ts:712-717) |
| H6 | `writeSettings` overwrites user config | Merges existing keys + `force` flag (generator.ts:150-171) |
| L4 | tsup target stale | Resolved by Phase 10 |
| **M1** | `formatFramework` missing 10 display names | **Already fixed**: all 10 entries present at `cli.ts:614-624`; tests at `cli.test.ts:395-434` pass |
| **M3** | `detectTestingFramework` assumes RSpec for Ruby | **Already fixed**: `analyzer.ts:474-484` checks `.rspec` → `spec/` dir → Gemfile read for "rspec" → returns `null` for Minitest-only projects |

8 findings remain in scope for this phase. (L1, L2, L3, L5, L7 are dropped as cosmetic/obsolete; L6 is deferred with acknowledged debt — see Non-goals.)

## Scope

### Test coverage (3 items)

**H3 — Unit tests for `runClaudeAnalysis`.** Currently zero coverage. The function spawns the `claude` CLI subprocess, streams JSON, handles signals, parses tool events. Test strategy: **fake `claude` binary fixture** (see "Test strategy" below).

**H5 — Tests for `main()`.** 150-line orchestrator, currently zero coverage. Test strategy: subprocess invocation against the built `dist/cli.js` with the existing non-interactive flags (`-y`, `--profile=ci`), supplemented by direct unit tests for extractable sub-units where main() is too monolithic.

**M4 — Full-flow E2E test.** Existing E2E only covers `--version`/`--help`. Add an E2E that writes a fixture project, runs `node dist/cli.js -y` with `fake-claude-success.sh` on PATH, and asserts: (1) exit code 0, (2) `.claude/settings.json` exists (written by `writeSettings`, which runs before `runClaudeAnalysis` and is deterministic). It does NOT assert on `.claude/CLAUDE.md` or other Claude-generated files — those are written by the real claude CLI's tool calls, which the fake binary does not perform.

### Detection logic (2 items)

**M2 — Python formatter detection bugs.** Current code at `src/analyzer.ts:538-551` already reads `pyproject.toml`, but has two real false-positive bugs:
- `pyproject.includes("[tool.ruff]")` matches the **linter** config table — a project using ruff as a linter but black as formatter is misclassified as ruff.
- `pyproject.includes("black")` is an unconstrained substring match — fires on the word "black" appearing anywhere (comments, package names, dependency entries).

Fix: replace the substring matches with anchored regex on TOML section headers. Check ruff formatter first, then black, fall through to `null` (preserves existing fallback). No new TOML parser dependency — section headers anchor cleanly with `^\[...\]` multi-line regex.

**M8 — Claude CLI version surfacing.** Don't add a minimum-version check (we don't know which version added `--append-system-prompt` and other dependencies). Instead: capture the version string from `claude --version` in `checkClaudeCli()` and include it in the error output if `runClaudeAnalysis` fails (both `child.on("error")` ENOENT path AND `child.on("close")` non-zero exit path — both get the version surfaced for consistency). Actionable diagnostic without false compatibility claims.

### Edge cases (3 items)

**M5 — Symlinked project root.** One-line fix: `const projectDir = fs.realpathSync(process.cwd())` in `main()`. Resolves CWD-vs-readdir path mismatch.

**M6 — `countSourceFiles` depth limit.** Currently `if (depth > 5)` (6 levels traversed). Bump to `if (depth > 10)` (11 levels). Document in code why (monorepos like `packages/*/src/modules/auth/handlers/`). Skipping the gitignore-aware walker recommendation — that's a feature, not a reliability fix.

**M7 — `listRootFiles` only reads root.** Don't extend (would change behavior for many projects). Document the limitation in `.claude/CLAUDE.md` "Gotchas" section so future contributors understand the design.

## Test strategy: fake claude binary fixture

Create `src/__fixtures__/fake-claude.sh` — a POSIX shell script that mimics `claude -p --output-format=stream-json` by emitting canned JSON events to stdout, then exiting. Test setup prepends the fixture directory to `PATH`, so `spawn("claude", ...)` resolves to the fake.

**Why this design:**
- Exercises the real `spawn` pipeline (stdin/stdout buffering, signal handling, exit codes) instead of mocking it
- Deterministic — fixture output is hardcoded
- No claude CLI install needed in CI
- Each test can use a different fixture variant (success, error, slow, no-args) via different script files

**Fixture variants needed (each is a separate `.sh` file):**
- `fake-claude-success.sh` — emits stream-json tool events, exits 0
- `fake-claude-error.sh` — emits a `result` event with error message, exits 1
- `fake-claude-slow.sh` — sleeps long enough for SIGTERM test (kill child, verify cleanup)

**The ENOENT case is not a fixture file** — it's the absence of a binary. For that test, set `PATH` to a temp directory containing no `claude` binary; `spawn("claude", ...)` emits `error` with `ENOENT`.

**Test helper: `withFakeClaude(variantOrNone, fn)`** — must use `try/finally` so PATH restoration runs even if `fn` throws (test assertion failure). Without `try/finally`, a single test failure corrupts PATH for every subsequent test in the file:

```typescript
async function withFakeClaude(
  variant: "success" | "error" | "slow" | null,
  fn: () => Promise<void>
): Promise<void> {
  const originalPath = process.env.PATH;
  try {
    if (variant === null) {
      // ENOENT test: PATH to an empty temp dir, no claude binary
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-claude-"));
      process.env.PATH = emptyDir;
    } else {
      const fixtureDir = path.join(__dirname, "__fixtures__", variant);
      process.env.PATH = `${fixtureDir}:${originalPath}`;
    }
    resetCachedClaudeVersion(); // see M8 below
    await fn();
  } finally {
    process.env.PATH = originalPath;
    resetCachedClaudeVersion();
  }
}
```

**Note on `__dirname`:** Bun's ESM runtime defines `__dirname` globally even under `"module": "ESNext"`, matching CommonJS semantics. Standard Node ESM does NOT define `__dirname` — but this project runs tests exclusively under Bun (see `cli.test.ts:1298` which already uses this pattern). If tests are ever migrated to `node --test`, replace with `path.dirname(fileURLToPath(import.meta.url))`.

**CRITICAL: Shell script permissions.** `git config core.filemode` is `true` in this repo, so git tracks the executable bit. The fixture scripts will NOT be executable on CI checkout unless committed with mode `100755`. Implementation step must `chmod +x src/__fixtures__/fake-claude-*.sh` BEFORE `git add`. CI failure mode without this fix: `EACCES: permission denied` on `spawn` — confusing, doesn't reveal root cause.

**Test counts (concrete minimums, not "more than baseline"):**
- H3 (`runClaudeAnalysis`): **4 tests** — success exit, non-zero exit, ENOENT (no binary on PATH), SIGTERM cleanup. (A 5th test for stream-json parse-error tolerance was considered and **dropped**: the existing code at `cli.ts:751-753` has `try { JSON.parse } catch {}`, so a test sending malformed JSON would always pass — count padding, no observable behavior.)
- H5 (`main` via subprocess): **4 tests** — matching the 4 NEW rows in the H5 coverage matrix below: claude-not-found early exit, analysis-failure exit, non-interactive with existing CLAUDE.md, summary output captured from stdout.
- M2 (Python formatter): **3 tests** — ruff-as-linter false-positive case (returns black not ruff), bare-"black"-in-comment false-positive case, `[tool.black]` properly detected.
- Expected unit test minimum after Phase 11: **277** (269 baseline + 8 new in `cli.test.ts`: 4 H3 + 1 M8 + 3 M2)
- Expected E2E test minimum after Phase 11: **8** (3 baseline + 4 H5 + 1 full-flow M4)
- **Why H5 lives in E2E, not unit:** `main()` calls `process.exit(...)` to terminate. In-process bun:test would kill the test runner. Subprocess invocation against the built `dist/cli.js` is the only safe path; that pattern already exists in `cli.e2e.test.ts`.

**Discovery:** the test file lives at `src/cli.test.ts` (existing) — adds new `describe` blocks. Estimated ~200 lines of new test code + ~60 lines of fixture scripts.

## Detection strategy: regex TOML matching

For M2 Python formatter:

```typescript
function detectPythonFormatter(rootDir: string, files: string[]): "black" | "ruff" {
  if (!files.includes("pyproject.toml")) return "black"; // existing fallback
  try {
    const content = fs.readFileSync(path.join(rootDir, "pyproject.toml"), "utf-8");
    if (/^\[tool\.ruff\.format\]/m.test(content)) return "ruff";
    if (/^\[tool\.black\]/m.test(content)) return "black";
    return "black"; // present but neither configured — preserve existing default
  } catch {
    return "black"; // fail-safe on read error
  }
}
```

Multi-line regex (`m` flag) anchors `[tool.xxx]` to start-of-line. TOML section headers are always at line start, never indented. False positives would require a literal `[tool.ruff.format]` string in a comment or other context — vanishingly rare, and harmless if it happens (we'd just say ruff instead of black).

## Detection strategy: claude version surfacing

```typescript
let cachedClaudeVersion: string | null = null;

export function checkClaudeCli(): boolean {
  try {
    cachedClaudeVersion = execSync("claude --version", { encoding: "utf-8" }).trim();
    return true;
  } catch {
    cachedClaudeVersion = null;
    return false;
  }
}

export function getClaudeVersion(): string | null {
  return cachedClaudeVersion;
}

/** Test-only: reset cached version between tests. Not part of public API. */
export function resetCachedClaudeVersion(): void {
  cachedClaudeVersion = null;
}
```

In `runClaudeAnalysis`, surface version in BOTH failure paths (consistency — error and close are both failures):

```typescript
// child.on("error") path (ENOENT, spawn failure)
child.on("error", (err) => {
  spinner.fail(`Failed to launch Claude CLI: ${err.message}`);
  const version = getClaudeVersion();
  if (version) console.error(pc.gray(`(claude CLI: ${version})`));
  resolve(false);
});

// child.on("close") non-zero exit path
if (code !== 0) {
  spinner.fail(`Claude exited with code ${code}`);
  if (lastResultMessage) console.error(pc.yellow(lastResultMessage));
  const version = getClaudeVersion();
  if (version) console.error(pc.gray(`(claude CLI: ${version})`));
  // ... existing stderr handling ...
}
```

**Test isolation (structural, not discipline-based):** `cachedClaudeVersion` is module-level state. To prevent cross-test pollution, the implementation MUST add a top-level `beforeEach(resetCachedClaudeVersion)` inside the `describe` block wrapping all H3/H5/M8 tests. The `withFakeClaude` helper also resets on entry+exit as defense in depth. This way, a contributor adding a new test that exercises `checkClaudeCli` without the helper still gets clean state automatically — no discipline rule for future contributors to remember and break.

```typescript
describe("runClaudeAnalysis / checkClaudeCli / main", () => {
  beforeEach(() => {
    resetCachedClaudeVersion();
  });
  // ... tests
});
```

Single source of truth (the version cached at startup) — no extra subprocess invocation, no race condition between version check and analysis.

## Test plan

Run in order. Stop on first failure, fix, continue.

1. `bun install` — no-op (no new deps); confirms clean state
2. `bun run typecheck` — clean
3. `bun run check` — clean
4. `bun test src/cli.test.ts` — **expected: ≥277 pass** (269 baseline + 8 new: 4 H3 + 1 M8 + 3 M2; H5 lives in e2e — see test-counts note above)
5. `bun run build` — produces dist/cli.js
6. `bun run test:e2e` — **expected: ≥8 pass** (3 baseline + 4 H5 + 1 full-flow M4). The new full-flow E2E test exercises the same "built artifact starts and runs" property a manual smoke would — no separate smoke step needed.
7. Open PR develop → main, observe PR Check workflow green. **Note:** the PR Check workflow will run the new full-flow E2E test (M4) which depends on fixture script execute bits being correct. If E2E fails with `EACCES` in CI, root cause is missed `chmod +x` step.

## Strategy for in-flight breaks

**Test additions reveal real bugs in source:** Fix in place. This is the entire point of the test coverage push. Each bug fixed gets its own commit (or grouped logically) to keep history bisectable.

**Existing tests break from detection changes:** Update tests if the new detection is correct. Add a comment explaining the change. Do NOT skip or `.only` tests.

**Fake claude binary differs from real claude behavior:** If you discover the real CLI emits stream-json differently than the fixture, update the fixture to match real output (capture from `claude -p --output-format=stream-json "hello" 2>/dev/null > sample.jsonl`). Never simplify the fixture below what real output looks like.

**Audit scope creep:** If you discover another audit finding that's already wholly fixed during implementation, mark it resolved in `docs/AUDIT.md` with a one-liner pointing to phase-11, and drop it from this PR's scope (same treatment M1 and M3 got during re-validation). Don't add unrelated fixes.

## Rollback

Same model as Phase 10:
- **Pre-PR:** `git reset --hard origin/develop` wipes local progress.
- **Post-PR-merge, pre-publish:** revert PR, semantic-release ships the revert.
- **Post-publish:** `npm deprecate claude-code-starter@<version> "..."` + fix-forward patch.

Step 7 of test plan (PR Check green on develop→main) is the gate that should prevent post-publish recovery.

## Files touched

**Always changed:**
- `src/cli.ts` — add cached `claudeVersion` + `resetCachedClaudeVersion`, modify `checkClaudeCli`, export `getClaudeVersion`, surface version in BOTH `runClaudeAnalysis` failure paths (`child.on("error")` and `child.on("close")` non-zero); add `realpathSync(process.cwd())` in `main()` for M5
- `src/cli.test.ts` — new `describe` blocks for `runClaudeAnalysis` (≥5 tests), `main()` (≥4 tests), Python formatter regex (≥3 tests). New `withFakeClaude` helper with `try/finally`.
- `src/cli.e2e.test.ts` — new test exercising full flow with fake claude binary on PATH (M4). Verifies `.claude/settings.json` is written (by `writeSettings`, deterministic) and that `runClaudeAnalysis` returns truthy. Does NOT assert on `.claude/CLAUDE.md` or other Claude-generated artifacts since the fake binary's canned JSON only emits tool events, not actual file writes.
- `src/analyzer.ts` — replace M2 substring matches with anchored regex; bump `countFiles` depth from `> 5` to `> 10` (M6)
- `src/__fixtures__/fake-claude-success.sh` (new file, **mode 100755**) — emits canned stream-json events for happy path
- `src/__fixtures__/fake-claude-error.sh` (new file, **mode 100755**) — emits a `result` event with error message, exits 1
- `src/__fixtures__/fake-claude-slow.sh` (new file, **mode 100755**) — sleeps long enough for SIGTERM cleanup test
- `.claude/CLAUDE.md` — add Gotcha entry for M7 (`listRootFiles` only reads project root; monorepo subdirs not auto-discovered)
- `docs/AUDIT.md` — mark M1 and M3 as resolved with one-liners pointing to phase-11 re-validation

**Conditionally changed:**
- `tsconfig.json` — only if TS attempts to type-check `.sh` files (it shouldn't; `include: ["src/**/*"]` resolves to `.ts` only via TS's default extension filter, but verify with `bun run typecheck` after creating fixtures).
- `tsup.config.ts` — only if tsup bundles fixtures into `dist/` (unwanted). It shouldn't (entry is `src/cli.ts`), but verify `dist/` after build does not contain `__fixtures__/`.
- `.gitattributes` (new file) — only if cross-platform line-ending issues appear with `.sh` files. Not needed for the initial implementation.
- Other source files — only if H3/H5 tests uncover real bugs that need fixing.

**Verified at spec-time, no changes needed:**
- `biome.json` — `ignoreUnknown: true` is already set; `.sh` files are silently skipped (verified by reading `biome.json` files block).

**Explicit implementation step (do NOT skip):**

```bash
chmod +x src/__fixtures__/fake-claude-success.sh \
         src/__fixtures__/fake-claude-error.sh \
         src/__fixtures__/fake-claude-slow.sh
git add src/__fixtures__/*.sh
git status --short  # confirm files are listed as new
git ls-files --stage src/__fixtures__/*.sh  # MUST show 100755, not 100644
```

If `ls-files --stage` shows `100644`, the `chmod +x` was skipped or `core.filemode` is unexpectedly false — fix before committing or CI will fail with `EACCES`.

## H5 main() coverage matrix

The audit listed 7 untested `main()` behaviors. This phase covers them via subprocess invocation of `dist/cli.js`:

| Audit behavior | Covered by | Notes |
|---|---|---|
| `process.exit(0)` on `--help` | Existing e2e (--help test) | Already covered |
| `process.exit(0)` on `--version` | Existing e2e (--version test) | Already covered |
| `process.exit(1)` when Claude CLI not found | NEW H5 test: PATH set to empty dir, run `-y` | Covered |
| `process.exit(1)` when Claude analysis fails | NEW H5 test: PATH with `fake-claude-error.sh` | Covered |
| Interactive CLAUDE.md mode prompt (lines 469-487) | **Deferred** — requires interactive stdin, not testable via `-y` | Documented limitation |
| Non-interactive path with existing CLAUDE.md | NEW H5 test: pre-create `.claude/CLAUDE.md`, run `-y`, assert exit code 0 (no interactive prompt) | Covered — this verifies the non-interactive branch is taken; it does NOT verify what Claude writes (fake binary performs no file writes) |
| New-project preferences flow (lines 454-460) | **Deferred** — interactive prompts | Documented limitation |
| Summary output logic | NEW H5 test: subprocess `-y --profile=ci` with `fake-claude-success.sh`, capture stdout, assert summary section is printed | Covered |

2 of 8 behaviors require interactive stdin and are deferred (interactive CLAUDE.md prompt, new-project preferences flow). 2 are already covered by existing e2e tests (--help, --version). 4 are NEW H5 tests added by this phase. A future phase could refactor `main()` to extract the interactive paths into testable units; out of scope here.

## Constraints

- No new runtime dependencies. Use built-in `fs`, `path`, `child_process`, regex.
- Test fixtures live in `src/__fixtures__/` (matches existing test colocation convention).
- All git ops performed by the user (project convention).
- Bun-managed lockfile only.

## Non-goals

- **Replacing E2E spawn-based tests with proper CLI test framework** (e.g., `@oclif/test`). Out of scope; current bun:test + spawnSync is adequate.
- **Gitignore-aware directory walker** for M6. Would be a real feature; bumping the depth limit covers the audit's primary concern.
- **Extending `listRootFiles` to scan subdirectories** for M7. See design call above.
- **Adding a minimum claude CLI version check.** We lack the knowledge to set it correctly; M8 covers the realistic improvement (surfacing version).
- **Low-severity audit items** (L1, L2, L3, L5, L7). Re-validation shows most are either obsolete or cosmetic. Can be revisited later if any cause a real problem.
- **L6 console.log debt.** Deferred, not denied — the project does have `console.log` usage that mixes with the `pc` (picocolors) convention. `pr-check.yml`'s code-quality job flags this on every PR. A focused PR to replace these with the picocolors pattern is the right vehicle, not bundled into a reliability bump.
- **Refactoring `main()` into smaller units** to make it more testable. Tempting, but a separate "refactor" PR is the honest framing — Phase 11 is reliability, not restructuring.
- **Adding TOML parser dependency.** Regex is sufficient for the section-header detection M2 needs.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 8 in-scope audit fixes from the spec above as a single bundled PR: H3 + H5 + M4 (test coverage), M2 + M8 (detection logic), M5 + M6 + M7 (edge cases). Ships as `feat:` (minor release) since multiple user-visible behaviors change.

**Architecture:** Build the test infrastructure first (fake binary fixtures + `withFakeClaude` helper + `cachedClaudeVersion` reset), then layer new tests on top, then add the production-code changes guarded by those tests. Each task is commit-worthy but **the implementing agent does not commit** — the user commits the full bundle at the end per project convention.

**Tech Stack:** Bun (runtime + test runner), TypeScript 6, POSIX shell (for fixtures), node:child_process (spawn), node:fs (file ops).

**Execution invariants** (apply to every task):
- All `git` operations are performed by the **user**, never by the implementing agent. Tasks may stage with `git add` only if explicitly noted; they never commit, push, branch, or merge.
- No `npm install` / `yarn install` — Bun-managed lockfile only.
- If a fix would expand scope beyond what the spec defines (e.g., a Phase 11 task uncovers a Phase 12 issue), stop and surface — do not press on.
- On stop-and-surface: leave the working tree as-is. The user decides whether to roll back.
- Working directory: `develop` branch. No new branches.
- **Critical for fixture scripts:** every new `.sh` file MUST be `chmod +x` BEFORE staging. `git ls-files --stage` must show mode `100755`, not `100644`.

---

## Task 1: Pre-flight environment check

**Files:** None modified.

- [ ] **Step 1: Verify clean working tree**

Run: `git status --short`
Expected: empty, or only the spec file `docs/superpowers/plans/phase-11-reliability-fixes.md` if you haven't committed the v3 revision yet.

If other changes exist: stop and surface. Mixing Phase 11 with unrelated edits violates "single bundled PR."

- [ ] **Step 2: Verify v1.0.0 shipped + Node version**

Run: `npm view claude-code-starter version` — expected: `1.0.0` (Phase 10 shipped).
Run: `node --version` — expected: `v22.14.0` or higher.

- [ ] **Step 3: Capture baseline test state**

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `269 pass`, `0 fail`. Record this number — Phase 11 must reach **≥280**.

Run: `bun run test:e2e 2>&1 | tail -3`
Expected: `3 pass`, `0 fail`. Phase 11 must reach **≥4**.

Run: `bun run typecheck 2>&1`
Expected: clean (no output).

Run: `bun run check 2>&1 | tail -3`
Expected: `Checked 12 files`. No errors.

---

## Task 2: Create fake claude binary fixtures

**Files:**
- Create: `src/__fixtures__/fake-claude-success.sh` (mode 100755)
- Create: `src/__fixtures__/fake-claude-error.sh` (mode 100755)
- Create: `src/__fixtures__/fake-claude-slow.sh` (mode 100755)

These fixtures emit stream-json events that mimic real `claude -p --output-format=stream-json` output. The fake binary reads ALL its CLI args and stdin to drain them (preventing EPIPE on the parent's `child.stdin.write`), then emits canned events.

- [ ] **Step 1: Create `src/__fixtures__/fake-claude-success.sh`**

Note: read the script body verbatim, do not paraphrase.

```sh
#!/bin/sh
# Fake claude CLI — success variant. Emits a representative stream-json
# sequence then exits 0. Used by Phase 11 H3/H5/M4 tests.

# Drain stdin so the parent's child.stdin.write/end completes without EPIPE.
cat > /dev/null

# Match real `claude --version` short-circuit if someone calls us that way.
case "$1" in
  --version) echo "fake-claude 0.0.0-test"; exit 0 ;;
esac

# Emit canned stream-json. One JSON object per line per real CLI behavior.
printf '%s\n' '{"type":"system","subtype":"init"}'
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"package.json"}}]}}'
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","input":{"file_path":".claude/CLAUDE.md"}}]}}'
printf '%s\n' '{"type":"result","result":"Analysis complete (fake)."}'
exit 0
```

- [ ] **Step 2: Create `src/__fixtures__/fake-claude-error.sh`**

```sh
#!/bin/sh
# Fake claude CLI — error variant. Emits a result with an error message,
# then exits 1. Used to verify runClaudeAnalysis surfaces lastResultMessage.

cat > /dev/null
case "$1" in
  --version) echo "fake-claude 0.0.0-test"; exit 0 ;;
esac

printf '%s\n' '{"type":"system","subtype":"init"}'
printf '%s\n' '{"type":"result","result":"Simulated analysis failure for testing."}'
exit 1
```

- [ ] **Step 3: Create `src/__fixtures__/fake-claude-slow.sh`**

```sh
#!/bin/sh
# Fake claude CLI — slow variant. Sleeps so the SIGTERM cleanup test has
# time to send the signal and observe the process termination.

cat > /dev/null
case "$1" in
  --version) echo "fake-claude 0.0.0-test"; exit 0 ;;
esac

printf '%s\n' '{"type":"system","subtype":"init"}'
# Sleep 30s; tests should SIGTERM well before this completes.
sleep 30
echo '{"type":"result","result":"should never reach here"}'
exit 0
```

- [ ] **Step 4: Make all three executable**

Run: `chmod +x src/__fixtures__/fake-claude-success.sh src/__fixtures__/fake-claude-error.sh src/__fixtures__/fake-claude-slow.sh`

- [ ] **Step 5: Smoke-test the fixtures locally**

Run:
```
PATH="$(pwd)/src/__fixtures__:$PATH" claude --version
```
Expected: `fake-claude 0.0.0-test`. Confirms PATH-prepending resolves the fake binary.

Run:
```
echo "test prompt" | PATH="$(pwd)/src/__fixtures__:$PATH" sh -c 'src/__fixtures__/fake-claude-success.sh -p --verbose --output-format=stream-json' | head -2
```
Expected: 2 JSON lines. Confirms stdin draining + stream-json output works.

- [ ] **Step 6: Verify Biome and TS ignore fixtures**

Run: `bun run check 2>&1 | tail -3`
Expected: `Checked 12 files`. No new file count (Biome's `ignoreUnknown: true` skips `.sh`).

Run: `bun run typecheck 2>&1`
Expected: clean (no output). TS's default extension filter ignores `.sh`.

If either flags the fixtures: stop and surface. Spec assumed both would silently skip.

---

## Task 3: Refactor `checkClaudeCli` to cache version

**Files:**
- Modify: `src/cli.ts` (existing `checkClaudeCli` function, around line 1080)

Add two new exports — `getClaudeVersion()` and `resetCachedClaudeVersion()` — and modify the existing `checkClaudeCli()` to populate the cache.

- [ ] **Step 1: Read the current `checkClaudeCli` definition**

Locate the function in `src/cli.ts` (grep for `export function checkClaudeCli`).

- [ ] **Step 2: Replace it with the cached-version variant**

Pattern (preserve any surrounding JSDoc; only change the function body and add the two new exports above it):

```typescript
let cachedClaudeVersion: string | null = null;

/**
 * Verify claude CLI is installed and reachable. Caches the version string
 * for later surfacing in error output if runClaudeAnalysis fails.
 */
export function checkClaudeCli(): boolean {
  try {
    cachedClaudeVersion = execSync("claude --version", { encoding: "utf-8" }).trim();
    return true;
  } catch {
    cachedClaudeVersion = null;
    return false;
  }
}

/** Returns the cached claude CLI version string, or null if check failed / not run yet. */
export function getClaudeVersion(): string | null {
  return cachedClaudeVersion;
}

/** Test-only: reset cached version between tests. Not part of public API. */
export function resetCachedClaudeVersion(): void {
  cachedClaudeVersion = null;
}
```

- [ ] **Step 3: Verify typecheck still clean**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 4: Verify existing tests still pass**

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `269 pass` (no test changes yet; this verifies the refactor didn't break anything).

---

## Task 4: Add `withFakeClaude` helper + `beforeEach` reset pattern

**Files:**
- Modify: `src/cli.test.ts` (add helper at top of file, add `beforeEach` inside relevant `describe`)

Test infrastructure that subsequent tasks depend on.

- [ ] **Step 1: Add imports + helper at the top of `src/cli.test.ts`**

After the existing imports, add:

```typescript
import os from "node:os";
import { resetCachedClaudeVersion } from "./cli.js";

/**
 * Run `fn` with PATH set up to resolve `claude` to a fake binary fixture
 * (or to no binary at all, for ENOENT tests). Restores PATH and resets
 * cached version state on exit, even if `fn` throws.
 */
async function withFakeClaude(
  variant: "success" | "error" | "slow" | null,
  fn: () => Promise<void>
): Promise<void> {
  const originalPath = process.env.PATH;
  try {
    if (variant === null) {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-claude-"));
      process.env.PATH = emptyDir;
    } else {
      const fixtureDir = path.join(__dirname, "__fixtures__");
      // Symlink the requested variant to a `claude` name so spawn("claude") finds it.
      const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
      const target = path.join(fixtureDir, `fake-claude-${variant}.sh`);
      fs.symlinkSync(target, path.join(linkDir, "claude"));
      process.env.PATH = `${linkDir}:${originalPath}`;
    }
    resetCachedClaudeVersion();
    await fn();
  } finally {
    process.env.PATH = originalPath;
    resetCachedClaudeVersion();
  }
}
```

(Note: `os` may already be imported — check first. The helper uses a temp dir + symlink-to-claude pattern because real `spawn("claude", ...)` looks for a file literally named `claude` on PATH, not `fake-claude-*.sh`.)

- [ ] **Step 2: Add a `describe` block scaffold at the bottom of `cli.test.ts` for the new tests**

```typescript
// ============================================================================
// runClaudeAnalysis / checkClaudeCli / main (Phase 11 H3 + H5 + M8)
// ============================================================================

describe("runClaudeAnalysis (Phase 11 H3)", () => {
  beforeEach(() => {
    resetCachedClaudeVersion();
  });
  // Tests added in Task 5
});
```

(If `beforeEach` is not already imported from `bun:test`, add it to the existing import.)

- [ ] **Step 3: Verify scaffolding compiles + existing tests still pass**

Run: `bun run typecheck`
Expected: clean.

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `269 pass` (scaffolding adds no test cases yet, just structure).

---

## Task 5: H3 tests for `runClaudeAnalysis`

**Files:**
- Modify: `src/cli.test.ts` (add 4 tests inside the H3 describe block from Task 4)

4 tests covering: success exit, non-zero exit, ENOENT, SIGTERM cleanup. **No console-output assertions** — those belong to Task 6's M8 version-surfacing tests.

- [ ] **Step 1: Read `runClaudeAnalysis` current signature**

Find the function in `src/cli.ts` (around line 660). Note: it takes `(projectDir: string, prompt: string)` and returns `Promise<boolean>`. The function uses `pc` (picocolors) for output and `ora` for spinner.

- [ ] **Step 2: Add the 4 tests inside the H3 describe block**

```typescript
import { runClaudeAnalysis } from "./cli.js";

describe("runClaudeAnalysis (Phase 11 H3)", () => {
  beforeEach(() => {
    resetCachedClaudeVersion();
  });

  it("returns true on success exit (code 0)", async () => {
    await withFakeClaude("success", async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h3-success-"));
      const result = await runClaudeAnalysis(tmpProject, "test prompt");
      expect(result).toBe(true);
    });
  });

  it("returns false on non-zero exit code", async () => {
    await withFakeClaude("error", async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h3-error-"));
      const result = await runClaudeAnalysis(tmpProject, "test prompt");
      expect(result).toBe(false);
    });
  });

  it("returns false when claude binary is not on PATH (ENOENT)", async () => {
    await withFakeClaude(null, async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h3-enoent-"));
      const result = await runClaudeAnalysis(tmpProject, "test prompt");
      expect(result).toBe(false);
    });
  });

  it("returns false when SIGTERM is received during run (slow variant)", async () => {
    await withFakeClaude("slow", async () => {
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h3-slow-"));
      // Fire SIGTERM after a short delay so the spawn is alive when signaled.
      const sigTimer = setTimeout(() => {
        process.emit("SIGTERM" as NodeJS.Signals);
      }, 200);
      try {
        const result = await runClaudeAnalysis(tmpProject, "test prompt");
        // Either false (exit !== 0 from kill) is the expected non-success outcome.
        expect(result).toBe(false);
      } finally {
        clearTimeout(sigTimer);
      }
    });
  });
});
```

- [ ] **Step 3: Run the 4 new tests in isolation**

Run: `bun test src/cli.test.ts -t "runClaudeAnalysis" 2>&1 | tail -10`
Expected: 4 pass, 0 fail.

If the slow/SIGTERM test fails or hangs: the spec's signal-handling assertion in `cli.ts:712-716` may not actually clean up the child. Diagnose, do not skip — this is the point of the test. Surface if stuck.

- [ ] **Step 4: Run the full unit suite**

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `273 pass` (269 baseline + 4 H3).

---

## Task 6: M8 — surface claude version in `runClaudeAnalysis` failure paths

**Files:**
- Modify: `src/cli.ts` (`runClaudeAnalysis` function — both `child.on("error")` handler and the non-zero-exit branch of `child.on("close")`)
- Modify: `src/cli.test.ts` (add 1 test asserting the version surfaces)

- [ ] **Step 1: Read the current `child.on("error")` and `child.on("close")` blocks**

Find them in `src/cli.ts` (~line 770-790). Note the existing `pc.yellow(lastResultMessage)` and `pc.gray(stderrOutput.trim())` calls — your additions should be in the same style.

- [ ] **Step 2: Add `import { getClaudeVersion }` (or use existing local reference if already imported)**

Inside `cli.ts`, `getClaudeVersion` is now defined in the same file (from Task 3), so no import is needed — just call it directly.

- [ ] **Step 3: Modify the `child.on("error")` handler**

Find the existing block (search for `child.on("error"`). Replace with:

```typescript
child.on("error", (err) => {
  spinner.fail(`Failed to launch Claude CLI: ${err.message}`);
  const version = getClaudeVersion();
  if (version) {
    console.error(pc.gray(`(claude CLI: ${version})`));
  }
  resolve(false);
});
```

- [ ] **Step 4: Modify the non-zero `child.on("close")` branch**

Find the existing `else` branch (after `if (code === 0)`). Add version surfacing AFTER the existing `lastResultMessage` print, BEFORE the existing `stderrOutput` print:

```typescript
} else {
  spinner.fail(`Claude exited with code ${code}`);
  if (lastResultMessage) {
    console.error(pc.yellow(lastResultMessage));
  }
  const version = getClaudeVersion();
  if (version) {
    console.error(pc.gray(`(claude CLI: ${version})`));
  }
  if (stderrOutput.trim()) {
    console.error(pc.gray(stderrOutput.trim()));
  }
  resolve(false);
}
```

- [ ] **Step 5: Add a test asserting the version appears in error output**

Inside `cli.test.ts`, add inside the H3 describe block (after the 4 Task 5 tests):

```typescript
it("M8: surfaces cached claude version on non-zero exit", async () => {
  // Cache a version manually (simulating prior checkClaudeCli call)
  resetCachedClaudeVersion();
  // Spy on console.error
  const captured: string[] = [];
  const orig = console.error;
  console.error = (msg: string) => captured.push(msg);
  try {
    await withFakeClaude("error", async () => {
      // Call checkClaudeCli first so cachedClaudeVersion is populated by the fake's --version
      const { checkClaudeCli } = await import("./cli.js");
      checkClaudeCli();
      const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-m8-"));
      await runClaudeAnalysis(tmpProject, "test prompt");
    });
    const versionLine = captured.find((m) => m.includes("claude CLI: fake-claude 0.0.0-test"));
    expect(versionLine).toBeDefined();
  } finally {
    console.error = orig;
  }
});
```

- [ ] **Step 6: Run the new test + full suite**

Run: `bun test src/cli.test.ts -t "M8" 2>&1 | tail -10`
Expected: 1 pass.

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `274 pass` (269 baseline + 4 H3 + 1 M8).

---

## Task 7: H5 tests for `main()` via subprocess

**Files:**
- Modify: `src/cli.test.ts` (add 4 H5 tests, OR move them to e2e — see note below)

Note: `main()` exits via `process.exit(...)`. Testing via `bun:test` in-process would terminate the test process. The clean approach is subprocess invocation of the built `dist/cli.js`. Since this requires the build to be current, these tests belong in `cli.e2e.test.ts` (already has the build-first pattern) — NOT in `cli.test.ts`.

Adjusting Task 7 accordingly: add to `cli.e2e.test.ts`, not `cli.test.ts`.

**Revised files:**
- Modify: `src/cli.e2e.test.ts`

- [ ] **Step 1: Read current `cli.e2e.test.ts` structure**

The file (~41 lines) uses `execSync` against `dist/cli.js`. Match the existing patterns: `path.resolve("dist/cli.js")`, `os.tmpdir()` for fixtures, cleanup in `afterEach`.

- [ ] **Step 2: Add an H5 describe block with the 4 subprocess tests**

Append to `src/cli.e2e.test.ts`:

```typescript
import { spawnSync } from "node:child_process";

describe("main() orchestration (Phase 11 H5)", () => {
  const fixtureDir = path.resolve("src/__fixtures__");

  function pathWith(variant: "success" | "error" | "slow" | null): string {
    if (variant === null) {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-claude-"));
      return emptyDir;
    }
    const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
    fs.symlinkSync(path.join(fixtureDir, `fake-claude-${variant}.sh`), path.join(linkDir, "claude"));
    return `${linkDir}:${process.env.PATH}`;
  }

  it("exits 1 when claude CLI not found", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-noclaude-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    const result = spawnSync("node", [cliPath, "-y"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith(null) },
      encoding: "utf-8",
    });
    expect(result.status).toBe(1);
  });

  it("exits 1 when claude analysis fails", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-fail-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    const result = spawnSync("node", [cliPath, "-y"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith("error") },
      encoding: "utf-8",
    });
    expect(result.status).toBe(1);
  });

  it("exits 0 with -y when CLAUDE.md already exists (non-interactive branch)", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-existing-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    fs.mkdirSync(path.join(tmpProject, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(tmpProject, ".claude", "CLAUDE.md"), "# existing\n");
    const result = spawnSync("node", [cliPath, "-y"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith("success") },
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(0);
  });

  it("prints summary section to stdout on successful run", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-summary-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    const result = spawnSync("node", [cliPath, "-y", "--profile=ci"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith("success") },
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    // Summary output contains the tech stack section — flexible match since the exact text may evolve.
    expect(result.stdout).toMatch(/Tech Stack|Project|complete/i);
  });
});
```

(Note: if `os` is not already imported at the top of `cli.e2e.test.ts`, add `import os from "node:os";`.)

- [ ] **Step 3: Build dist/cli.js (E2E tests require it)**

Run: `bun run build`
Expected: `dist/cli.js` produced, no errors.

- [ ] **Step 4: Run the new H5 tests**

Run: `bun run test:e2e 2>&1 | tail -15`
Expected: 7 pass (3 baseline + 4 H5). If any of the 4 fails, diagnose. The summary regex match is intentionally flexible — if it fails because the summary doesn't contain "Tech Stack" or "Project" or "complete", inspect `result.stdout` and update the regex to match what main() actually outputs.

---

## Task 8: M5 + M6 — small edge case fixes

**Files:**
- Modify: `src/cli.ts` (`main()` function — add `realpathSync` for M5)
- Modify: `src/analyzer.ts` (`countFiles` function — depth limit for M6)

- [ ] **Step 1: M5 — find where `main()` sets the project directory**

Grep for `process.cwd()` inside `src/cli.ts`. The `main()` function uses it to set `projectDir`.

- [ ] **Step 2: Wrap `process.cwd()` with `realpathSync`**

Change:
```typescript
const projectDir = process.cwd();
```
to:
```typescript
// Resolve symlinks so analyzer's readdir results match the path we write to.
const projectDir = fs.realpathSync(process.cwd());
```

- [ ] **Step 3: M6 — find the `countFiles` depth check**

Grep for `if (depth > ` in `src/analyzer.ts`. Should be at ~line 771.

- [ ] **Step 4: Bump the depth limit**

Change:
```typescript
if (depth > 5) return;
```
to:
```typescript
// Bumped from 5 (6 levels) to 10 (11 levels) for deep monorepos like
// packages/*/src/modules/auth/handlers/.
if (depth > 10) return;
```

- [ ] **Step 5: Verify typecheck + tests still pass**

Run: `bun run typecheck`
Expected: clean.

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `274 pass` (unchanged from Task 6).

---

## Task 9: M2 — Python formatter regex fix + 3 tests

**Files:**
- Modify: `src/analyzer.ts` (`detectFormatter` function — Python branch at lines 538-551)
- Modify: `src/cli.test.ts` (add 3 M2 tests)

- [ ] **Step 1: Read the current Python formatter detection block**

Locate `src/analyzer.ts` lines 538-551. Confirm the substring-match bugs match the spec's description.

- [ ] **Step 2: Replace the substring checks with anchored regex**

Change the block:
```typescript
if (files.includes("pyproject.toml")) {
  try {
    const pyproject = fs.readFileSync(path.join(rootDir, "pyproject.toml"), "utf-8");
    if (pyproject.includes("[tool.ruff.format]") || pyproject.includes("[tool.ruff]")) {
      return "ruff";
    }
    if (pyproject.includes("[tool.black]") || pyproject.includes("black")) {
      return "black";
    }
  } catch {
    // Ignore read errors
  }
  return null;
}
```

to:
```typescript
if (files.includes("pyproject.toml")) {
  try {
    const pyproject = fs.readFileSync(path.join(rootDir, "pyproject.toml"), "utf-8");
    // Anchored to line start (multiline) so we match section headers,
    // not substrings in comments or unrelated tables.
    if (/^\[tool\.ruff\.format\]/m.test(pyproject)) return "ruff";
    if (/^\[tool\.black\]/m.test(pyproject)) return "black";
  } catch {
    // Ignore read errors
  }
  return null;
}
```

(Note: this drops the bare `[tool.ruff]` check. Rationale: that table is the ruff *linter* config, not the formatter. A project with `[tool.ruff]` alone uses ruff for linting; we should not infer ruff as the formatter unless `[tool.ruff.format]` is also present. Falling through to `[tool.black]` or `null` is correct.)

- [ ] **Step 3: Add the 3 M2 tests to `cli.test.ts`**

Find the existing `describe("detectFormatter"...)` block (if it exists) or create a new one. Add:

```typescript
describe("detectFormatter Python (Phase 11 M2)", () => {
  it("returns black (not ruff) when only [tool.ruff] linter config is present", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "p11-m2-rufflint-"));
    fs.writeFileSync(
      path.join(tmpDir, "pyproject.toml"),
      "[tool.ruff]\nline-length = 100\n\n[tool.black]\nline-length = 100\n"
    );
    const formatter = detectFormatter(null, ["pyproject.toml"], tmpDir);
    expect(formatter).toBe("black");
  });

  it("does not return black when 'black' appears only in a comment", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "p11-m2-comment-"));
    fs.writeFileSync(
      path.join(tmpDir, "pyproject.toml"),
      "# This project does not use black or ruff\n[tool.poetry]\nname = 'x'\n"
    );
    const formatter = detectFormatter(null, ["pyproject.toml"], tmpDir);
    expect(formatter).toBe(null);
  });

  it("returns ruff when [tool.ruff.format] is configured", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "p11-m2-ruff-"));
    fs.writeFileSync(
      path.join(tmpDir, "pyproject.toml"),
      "[tool.ruff]\nline-length = 100\n\n[tool.ruff.format]\nquote-style = 'double'\n"
    );
    const formatter = detectFormatter(null, ["pyproject.toml"], tmpDir);
    expect(formatter).toBe("ruff");
  });
});
```

(If `detectFormatter` is not already imported in cli.test.ts, add `import { detectFormatter } from "./analyzer.js";`.)

- [ ] **Step 4: Run the new M2 tests**

Run: `bun test src/cli.test.ts -t "M2" 2>&1 | tail -10`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Run full unit suite**

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `277 pass` (274 + 3 M2). Some existing detection tests may also have changed — if any fail, the new regex broke a pre-existing assertion. Diagnose, do not skip.

---

## Task 10: M4 — full-flow E2E test

**Files:**
- Modify: `src/cli.e2e.test.ts` (add 1 full-flow test in its own describe block)

This is similar in shape to the Task 7 H5 tests but exercises the full happy path with assertions on artifact creation.

- [ ] **Step 1: Add the M4 E2E test**

Append to `src/cli.e2e.test.ts` (after the H5 describe block from Task 7):

```typescript
describe("full-flow E2E (Phase 11 M4)", () => {
  it("writes .claude/settings.json on -y --profile=ci success", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-m4-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"e2e-fixture"}');
    fs.writeFileSync(path.join(tmpProject, "index.ts"), "export const x = 1;\n");

    const fixtureDir = path.resolve("src/__fixtures__");
    const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
    fs.symlinkSync(path.join(fixtureDir, "fake-claude-success.sh"), path.join(linkDir, "claude"));

    const result = spawnSync("node", [cliPath, "-y", "--profile=ci"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: `${linkDir}:${process.env.PATH}` },
      encoding: "utf-8",
      timeout: 15000,
    });

    expect(result.status).toBe(0);
    // settings.json is written by writeSettings (deterministic), BEFORE runClaudeAnalysis.
    expect(fs.existsSync(path.join(tmpProject, ".claude", "settings.json"))).toBe(true);
    // .claude/CLAUDE.md is NOT asserted — fake binary's canned JSON emits tool_use events
    // for Read/Write but doesn't actually perform the writes.
  });
});
```

- [ ] **Step 2: Rebuild and run E2E**

Run: `bun run test:e2e 2>&1 | tail -15`
Expected: 8 pass (3 baseline + 4 H5 + 1 M4).

---

## Task 11: M7 docs + AUDIT.md resolutions

**Files:**
- Modify: `.claude/CLAUDE.md` (add Gotcha entry for M7)
- Modify: `docs/AUDIT.md` (mark M1 + M3 as resolved with one-liners)

Documentation-only task. No code changes, no tests.

- [ ] **Step 1: Add the M7 Gotcha to `.claude/CLAUDE.md`**

Find the `## Gotchas & Important Notes` section (search for `## Gotchas`). Append a new bullet at the end of the list:

```markdown
- `listRootFiles` in `src/analyzer.ts` only reads the project root directory. Subdirectory config files (e.g., `app/build.gradle.kts`, `backend/requirements.txt`) are not auto-discovered — language and framework detection relies on root-level markers + a handful of explicit subdir checks in `detectFrameworks`. Extending this would change behavior for many projects and is out of scope for reliability work.
```

- [ ] **Step 2: Mark M1 as resolved in `docs/AUDIT.md`**

Find the `### M1.` heading (search for `### M1.`). Insert immediately after the heading line:

```markdown
> **Resolved.** All 10 missing display names are present in `formatFramework` (`src/cli.ts:614-624`), and tests for each exist and pass at `src/cli.test.ts:395-434`. Re-validated 2026-05-25 during Phase 11. See `docs/superpowers/plans/phase-11-reliability-fixes.md`.
```

- [ ] **Step 3: Mark M3 as resolved in `docs/AUDIT.md`**

Find the `### M3.` heading. Insert immediately after:

```markdown
> **Resolved.** `src/analyzer.ts:474-484` checks for `.rspec` file, then `spec/` directory, then reads `Gemfile` for "rspec" string. Returns `null` for Minitest-only projects (no specific Minitest detection added — but `null` is correct for "unknown framework"). Re-validated 2026-05-25 during Phase 11.
```

- [ ] **Step 4: Verify no tests broke (sanity)**

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: `277 pass` (unchanged).

---

## Task 12: Final integration verification

**Files:** None modified.

Re-runs every gate end-to-end against the fully-changed tree to catch any interaction effects.

- [ ] **Step 1: Clean install**

Run: `rm -rf node_modules && bun install`
Expected: full install succeeds with no errors.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Lint + format check**

Run: `bun run check`
Expected: `Checked 12 files`. No errors. (`.sh` fixtures should be silently skipped by `ignoreUnknown: true`.)

- [ ] **Step 4: Unit tests**

Run: `bun test src/cli.test.ts 2>&1 | tail -3`
Expected: **≥277 pass** (269 baseline + 8 new in unit: 4 H3 + 1 M8 + 3 M2). The 4 H5 tests live in e2e because `main()` calls `process.exit` — see Task 7.

- [ ] **Step 5: Build + E2E tests**

Run: `bun run test:e2e 2>&1 | tail -10`
Expected: **≥8 pass** (3 baseline + 4 H5 + 1 M4).

- [ ] **Step 6: Verify fixture permissions**

Run: `git ls-files --stage src/__fixtures__/`
Expected: every `.sh` line shows mode `100755`. If any shows `100644`, run `chmod +x` again and re-stage; CI will fail with EACCES otherwise.

- [ ] **Step 7: Smoke-check no unexpected files staged**

Run: `git status --short`
Expected: shows modifications to: `src/cli.ts`, `src/cli.test.ts`, `src/cli.e2e.test.ts`, `src/analyzer.ts`, `.claude/CLAUDE.md`, `docs/AUDIT.md`. New untracked files: `src/__fixtures__/fake-claude-success.sh`, `src/__fixtures__/fake-claude-error.sh`, `src/__fixtures__/fake-claude-slow.sh`. No other files.

If unexpected files appear: stop and surface (something in the implementation drifted).

---

## Task 13: Summarize diff for user

**Files:** None modified.

The implementing agent never commits. This task produces a summary the user can act on.

- [ ] **Step 1: Show the diff stat**

Run: `git status --short && echo "---" && git diff --stat`

- [ ] **Step 2: Capture key numbers**

Read and report:
- Unit test count (from final `bun test src/cli.test.ts`)
- E2E test count (from final `bun run test:e2e`)
- Files added (the 3 fixture scripts)
- Files modified (count + names)
- Per-file LOC delta

- [ ] **Step 3: Hand off to user with suggested commit**

Surface to the user:
- Diff summary (file list + line count + test pass counts vs baselines 269/3)
- Confirmation all gates passed (Task 12 results)
- Reminder: fixture scripts MUST be staged with execute bit (Task 12 step 6 verifies this)
- Suggested commit message body:

```
feat: phase 11 reliability fixes (audit closure)

Test coverage:
- H3: 4 tests for runClaudeAnalysis (success, non-zero exit, ENOENT,
  SIGTERM cleanup) using fake claude binary fixtures
- H5: 4 subprocess tests for main() (claude-not-found, analysis-fail,
  existing CLAUDE.md non-interactive branch, summary stdout)
- M4: 1 full-flow E2E asserting .claude/settings.json is written

Detection logic:
- M2: Python formatter regex now anchored to TOML section headers;
  drops the bare [tool.ruff] match (linter table, not formatter) and
  the bare "black" substring (false-positive on comments/deps)
- M8: claude --version is cached at checkClaudeCli and surfaced in
  both runClaudeAnalysis failure paths for actionable diagnostics

Edge cases:
- M5: main() now resolves cwd via realpathSync (symlinked roots)
- M6: countFiles depth limit bumped from 5 to 10 levels for monorepos
- M7: documented listRootFiles root-only limitation in CLAUDE.md

Audit re-validation:
- M1 (formatFramework display names) and M3 (Ruby testing framework
  detection) were already resolved by prior work; marked in AUDIT.md

Test counts: 269 → 277 unit, 3 → 8 e2e.

Spec/plan: docs/superpowers/plans/phase-11-reliability-fixes.md
```

Then stop. The user runs `git add` + `git commit` and opens the develop → main PR. Task 12 step 6 was the gate that should have caught fixture permissions; CI's PR Check is the final ship gate.
