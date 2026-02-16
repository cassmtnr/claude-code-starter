# Staff Engineer Reliability Audit: claude-code-starter

## Role

You are a Staff Engineer performing a comprehensive reliability and quality audit of the `claude-code-starter` CLI tool. Your goal is to identify **every scenario that could break in production, CI, or user environments** — especially the subtle ones that unit tests miss.

## Context

This is a TypeScript CLI tool (built with tsup, tested with bun:test) that:
1. Analyzes a repository's tech stack (`src/analyzer.ts`)
2. Generates Claude Code configuration files (`src/generator.ts`)
3. Spawns the `claude` CLI for deep project analysis (`src/cli.ts`)
4. Writes artifacts to disk (skills, agents, rules, settings)

We recently discovered a **shipped bug** where the CLI silently did nothing when installed globally via `npm install -g` or invoked via `npx`. The root cause was the `isMain` ESM entry-point guard comparing `process.argv[1]` against `fileURLToPath(import.meta.url)` — these diverge when Node resolves a symlink. This was undetected because:
- All 124 tests were unit tests importing functions directly
- No test ever ran the built artifact as a subprocess
- No test exercised the symlink path that `npm link` / `npm install -g` creates

This bug pattern — **things that work in dev/test but break in distribution** — is what we want to systematically find and eliminate.

## Audit Scope

### 1. Test Coverage Gaps

Analyze `src/cli.test.ts` (unit tests) and `src/cli.e2e.test.ts` (E2E tests) against the actual source code. For each source file, identify:

- **Exported functions that have no tests or weak tests**
- **Code paths that are only reachable via `main()` and never tested** (like the `isMain` bug)
- **Error handling paths** — are `catch` blocks, fallback behaviors, and edge cases tested?
- **Integration boundaries** — places where modules interact (analyzer -> generator -> writer) that are only tested in isolation

Focus especially on:
- `src/cli.ts` — the `main()` function orchestration, `runClaudeAnalysis()` subprocess spawning, `checkClaudeCli()`, interactive prompts
- `src/analyzer.ts` — filesystem-dependent detection logic, what happens with unusual/corrupted files
- `src/generator.ts` — artifact generation for all tech stacks, file writing, `--force` overwrite behavior

### 2. Distribution & Packaging Risks

Look for issues that only manifest when the package is built and distributed:

- **tsup bundling** — does the build output correctly handle `__dirname`, `import.meta.url`, relative paths to `package.json`?
- **`"files"` field in package.json** — is everything needed actually included in the npm tarball?
- **Shebang and permissions** — does `#!/usr/bin/env node` work across platforms?
- **ESM vs CJS** — any compatibility issues with the `"type": "module"` setup?
- **Node.js version compatibility** — `engines` says `>=18.0.0`, but are there APIs used that require newer versions?
- **Bun vs Node runtime** — dev uses Bun but distribution targets Node. Are there Bun-specific APIs leaking into production code?

### 3. Runtime Failure Modes

Identify scenarios where the CLI could crash, hang, or produce wrong output:

- **Filesystem edge cases** — read-only directories, permission denied, symlinked project roots, paths with spaces/special chars, very deep directory trees
- **Subprocess failures** — `claude` CLI not installed, times out, crashes mid-analysis, outputs unexpected data
- **Concurrent execution** — what if two instances run simultaneously in the same directory?
- **Large projects** — performance or memory issues with huge monorepos
- **Missing/corrupted config files** — partial `package.json`, binary files where text is expected
- **Signal handling** — Ctrl+C during execution, SIGTERM behavior

### 4. CI/CD Pipeline Gaps

Review the GitHub Actions workflows (`pr-check.yml`, `release.yml`, `publish.yml`):

- **Are unit tests and E2E tests properly separated?** (We just fixed `bun test` vs `bun run test` confusion)
- **Does the release pipeline test the actual artifact that gets published?**
- **Are there race conditions** between the release workflow and publish workflow?
- **Is semantic-release properly configured?** Could a malformed commit message cause a bad release?
- **Is the version commit-back from publish.yml safe?** Could it create an infinite trigger loop?

### 5. Security Concerns

- **Command injection** — `execSync` / `spawn` with user-controlled paths
- **Path traversal** — does the tool safely handle project directories?
- **Secrets in artifacts** — could generated files accidentally include env vars or secrets?
- **npm supply chain** — are dependencies pinned? Are there unnecessary dependencies?

## Deliverables

For each finding, provide:

1. **Severity**: Critical / High / Medium / Low
2. **Category**: Test Gap / Distribution Bug / Runtime Failure / CI Gap / Security
3. **Description**: What the issue is and why it matters
4. **Reproduction**: How to trigger it (or why it's hard to trigger)
5. **Fix**: Concrete recommendation — specific test to add, code change to make, or workflow to update

### Output Format

Organize findings into a prioritized report:

1. **Critical** — Could cause silent failures in production (like the symlink bug)
2. **High** — Would cause visible failures for a subset of users
3. **Medium** — Edge cases that degrade experience
4. **Low** — Code quality improvements that reduce future risk

End with a **Summary Table** of all findings and a recommended **Action Plan** prioritized by impact vs effort.

## Important Notes

- Read ALL source files thoroughly before reporting. Don't guess — verify.
- Cross-reference test files against source to find untested paths.
- Check the actual built output (`dist/cli.js`) not just the source.
- Look at real npm package contents (`npm pack --dry-run`).
- Think about what users actually do: `npx`, `npm install -g`, running from CI, running on Windows (if applicable).
- The project uses Biome for linting/formatting — check config is consistent.
- Focus on **actionable findings**, not theoretical risks.
