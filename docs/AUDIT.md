# Staff Engineer Reliability Audit: claude-code-starter

> Comprehensive reliability and quality audit identifying every scenario that could break in production, CI, or user environments.

**Auditor**: Staff Engineer (automated)
**Date**: 2026-02-16
**Scope**: All source files, tests, build output, CI/CD pipelines, npm package contents

---

## Critical Findings

### C1. `isMain` guard crashes on undefined `process.argv[1]`

- **Severity**: Critical
- **Category**: Distribution Bug / Runtime Failure
- **File**: `src/cli.ts:575`

**Description**: The entry-point guard uses `fs.realpathSync(process.argv[1])` without a try-catch. `realpathSync` throws `ENOENT` if the path doesn't exist, and throws `TypeError` if given `undefined`. This can happen when:
- The script is loaded via `node -e "await import('./dist/cli.js')"`
- A bundler or test runner imports the module with non-standard `process.argv`
- `process.argv[1]` points to a deleted temporary file

**Current code**:
```typescript
const isMain = fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
```

**Reproduction**:
```bash
node -e "import('./dist/cli.js')"
# TypeError: The "path" argument must be of type string. Received undefined
```

**Fix**: Wrap in try-catch, defaulting to `false` (don't run main):
```typescript
let isMain = false;
try {
  isMain = fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
} catch {
  // Not invoked directly (e.g., imported by test runner, dynamic import)
}
```

Add E2E test:
```typescript
it("does not crash when imported as a module", () => {
  const out = execSync(`node -e "import('./dist/cli.js')"`, { encoding: "utf-8" });
  // Should not throw
});
```

---

### C2. Dual npm publishing — semantic-release AND publish.yml race

- **Severity**: Critical
- **Category**: CI Gap
- **Files**: `.releaserc.json:98-101`, `.github/workflows/publish.yml`, `.github/workflows/release.yml`

**Description**: Two separate systems both publish to npm for every release:

1. `release.yml` runs `npx semantic-release`, which uses `@semantic-release/npm` with `npmPublish: true` — this publishes to npm.
2. `publish.yml` triggers on `release.created` events (which semantic-release creates) and ALSO runs `npm publish`.

This causes a race condition where both workflows attempt to publish the same version. If semantic-release publishes first, `publish.yml` fails with "403 - cannot publish over existing version". If timing is unlucky, both could partially succeed, causing corruption.

**Reproduction**: Push a `feat:` commit to main. Observe both workflows attempting to publish.

**Fix**: Choose ONE publishing path. Since semantic-release already handles the full lifecycle:
- Set `"npmPublish": false` in `.releaserc.json`, OR
- Remove the `publish` job from `publish.yml` and keep only the `commit-version` job, OR
- Remove `publish.yml` entirely and let `@semantic-release/git` handle version commits.

The cleanest approach: Remove `publish.yml` entirely. Semantic-release already handles npm publish AND version commit via `@semantic-release/git`.

---

### C3. Version commit-back can trigger infinite release loop

- **Severity**: Critical
- **Category**: CI Gap
- **File**: `.github/workflows/publish.yml:70-77`

**Description**: `publish.yml`'s `commit-version` job pushes a `chore: bump version...` commit to `main`. Since `release.yml` triggers on `push: branches: [main]`, this commit triggers another semantic-release run. While semantic-release likely won't find a new releasable commit (since `chore:` is hidden), it still wastes CI minutes and could interact badly with concurrent pushes.

Note: semantic-release's own `@semantic-release/git` commit uses `[skip ci]` in the message, but `publish.yml`'s commit does NOT include `[skip ci]`.

**Reproduction**: Create a release. Watch `commit-version` push to main, which triggers `release.yml` again.

**Fix**: If keeping `publish.yml`, add `[skip ci]` to the commit message:
```yaml
git commit -m "chore: bump version to ${{ needs.get-version.outputs.version }} [skip ci]"
```

Or better: remove `publish.yml` entirely (see C2).

---

## High Findings

### H1. CI cache key references `bun.lockb` but project uses `bun.lock`

- **Severity**: High
- **Category**: CI Gap
- **Files**: All `.github/workflows/*.yml`

**Description**: Every workflow caches Bun dependencies using:
```yaml
key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
```

But the project's lock file is `bun.lock` (text format), not `bun.lockb` (binary format). Bun switched to text-based lock files in Bun v1.2+. Since `bun.lockb` doesn't exist, `hashFiles()` returns an empty string, meaning:
- The cache key is always `Linux-bun-` (same regardless of dependencies)
- Cache is effectively shared across all dependency versions
- If a stale cache exists, it will be used even after dependency changes

**Reproduction**: Change a dependency in `package.json`, push. The CI will use the old cached `node_modules`.

**Fix**: Update all workflow files:
```yaml
key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
```

This appears in 8 places across `pr-check.yml` and `release.yml`.

---

### H2. VERSION constant reads `package.json` at import time — crashes if file missing

- **Severity**: High
- **Category**: Distribution Bug
- **File**: `src/cli.ts:41-44`

**Description**: The VERSION constant is computed at module evaluation time:
```typescript
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
).version;
```

In the built output (`dist/cli.js`), `__dirname` resolves to the `dist/` directory, so it reads `../package.json` (the project root). This works when installed via npm (package.json is included in the tarball), but:
- If someone copies just `dist/cli.js` to another location, it crashes immediately
- If `package.json` is malformed, the entire module fails to load
- Any test that imports from `cli.ts` triggers this read (tight coupling)

**Reproduction**:
```bash
cp dist/cli.js /tmp/ && node /tmp/cli.js --version
# ENOENT: no such file or directory, open '/package.json'
```

**Fix**: Wrap in try-catch with fallback:
```typescript
let VERSION = "unknown";
try {
  VERSION = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
  ).version;
} catch {
  // Fallback when package.json is not accessible
}
```

Or use tsup's `define` to inject the version at build time:
```typescript
// tsup.config.ts
import pkg from "./package.json";
export default defineConfig({
  define: { __VERSION__: JSON.stringify(pkg.version) },
});
```

---

### H3. `runClaudeAnalysis` has zero test coverage

- **Severity**: High
- **Category**: Test Gap
- **File**: `src/cli.ts:604-658`

**Description**: The `runClaudeAnalysis` function is the core feature of the CLI — it spawns the `claude` CLI to analyze the project. It has multiple code paths (success, spawn error, non-zero exit) and none are tested. The function is exported but never tested in `cli.test.ts`.

Untested paths:
- `child.on("error")` — what if the `claude` binary doesn't exist?
- `child.on("close", code)` where `code !== 0`
- The prompt construction via `getAnalysisPrompt`
- Signal forwarding (none exists — Ctrl+C during analysis orphans the child process)

**Fix**: Add unit tests with spawn mocking:
```typescript
describe("runClaudeAnalysis", () => {
  it("returns false when claude CLI is not found", async () => {
    // Mock spawn to emit 'error'
  });

  it("returns false on non-zero exit code", async () => {
    // Mock spawn to emit 'close' with code 1
  });

  it("returns true on successful analysis", async () => {
    // Mock spawn to emit 'close' with code 0
  });
});
```

---

### H4. No signal handling — Ctrl+C orphans Claude subprocess

- **Severity**: High
- **Category**: Runtime Failure
- **File**: `src/cli.ts:604-658`

**Description**: When the user presses Ctrl+C during `runClaudeAnalysis`, the parent process exits but the spawned `claude` subprocess continues running in the background. There is no `SIGINT`/`SIGTERM` handler to kill the child process.

**Reproduction**: Run the CLI, wait for Claude analysis to start, press Ctrl+C. Run `ps aux | grep claude` to see the orphaned process.

**Fix**: Add signal handling:
```typescript
const child = spawn("claude", [...], { ... });

const cleanup = () => {
  child.kill("SIGTERM");
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

child.on("close", () => {
  process.off("SIGINT", cleanup);
  process.off("SIGTERM", cleanup);
});
```

---

### H5. `main()` function is completely untested

- **Severity**: High
- **Category**: Test Gap
- **File**: `src/cli.ts:685+`

**Description**: The `main()` function (150 lines) orchestrates the entire CLI workflow. It is never called in any test. This is the exact same pattern as the symlink bug — testing exported functions in isolation but never testing the actual orchestration path.

Untested behaviors in `main()`:
- `process.exit(0)` on `--help` and `--version`
- `process.exit(1)` when Claude CLI is not found
- `process.exit(1)` when Claude analysis fails
- The interactive prompt for existing Claude config (`lines 469-487`)
- The non-interactive path for existing config (silently overwrites)
- The new project preferences flow updating `projectInfo.techStack` in-place (`lines 454-460`)
- The summary output logic

**Fix**: Add integration-style tests that exercise `main()` with mocked dependencies.

---

### H6. `writeSettings` silently overwrites user-customized settings.json

- **Severity**: High (reduced scope from previous audit)
- **Category**: Runtime Failure
- **File**: `src/generator.ts:148-155`

**Description**: `writeSettings()` overwrites `settings.json` without checking if the user has customized it. Content files (skills, agents, rules, commands) are now generated by Claude CLI and may also overwrite user customizations via the Write tool.

Note: The previous `writeArtifacts()` function has been removed. The scope of this issue is now limited to `settings.json` (written by `generator.ts`) and whatever Claude CLI writes during analysis. Claude's prompt instructs it to use the Write tool, which may overwrite existing customized files.

**Reproduction**:
```bash
npx claude-code-starter -y  # Initial setup
# Customize .claude/settings.json with additional permissions
npx claude-code-starter -y  # Overwrites settings.json
```

**Fix**: Check if `settings.json` exists and has been modified before overwriting. For Claude-generated content files, the prompt could instruct Claude to check for existing files and preserve user customizations.

---

## Medium Findings

### M1. `formatFramework` missing display names for 10 frameworks

> **Resolved.** All 10 missing display names are present in `formatFramework` (`src/cli.ts:614-624`), and tests for each exist and pass at `src/cli.test.ts:395-434`. Re-validated 2026-05-25 during Phase 11. See `docs/superpowers/plans/phase-11-reliability-fixes.md`.

- **Severity**: Medium
- **Category**: Runtime Failure (cosmetic)
- **File**: `src/cli.ts:307-352`

**Description**: The `formatFramework` lookup table is missing display names for: `swiftui`, `uikit`, `vapor`, `swiftdata`, `combine`, `jetpack-compose`, `android-views`, `room`, `hilt`, `ktor-android`. Tests at `cli.test.ts:341-356` confirm these return the raw internal identifiers instead of human-readable names.

**Fix**: Add the missing entries:
```typescript
swiftui: "SwiftUI",
uikit: "UIKit",
vapor: "Vapor",
swiftdata: "SwiftData",
combine: "Combine",
"jetpack-compose": "Jetpack Compose",
"android-views": "Android Views",
room: "Room",
hilt: "Hilt",
"ktor-android": "Ktor",
```

---

### M2. `detectFormatter` always returns `"black"` for any Python project

- **Severity**: Medium
- **Category**: Runtime Failure
- **File**: `src/analyzer.ts:527-532`

**Description**: The formatter detection for Python has a bug — if `pyproject.toml` exists, it always returns `"black"` regardless of whether Black is actually configured:
```typescript
if (files.includes("pyproject.toml")) {
  return "black"; // Could check for black/ruff in pyproject.toml
}
```

This can misidentify the formatter for any Python project with a `pyproject.toml` (which all modern Python projects have).

**Fix**: Actually parse `pyproject.toml` for formatter configuration, or at minimum check for `[tool.black]` or `[tool.ruff.format]` sections.

---

### M3. `detectTestingFramework` incorrectly assumes RSpec for all Ruby projects

> **Resolved.** `src/analyzer.ts:474-484` checks for `.rspec` file, then `spec/` directory, then reads `Gemfile` for "rspec" string. Returns `null` for Minitest-only projects (no specific Minitest detection added — but `null` is correct for "unknown framework"). Re-validated 2026-05-25 during Phase 11.

- **Severity**: Medium
- **Category**: Runtime Failure
- **File**: `src/analyzer.ts:469`

**Description**: `if (files.includes("Gemfile")) return "rspec";` assumes every Ruby project uses RSpec. Many Ruby projects use Minitest (Rails default).

**Fix**: Check for `spec/` directory or `rspec` in Gemfile before defaulting.

---

### M4. E2E tests don't test the actual CLI flow

- **Severity**: Medium
- **Category**: Test Gap
- **File**: `src/cli.e2e.test.ts`

**Description**: The 3 E2E tests only cover `--version` and `--help` flags. No E2E test exercises the actual main flow: analyzing a repo, generating artifacts, writing files. The most important user journey — `npx claude-code-starter -y` in a project — has zero E2E coverage.

**Fix**: Add E2E tests that run the full flow:
```typescript
it("generates artifacts in a temp project", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "e2e-"));
  writeFileSync(join(tmpDir, "package.json"), '{"name":"test"}');
  writeFileSync(join(tmpDir, "index.ts"), "export const x = 1;");

  // Use --no-interactive to skip prompts, expect it to fail at
  // checkClaudeCli() since claude isn't installed in CI
  const result = spawnSync("node", [cliPath, "-y"], {
    cwd: tmpDir,
    encoding: "utf-8",
  });

  // Should have generated artifacts before failing on claude CLI check
  expect(existsSync(join(tmpDir, ".claude", "settings.json"))).toBe(true);
});
```

---

### M5. `analyzeRepository` doesn't handle symlinked project roots

- **Severity**: Medium
- **Category**: Runtime Failure
- **File**: `src/analyzer.ts:48-61`, `src/cli.ts:437`

**Description**: `main()` uses `process.cwd()` as the project directory. If the user's CWD is a symlink, `process.cwd()` returns the symlinked path, but `fs.readdirSync` follows the real path. This inconsistency could cause path mismatches when writing artifacts.

**Fix**: Resolve the CWD to its real path:
```typescript
const projectDir = fs.realpathSync(process.cwd());
```

---

### M6. `countSourceFiles` has hardcoded depth limit of 5

- **Severity**: Medium
- **Category**: Runtime Failure
- **File**: `src/analyzer.ts:763`

**Description**: `countFiles` stops at depth 5, meaning deeply nested source files in monorepos (e.g., `packages/core/src/modules/auth/handlers/`) won't be counted. This affects the `fileCount` which determines whether a project is considered "existing" (`fileCount > 0`).

**Fix**: Increase depth or remove the limit. Consider using a proper directory walker that respects `.gitignore`.

---

### M7. `listRootFiles` only reads the root directory

- **Severity**: Medium
- **Category**: Runtime Failure
- **File**: `src/analyzer.ts:130-136`

**Description**: Language and framework detection only looks at files in the project root directory. Projects where config files are in subdirectories (e.g., `app/build.gradle.kts` in Android monorepos) rely on special-case handling in `detectFrameworks`. The function does check `app/build.gradle` and `app/build.gradle.kts` explicitly, but other non-root configs (like `backend/requirements.txt` in a monorepo) are missed entirely.

**Fix**: Document this limitation or extend detection to scan common subdirectories.

---

### M8. `checkClaudeCli` doesn't validate CLI version compatibility

- **Severity**: Medium
- **Category**: Runtime Failure
- **File**: `src/cli.ts:361-368`

**Description**: `checkClaudeCli()` only verifies that `claude --version` returns exit code 0. It doesn't check the version number. If a user has an old version of Claude CLI that doesn't support the `-p` flag or `--allowedTools`, `runClaudeAnalysis` will fail with a confusing error.

**Fix**: Parse the version output and check minimum version:
```typescript
export function checkClaudeCli(): boolean {
  try {
    const version = execSync("claude --version", { encoding: "utf-8" }).trim();
    // Optionally check minimum version
    return true;
  } catch {
    return false;
  }
}
```

---

## Low Findings

### L1. `release.yml` runs E2E tests BEFORE building

- **Severity**: Low
- **Category**: CI Gap
- **File**: `.github/workflows/release.yml:43-44`

**Description**: In the `test` job, E2E tests run at line 43 (`bun run test:e2e`) before the build step at line 53 (`bun run build`). However, `test:e2e` includes its own build step (`bun run build && bun test src/cli.e2e.test.ts`), so this is redundant rather than broken. The build at line 53 re-builds unnecessarily.

**Fix**: Remove the redundant build step at line 53, or restructure to build once and share the artifact.

---

### L2. `prepublishOnly` runs unit tests but not E2E tests

- **Severity**: Low
- **Category**: CI Gap
- **File**: `package.json:41`

**Description**: `"prepublishOnly": "bun run build && bun run test"` only runs unit tests. E2E tests (which caught the symlink bug) are not part of the publish safety net for local `npm publish`.

**Fix**: Change to `"prepublishOnly": "bun run build && bun run test && bun test src/cli.e2e.test.ts"`

---

### L3. No `.npmignore` — relies on `"files"` field

- **Severity**: Low
- **Category**: Distribution Bug
- **File**: `package.json:25-27`

**Description**: The `"files": ["dist"]` field in `package.json` is the correct modern approach and works fine. However, the npm tarball also includes `LICENSE` and `README.md` (npm always includes these). The tarball does NOT include the source `src/` directory, `.github/`, or test files — which is correct.

Verified via `npm pack --dry-run`:
```
LICENSE, README.md, dist/cli.js, package.json (4 files, 132KB)
```

**Status**: Working correctly. No fix needed.

---

### L4. `tsup.config.ts` targets `esnext` but `engines` says `>=18.0.0`

> **Resolved by Phase 10 (deps & toolchain bump).** The recommended fix (`target: "node18"`) was applied, then superseded — current target is `node22` with engine floor `>=22.14.0`. See `docs/superpowers/plans/phase-10-deps-toolchain-bump.md`.

- **Severity**: Low
- **Category**: Distribution Bug
- **File**: `tsup.config.ts:7`, `package.json:61`

**Description**: tsup builds with `target: "esnext"`, which means the output uses the very latest JavaScript features. While Node 18+ supports most modern JS, `esnext` could emit features only available in Node 22+ (e.g., certain import assertions syntax). Currently the built output appears compatible, but future changes could introduce incompatibilities.

**Fix**: Change target to `"node18"` to explicitly guarantee compatibility:
```typescript
export default defineConfig({
  target: "node18",
});
```

---

### L5. Test `checkClaudeCli` is environment-dependent

- **Severity**: Low
- **Category**: Test Gap
- **File**: `src/cli.test.ts:1380-1384`

**Description**: The test only checks that the return type is boolean. If `claude` is installed on the dev machine, it returns `true`; in CI it returns `false`. Neither branch is explicitly tested for correct behavior.

**Fix**: Mock `execSync` to test both branches:
```typescript
it("returns true when claude CLI is available", () => { ... });
it("returns false when claude CLI is not found", () => { ... });
```

---

### L6. `console.log` usage throughout source code

- **Severity**: Low
- **Category**: Code Quality
- **File**: `src/cli.ts` (multiple lines)

**Description**: The CLI uses `console.log` for all output. This makes it impossible to programmatically use the tool (e.g., piping output, JSON mode, quiet mode) and makes testing output difficult. The `pr-check.yml` code quality job already warns about this.

**Fix**: Consider a logger abstraction for non-critical log, but this is low priority for a CLI tool.

---

### L7. No test for `getAnalysisPrompt` content quality

- **Severity**: Low
- **Category**: Test Gap
- **File**: `src/cli.test.ts:1397-1433`

**Description**: The test for `getAnalysisPrompt` only checks that the return contains the project name and some keywords. It doesn't verify the prompt structure, phase ordering, or that the context section properly includes all tech stack details. The prompt now has 7 phases (Phases 1-3 for analysis + CLAUDE.md, Phase 4 for skills, Phase 5 for agents, Phase 6 for rules, Phase 7 for commands). If any phase template is accidentally broken, tests won't catch it.

**Fix**: Add assertions for all critical prompt phases:
```typescript
expect(prompt).toContain("Phase 2");
expect(prompt).toContain("Phase 3");
expect(prompt).toContain("Phase 4");
expect(prompt).toContain("Phase 5");
expect(prompt).toContain("Phase 6");
expect(prompt).toContain("Phase 7");
expect(prompt).toContain("Write tool");
```

---

## Summary Table

| ID | Severity | Category | Finding | Effort |
|----|----------|----------|---------|--------|
| C1 | Critical | Distribution Bug | `isMain` crashes on undefined `process.argv[1]` | Small |
| C2 | Critical | CI Gap | Dual npm publishing race condition | Small |
| C3 | Critical | CI Gap | Version commit triggers release loop | Small |
| H1 | High | CI Gap | Cache key references wrong lock file (`bun.lockb` vs `bun.lock`) | Small |
| H2 | High | Distribution Bug | VERSION read crashes if package.json missing | Small |
| H3 | High | Test Gap | `runClaudeAnalysis` has zero test coverage | Medium |
| H4 | High | Runtime Failure | Ctrl+C orphans Claude subprocess | Small |
| H5 | High | Test Gap | `main()` function completely untested | Large |
| H6 | High | Runtime Failure | `writeSettings` silently overwrites user-customized settings.json | Medium |
| M1 | Medium | Runtime Failure | Missing framework display names (10 frameworks) | Small |
| M2 | Medium | Runtime Failure | Formatter detection always returns "black" for Python | Small |
| M3 | Medium | Runtime Failure | Testing framework always assumes RSpec for Ruby | Small |
| M4 | Medium | Test Gap | E2E tests don't cover actual CLI flow | Medium |
| M5 | Medium | Runtime Failure | Symlinked project roots cause path mismatches | Small |
| M6 | Medium | Runtime Failure | Source file count limited to depth 5 | Small |
| M7 | Medium | Runtime Failure | Detection only reads root directory files | Medium |
| M8 | Medium | Runtime Failure | No Claude CLI version check | Small |
| L1 | Low | CI Gap | Redundant build step in release.yml | Small |
| L2 | Low | CI Gap | `prepublishOnly` skips E2E tests | Small |
| L3 | Low | Distribution Bug | No .npmignore (OK — using files field) | None |
| L4 | Low | Distribution Bug | tsup targets esnext vs node18 engines | Small |
| L5 | Low | Test Gap | `checkClaudeCli` test is environment-dependent | Small |
| L6 | Low | Code Quality | `console.log` throughout (normal for CLI) | Large |
| L7 | Low | Test Gap | `getAnalysisPrompt` test doesn't verify structure | Small |

---

## Action Plan (Prioritized by Impact vs Effort)

### Immediate (< 1 hour, high impact)

1. **Fix C1**: Wrap `isMain` guard in try-catch — 5 min code change + test
2. **Fix C2+C3**: Remove `publish.yml` entirely, let semantic-release handle everything — 5 min
3. **Fix H1**: Update all `bun.lockb` references to `bun.lock` in CI — 10 min
4. **Fix H2**: Add try-catch around VERSION read — 5 min

### Short-term (1-3 hours, medium impact)

5. **Fix H4**: Add signal handling for Claude subprocess — 15 min
6. **Fix M1**: Add missing framework display names — 10 min
7. **Fix M2**: Fix Python formatter detection — 15 min
8. **Fix M3**: Fix Ruby testing framework detection — 10 min
9. **Fix L2**: Add E2E tests to prepublishOnly — 5 min
10. **Fix L4**: Change tsup target to node18 — 5 min

### Medium-term (3-8 hours, structural)

11. **Fix H3**: Add unit tests for `runClaudeAnalysis` — 1-2 hours
12. **Fix H6**: Implement file modification detection in `writeSettings` — 1-2 hours
13. **Fix M4**: Add E2E tests for full CLI flow — 2-3 hours
14. **Fix H5**: Add integration tests for `main()` — 3-4 hours

### Long-term (deferred, lower priority)

15. **Fix M5-M8**: Various runtime edge cases — as encountered
16. **Fix L5-L7**: Test quality improvements — next test refactor sprint
17. **Fix L6**: Logger abstraction — only if JSON output mode is needed
