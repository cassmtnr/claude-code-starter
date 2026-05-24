# Roadmap

## Project Overview

**claude-code-starter** is a TypeScript CLI tool (npm package) that intelligently bootstraps Claude Code configurations for any repository. It detects a project's tech stack, spawns the Claude CLI to deeply analyze the codebase, and generates all `.claude/` configuration files — so developers don't have to learn every configuration surface manually.

### What It Does Today (v0.15.0)

**Core Pipeline**: CLI parses args → analyzer detects tech stack → generator writes `settings.json` → `prompt.ts` builds a 7-phase analysis prompt → Claude CLI spawns to generate content files → `validator.ts` deduplicates artifacts.

**Generated Artifacts**:

| Category | Files | Method |
|----------|-------|--------|
| CLAUDE.md | 1 project-specific file (max 120 lines) | Claude CLI analysis |
| Settings | `settings.json` | Deterministic generator |
| Skills | 4 core + framework-specific (13 frameworks) + project-specific | Claude CLI (Phase 4) |
| Agents | 6 (code-reviewer, test-writer, code-simplifier, explore, plan, docs-writer) | Claude CLI (Phase 5) |
| Rules | 1-5 per language (5 languages) | Claude CLI (Phase 6) |
| Commands | 6 (/analyze, /code-review, /commit, /fix, /explain, /refactor) | Claude CLI (Phase 7) |
| Memory | Initial memory seeds from analysis | Claude CLI (Phase 8) |

**Tech Stack Detection**: 12 languages, 42+ frameworks, 11 package managers, 12 testing frameworks, 8 linters, 7 formatters, 8 bundlers, 6 CI/CD platforms.

**Extras**: Safety hook (blocks dangerous commands, 166 patterns), custom statusline (shows project, branch, context, model), sensitive file protection, and tool usage logger.

**Key Features**: New project questionnaire, CLAUDE.md mode selector (keep/improve/replace), post-generation deduplication validator, streaming JSON spinner, update checker, verbose/force/non-interactive modes, `--refresh` for settings-only updates.

---

> **Numbering convention:** Phases 1–9 below track in-feature work. Phases 10+ (see `docs/superpowers/plans/phase-10-*` etc.) track codebase overhaul work and live in separate spec files.

## Phase 1: Reliability Fixes

Items from the [Staff Engineer Reliability Audit](docs/AUDIT.md). Each is independent and can be tackled in any order.

### 1.1 Fix `isMain` crash on undefined `process.argv[1]`

**Severity**: Critical | **Effort**: Small | **Audit ID**: C1

The entry-point guard `fs.realpathSync(process.argv[1])` throws when `process.argv[1]` is `undefined` (e.g., `node -e "import('./dist/cli.js')"`).

**Implementation**:
- In `src/cli.ts`, wrap the `isMain` assignment in a try-catch, defaulting to `false`
- Add E2E test: `node -e "import('./dist/cli.js')"` should not throw

**Files to modify**: `src/cli.ts`, `src/cli.e2e.test.ts`

---

### 1.2 Remove dual npm publishing race condition

**Severity**: Critical | **Effort**: Small | **Audit IDs**: C2, C3

Two workflows both publish to npm: `release.yml` (via semantic-release) and `publish.yml` (via `npm publish`). The `publish.yml` version commit also triggers an infinite release loop because it lacks `[skip ci]`.

**Implementation**:
- Delete `.github/workflows/publish.yml` entirely
- Semantic-release already handles npm publish + version commit via `@semantic-release/git`
- Verify `.releaserc.json` has `npmPublish: true` and `@semantic-release/git` configured

**Files to modify**: Delete `.github/workflows/publish.yml`, verify `.releaserc.json`

---

### 1.3 Fix CI cache key (`bun.lockb` → `bun.lock`)

**Severity**: High | **Effort**: Small | **Audit ID**: H1

All workflow files cache using `hashFiles('**/bun.lockb')` but the project uses `bun.lock` (text format). Cache key is always empty, meaning stale caches persist across dependency changes.

**Implementation**:
- Search all `.github/workflows/*.yml` for `bun.lockb` and replace with `bun.lock`
- Appears in ~8 places across `pr-check.yml` and `release.yml`

**Files to modify**: `.github/workflows/pr-check.yml`, `.github/workflows/release.yml`

---

### 1.4 Fix VERSION crash when `package.json` is missing

**Severity**: High | **Effort**: Small | **Audit ID**: H2

`VERSION` is computed at import time via `fs.readFileSync`. Crashes if `package.json` is inaccessible.

**Implementation**:
- Option A: Wrap in try-catch with fallback `"unknown"`
- Option B (preferred): Use tsup's `define` to inject version at build time:
  ```typescript
  // tsup.config.ts
  import pkg from "./package.json";
  export default defineConfig({
    define: { __VERSION__: JSON.stringify(pkg.version) },
  });
  ```
- Add test: importing the module with missing `package.json` should not crash

**Files to modify**: `src/cli.ts`, `tsup.config.ts`

---

### 1.5 Add signal handling for Claude subprocess

**Severity**: High | **Effort**: Small | **Audit ID**: H4

Ctrl+C during `runClaudeAnalysis` exits the parent but orphans the spawned `claude` subprocess.

**Implementation**:
- In `runClaudeAnalysis`, register `SIGINT`/`SIGTERM` handlers that call `child.kill("SIGTERM")`
- Remove handlers in `child.on("close")` to avoid leaking listeners
- Test: mock `spawn` and verify `child.kill` is called when process receives `SIGINT`

**Files to modify**: `src/cli.ts`

---

### 1.6 Fix missing framework display names

**Severity**: Medium | **Effort**: Small | **Audit ID**: M1

`formatFramework` is missing display names for 10 frameworks: `swiftui`, `uikit`, `vapor`, `swiftdata`, `combine`, `jetpack-compose`, `android-views`, `room`, `hilt`, `ktor-android`.

**Implementation**:
- Add all 10 entries to the `formatFramework` lookup table in `src/cli.ts`
- Update existing tests in `src/cli.test.ts` that verify these return raw identifiers — they should now return formatted names

**Files to modify**: `src/cli.ts`, `src/cli.test.ts`

---

### 1.7 Fix Python formatter detection

**Severity**: Medium | **Effort**: Small | **Audit ID**: M2

`detectFormatter` always returns `"black"` for any project with `pyproject.toml`, even if Black is not configured.

**Implementation**:
- Read `pyproject.toml` and check for `[tool.black]` or `[tool.ruff.format]` sections
- If neither is found, return `null` instead of assuming Black
- Add tests for: pyproject.toml with Black, with Ruff formatter, with neither

**Files to modify**: `src/analyzer.ts`, `src/cli.test.ts`

---

### 1.8 Fix Ruby testing framework detection

**Severity**: Medium | **Effort**: Small | **Audit ID**: M3

`detectTestingFramework` assumes all Ruby projects use RSpec. Many use Minitest (Rails default).

**Implementation**:
- Check for `spec/` directory or `rspec` in Gemfile before returning `"rspec"`
- Check for `test/` directory as indicator for Minitest
- Add tests for both detection paths

**Files to modify**: `src/analyzer.ts`, `src/cli.test.ts`

---

### 1.9 Prevent `writeSettings` from overwriting user customizations

**Severity**: High | **Effort**: Medium | **Audit ID**: H6

`writeSettings()` overwrites `settings.json` without checking if the user has customized it.

**Implementation**:
- Before writing, check if `settings.json` exists
- If it does, read it and deep-merge with generated settings (preserving user-added keys)
- Use the existing `patchSettings` merge pattern from `src/hooks.ts` as reference
- Add `--force` flag behavior: skip merge, overwrite entirely
- Add test: existing settings.json with custom keys should retain them after re-run

**Files to modify**: `src/generator.ts`, `src/cli.test.ts`

---

### 1.10 Add test coverage for `runClaudeAnalysis`

**Severity**: High | **Effort**: Medium | **Audit ID**: H3

The core feature function has zero test coverage. Multiple code paths (success, spawn error, non-zero exit) are untested.

**Implementation**:
- Mock `child_process.spawn` to control the child process behavior
- Test cases:
  - Returns `false` when `claude` binary is not found (spawn error event)
  - Returns `false` on non-zero exit code
  - Returns `true` on successful analysis (exit code 0)
  - Prompt includes project name and detected tech stack
- Consider extracting the function to make it more testable

**Files to modify**: `src/cli.ts`, `src/cli.test.ts`

---

### 1.11 Add E2E tests for full CLI flow

**Severity**: Medium | **Effort**: Medium | **Audit ID**: M4

E2E tests only cover `--version` and `--help`. The actual analysis flow has no E2E coverage.

**Implementation**:
- Create a temp directory with fixture files (`package.json`, `index.ts`)
- Run `node dist/cli.js -y` in the temp directory
- Verify `settings.json` and `.claude/` directories are created before the Claude CLI check
- Test should expect graceful failure at `checkClaudeCli()` in CI (Claude not installed)
- Verify generated `settings.json` content matches expected structure

**Files to modify**: `src/cli.e2e.test.ts`

---

### 1.12 Remaining medium/low fixes

**Effort**: Small each | **Audit IDs**: M5-M8, L1-L2, L4-L7

These can be batched into a single cleanup pass:
- **M5**: Resolve symlinked project roots with `fs.realpathSync(process.cwd())`
- **M6**: Increase `countSourceFiles` depth limit or remove it
- **M7**: Extend detection to scan common subdirectories (`app/`, `backend/`, `frontend/`)
- **M8**: Parse Claude CLI version output and check minimum compatibility
- **L1**: Remove redundant build step in `release.yml`
- **L2**: Add E2E tests to `prepublishOnly` script
- **L4**: Change tsup target from `esnext` to `node18`
- **L5**: Mock `execSync` in `checkClaudeCli` tests for both branches
- **L7**: Add prompt structure assertions to `getAnalysisPrompt` tests

**Files to modify**: `src/analyzer.ts`, `src/cli.ts`, `src/cli.test.ts`, `src/cli.e2e.test.ts`, `tsup.config.ts`, `.github/workflows/release.yml`, `package.json`

---

## Phase 2: More Agents

Currently only 2 agents (code-reviewer, test-writer). Adding more agents is high-impact because agents run in subprocesses with zero main-context cost — they're the most efficient way to give Claude specialized capabilities.

### 2.1 Code Simplifier Agent

An agent that reviews recently modified code for clarity, consistency, and maintainability.

**Implementation**:
- Add to the Phase 5 prompt in `src/prompt.ts` (the `AGENTS_PROMPT` constant)
- Agent file: `.claude/agents/code-simplifier.md`
- Frontmatter:
  ```yaml
  name: code-simplifier
  description: Simplifies and refines code for clarity, consistency, and maintainability
  tools: [Read, Grep, Glob, Write, Edit, Bash]
  model: sonnet
  ```
- Body instructions:
  - Focus on recently modified code (use `git diff` to identify changed files)
  - Look for: duplicated logic, overly complex conditionals, dead code, inconsistent patterns
  - Simplify without changing behavior — preserve all existing functionality
  - Cross-reference CLAUDE.md conventions for naming and style
  - Run linter and tests after modifications to verify nothing breaks

**Files to modify**: `src/prompt.ts` (AGENTS_PROMPT section)

---

### 2.2 Explore Agent

A fast, read-only agent specialized for codebase navigation and architecture questions.

**Implementation**:
- Add to the Phase 5 prompt in `src/prompt.ts`
- Agent file: `.claude/agents/explore.md`
- Frontmatter:
  ```yaml
  name: explore
  description: Fast codebase exploration — find files, search code, answer architecture questions
  tools: [Read, Grep, Glob]
  disallowed_tools: [Write, Edit, Bash]
  model: haiku
  ```
- Body instructions:
  - Use Glob for file pattern matching, Grep for content search, Read for file contents
  - Answer questions about: where things are defined, how modules connect, what patterns are used
  - Report findings in a structured format: file paths, relevant code snippets, relationships
  - Never modify files — this agent is read-only

**Files to modify**: `src/prompt.ts` (AGENTS_PROMPT section)

---

### 2.3 Plan Agent

A software architect agent that designs implementation plans before coding starts.

**Implementation**:
- Add to the Phase 5 prompt in `src/prompt.ts`
- Agent file: `.claude/agents/plan.md`
- Frontmatter:
  ```yaml
  name: plan
  description: Designs implementation plans with step-by-step approach and trade-off analysis
  tools: [Read, Grep, Glob]
  disallowed_tools: [Write, Edit, Bash]
  model: sonnet
  ```
- Body instructions:
  - Read relevant source files to understand current architecture
  - Identify affected files, dependencies, and potential risks
  - Produce a step-by-step plan with: files to create/modify, approach for each, testing strategy
  - Consider trade-offs: complexity vs simplicity, performance vs readability
  - Flag breaking changes or migration requirements
  - Cross-reference CLAUDE.md for conventions and patterns to follow

**Files to modify**: `src/prompt.ts` (AGENTS_PROMPT section)

---

### 2.4 Docs Writer Agent

An agent that generates and updates documentation based on code changes.

**Implementation**:
- Add to the Phase 5 prompt in `src/prompt.ts`
- Agent file: `.claude/agents/docs-writer.md`
- Frontmatter:
  ```yaml
  name: docs-writer
  description: Generates and updates documentation from code analysis
  tools: [Read, Grep, Glob, Write, Edit]
  disallowed_tools: [Bash]
  model: sonnet
  ```
- Body instructions:
  - Analyze code changes (via `git diff` context or specified files)
  - Update relevant documentation: README, API docs, architecture docs, changelogs
  - Generate JSDoc/docstrings for new public functions/classes
  - Maintain consistency with existing documentation style
  - Never fabricate information — only document what's verifiable from the code

**Files to modify**: `src/prompt.ts` (AGENTS_PROMPT section)

---

### 2.5 Update agent count references

After adding agents, update all references to the agent count.

**Implementation**:
- Update `src/cli.ts` summary output (currently says "2 agents")
- Update `.claude/CLAUDE.md` architecture description
- Update `AGENTS_PROMPT` header comment if it mentions the count
- Verify the validator in `src/validator.ts` handles the new agent files correctly

**Files to modify**: `src/cli.ts`, `src/prompt.ts`, `.claude/CLAUDE.md`

---

## Phase 3: More Commands

Currently only `/analyze` and `/code-review`. Adding practical commands users reach for daily.

### 3.1 `/commit` Command

A guided conventional commit message generator.

**Implementation**:
- Add to the Phase 7 prompt in `src/prompt.ts` (the `COMMANDS_PROMPT` constant)
- Command file: `.claude/commands/commit.md`
- Frontmatter:
  ```yaml
  allowed-tools: ["Read", "Grep", "Glob", "Bash(git status)", "Bash(git diff)", "Bash(git diff --cached)", "Bash(git log)"]
  description: "Generate a conventional commit message from staged changes"
  ```
- Body instructions:
  - Run `git diff --cached` to see staged changes
  - Run `git log --oneline -10` to match existing commit style
  - Analyze the nature of changes (feat, fix, refactor, chore, docs, test)
  - Generate a conventional commit message: type(scope): subject
  - Include body if changes are substantial (>50 lines changed)
  - Present the message for user approval before committing
  - Follow commit conventions from CLAUDE.md

**Files to modify**: `src/prompt.ts` (COMMANDS_PROMPT section)

---

### 3.2 `/fix` Command

Diagnose and fix a failing test or error.

**Implementation**:
- Add to the Phase 7 prompt in `src/prompt.ts`
- Command file: `.claude/commands/fix.md`
- Frontmatter:
  ```yaml
  allowed-tools: ["Read", "Grep", "Glob", "Write", "Edit", "Bash"]
  description: "Diagnose and fix a failing test or error"
  argument-hint: "<error message or test name>"
  ```
- Body instructions:
  - If argument is a test name: run that specific test to reproduce the failure
  - If argument is an error message: search codebase for related code
  - Follow 4-phase debugging methodology: Reproduce → Locate → Diagnose → Fix
  - Trace the error from the failure point back to the root cause
  - Apply the minimal fix that resolves the issue
  - Re-run the failing test to verify the fix
  - Run the full test suite to check for regressions

**Files to modify**: `src/prompt.ts` (COMMANDS_PROMPT section)

---

### 3.3 `/explain` Command

Deep-dive explanation of a file, module, or concept.

**Implementation**:
- Add to the Phase 7 prompt in `src/prompt.ts`
- Command file: `.claude/commands/explain.md`
- Frontmatter:
  ```yaml
  allowed-tools: ["Read", "Grep", "Glob"]
  description: "Deep explanation of a file, module, or concept"
  argument-hint: "<file path, module name, or concept>"
  ```
- Body instructions:
  - Read the specified file or search for the module/concept
  - Trace dependencies and dependents (what it imports, what imports it)
  - Explain: purpose, how it works, key design decisions, public API
  - Identify patterns and conventions used
  - Note any gotchas or non-obvious behavior
  - Output structured explanation with sections: Purpose, How It Works, Dependencies, Public API, Gotchas

**Files to modify**: `src/prompt.ts` (COMMANDS_PROMPT section)

---

### 3.4 `/refactor` Command

Targeted refactoring with safety verification.

**Implementation**:
- Add to the Phase 7 prompt in `src/prompt.ts`
- Command file: `.claude/commands/refactor.md`
- Frontmatter:
  ```yaml
  allowed-tools: ["Read", "Grep", "Glob", "Write", "Edit", "Bash"]
  description: "Targeted refactoring of a specific area"
  argument-hint: "<file path or description of what to refactor>"
  ```
- Body instructions:
  - Read the target code and understand its current structure
  - Search for all references to affected functions/variables/types
  - Plan the refactoring: what changes, what stays, what tests cover it
  - Apply changes incrementally, running tests after each step
  - Verify all references are updated (imports, usages, tests, docs)
  - Run full test suite and linter to confirm no regressions

**Files to modify**: `src/prompt.ts` (COMMANDS_PROMPT section)

---

### 3.5 Update command count references

After adding commands, update all references to the command count.

**Implementation**:
- Update `src/cli.ts` summary output
- Update the `COMMANDS_PROMPT` header if it mentions count
- Verify validator handles new command files

**Files to modify**: `src/cli.ts`, `src/prompt.ts`

---

## Phase 4: Memory Bootstrapping

Claude Code's memory system (`.claude/projects/*/memory/`) starts empty. The CLI can seed initial memories from what it discovers during analysis, giving Claude a head start.

### 4.1 Design memory seed structure

**Implementation**:
- Define which memory types to seed (from Claude Code's memory system):
  - **project**: architecture decisions, domain context, active initiatives
  - **reference**: external system pointers (CI/CD URLs, issue trackers, docs)
- Each memory file uses frontmatter: `name`, `description`, `type`
- Create a `MEMORY.md` index file pointing to individual memory files
- Keep memories factual and derived from analysis — no opinions or assumptions

**Deliverable**: Document the memory file format and which discoveries map to which memory types. Add new types to `src/types.ts` if needed.

**Files to modify**: `src/types.ts` (new `MemorySeed` interface)

---

### 4.2 Extract memory-worthy facts during analysis

**Implementation**:
- Add a Phase 8 to the prompt in `src/prompt.ts` — "Seed Initial Memories"
- Instruct Claude to extract from Phase 1 discoveries:
  - **project memory**: Architecture pattern (e.g., "Clean Architecture with feature-based modules"), primary domain, database choice rationale if apparent
  - **reference memory**: CI/CD platform URL patterns, documentation locations, issue tracker references found in README or config
- Each memory must be genuinely useful for future conversations, not just restating what's in CLAUDE.md
- Generate files to `.claude/projects/-<project-path>/memory/` (matching Claude Code's path convention)
- Generate a `MEMORY.md` index

**Files to modify**: `src/prompt.ts` (new MEMORY_PROMPT constant, update execution steps)

---

### 4.3 Add memory seeding to CLI pipeline

**Implementation**:
- After the Claude analysis completes, count generated memory files in the summary output
- Add memory files to the validator's file list (so they show in the summary)
- Add `--no-memory` flag to skip memory seeding for users who prefer a clean start
- Update `parseArgs` in `src/cli.ts` and `Args` interface in `src/types.ts`

**Files to modify**: `src/cli.ts`, `src/types.ts`

---

## Phase 5: Hook Ecosystem

Beyond the safety hook, generate project-specific hooks that add real value.

### 5.1 Sensitive file protection hook

A PreToolUse hook that warns before editing sensitive files.

**Implementation**:
- Add a new extra to the `EXTRAS` array in `src/extras.ts`
- Hook file: `.claude/hooks/protect-sensitive-files.js`
- Embed the hook script as a string constant in `src/hooks.ts` (matching existing pattern)
- Hook behavior:
  - Triggers on `Write` and `Edit` tool calls
  - Checks if the target file matches sensitive patterns: `**/migrations/**`, `**/.env*`, `**/secrets/**`, `**/credentials/**`, `**/*.lock`, `**/package-lock.json`
  - Returns `{ "decision": "ask", "message": "This file is sensitive: <reason>" }` for matches
  - Configurable via a patterns array at the top of the script
- Add `checkSensitiveHookStatus` and `installSensitiveHook` functions to `src/hooks.ts`
- Register in `EXTRAS` array with project/global install options

**Files to modify**: `src/hooks.ts`, `src/extras.ts`, `src/cli.test.ts`

---

### 5.2 Tool usage logger hook

A PostToolUse hook that logs tool usage for analytics.

**Implementation**:
- Add a new extra to the `EXTRAS` array in `src/extras.ts`
- Hook file: `.claude/hooks/log-tool-usage.js`
- Embed the hook script in `src/hooks.ts`
- Hook behavior:
  - Triggers on all PostToolUse events
  - Logs to `~/.claude/tool-usage-logs/YYYY-MM-DD.jsonl` (one JSON line per event)
  - Records: timestamp, tool name, session ID, project directory
  - Lightweight — no blocking, append-only file writes
- Useful for understanding which tools are used most, identifying automation opportunities

**Files to modify**: `src/hooks.ts`, `src/extras.ts`

---

### 5.3 Auto-lint hook

A PostToolUse hook that runs the linter on files after Write/Edit.

**Implementation**:
- Add a new extra to the `EXTRAS` array
- Hook file: `.claude/hooks/auto-lint.js`
- Embed in `src/hooks.ts`
- Hook behavior:
  - Triggers on `Write` and `Edit` PostToolUse events
  - Extracts the file path from the tool input
  - Runs the project's linter on that specific file (detected during analysis)
  - Returns lint output as feedback to Claude so it can self-correct
  - Uses the detected linter from `settings.json` or falls back to common linters
- Must be stack-aware: uses Biome for TS/JS, Ruff for Python, Clippy for Rust, etc.

**Files to modify**: `src/hooks.ts`, `src/extras.ts`

---

## Phase 6: Interactive Tune-Up Mode

A `--tune` flag that re-analyzes an existing `.claude/` setup and suggests improvements.

### 6.1 Implement `--tune` flag and analysis

**Implementation**:
- Add `tune: boolean` to the `Args` interface in `src/types.ts`
- Add `--tune` parsing in `parseArgs()` in `src/cli.ts`
- When `--tune` is active:
  1. Verify `.claude/` directory exists (error if not — nothing to tune)
  2. Read all existing `.claude/` files
  3. Run the tech stack analyzer to get current project state
  4. Compare generated artifacts against current codebase:
     - Are file references in CLAUDE.md still valid? (Glob for each referenced path)
     - Do rule `paths:` globs match files that actually exist?
     - Are skills referencing frameworks no longer in the project?
     - Are there new frameworks/languages not covered by existing rules/skills?
  5. Output a report with findings and suggestions

**Files to modify**: `src/types.ts`, `src/cli.ts`

---

### 6.2 Implement health check scoring

**Implementation**:
- Create `src/health.ts` module with a `checkHealth(projectDir: string)` function
- Health checks (each worth points toward a completeness score):
  - CLAUDE.md exists and is under 120 lines (10 pts)
  - CLAUDE.md file references are valid — glob each path mentioned (10 pts)
  - Settings.json exists and has permissions configured (5 pts)
  - At least 2 agents exist (5 pts)
  - At least 4 skills exist (5 pts)
  - Rules have `paths:` filters (5 pts, deduct for any missing filter)
  - Commands exist (5 pts)
  - Safety hook is installed (5 pts)
  - No convention duplication between CLAUDE.md and other artifacts (10 pts)
- Output: score out of 60, grouped findings, specific fix suggestions
- Use picocolors for colored output (green = passing, yellow = warning, red = failing)

**Files to modify**: New `src/health.ts`, `src/cli.ts` (integrate with `--tune`), `src/cli.test.ts`

---

### 6.3 Auto-fix mode for tune-up

**Implementation**:
- Add `--tune --fix` flag combination
- For each finding that has an automatic fix:
  - Stale file reference in CLAUDE.md → search for the closest matching path and suggest replacement
  - Missing rule for detected language → offer to generate it
  - Orphaned rule for language no longer in project → offer to remove it
  - Missing safety hook → offer to install
- Present each fix for user confirmation (interactive) or apply all (with `-y`)
- After fixes, re-run health check to show improvement

**Files to modify**: `src/health.ts`, `src/cli.ts`

---

## Phase 7: Skill Quality Improvements

Current skills are methodology guides. Making them more actionable and context-aware.

### 7.1 Add `globs` to core skills for auto-triggering

**Implementation**:
- Update the Phase 4 prompt in `src/prompt.ts` to include `globs` in skill frontmatter
- Mapping:
  - `iterative-development.md` → no globs (methodology, invoked manually)
  - `code-deduplication.md` → no globs (methodology, invoked manually)
  - `security.md` → `globs: ["**/.env*", "**/secrets/**", "**/auth/**", "**/middleware/**"]`
  - `testing-methodology.md` → `globs: ["**/*.test.*", "**/*.spec.*", "**/tests/**", "**/test/**"]`
- Framework skills get framework-specific globs:
  - `nextjs-patterns.md` → `globs: ["**/app/**", "**/pages/**", "next.config.*"]`
  - `react-components.md` → `globs: ["**/*.tsx", "**/*.jsx"]`
  - etc.
- Skills with globs auto-load when matching files are open, reducing the need for manual invocation

**Files to modify**: `src/prompt.ts` (SKILLS_PROMPT section)

---

### 7.2 Generate project-specific skills based on detected stack

**Implementation**:
- Extend the framework skill detection beyond the current 13 frameworks
- Add detection-based skills for:
  - **Database/ORM detected** (Prisma, Drizzle, TypeORM, SQLAlchemy) → `database-patterns.md` skill covering migrations, schema changes, query optimization
  - **Docker detected** → `docker-patterns.md` skill covering Dockerfile best practices, compose patterns, multi-stage builds
  - **Monorepo detected** → `monorepo-patterns.md` skill covering cross-package changes, shared dependencies, workspace protocols
  - **CI/CD detected** → `cicd-patterns.md` skill covering workflow modifications, secret handling, deployment patterns
- Each skill is only generated if the corresponding technology is detected in the tech stack
- Update the `SKILLS_PROMPT` in `src/prompt.ts` with conditional generation rules

**Files to modify**: `src/prompt.ts` (SKILLS_PROMPT section)

---

### 7.3 Add tool restrictions to skills

**Implementation**:
- Update the Phase 4 prompt to include `allowed-tools` in skill frontmatter where appropriate
- Skills that involve writing code should list `Write`, `Edit`, `Bash` as allowed
- Skills that are read-only analysis should list only `Read`, `Grep`, `Glob`
- The `security.md` skill should explicitly disallow `Bash` to prevent accidental secret exposure during security review
- This gives users finer control over what Claude can do when a skill is active

**Files to modify**: `src/prompt.ts` (SKILLS_PROMPT section)

---

## Phase 8: Team Sharing & Profiles

Enable configuration sharing across repositories and teams.

### 8.1 Export/import configurations

**Implementation**:
- Add `--export <path>` flag that bundles `.claude/` into a portable archive
  - Export format: a `.claude-config.json` file containing all artifacts as a JSON object
  - Keys: `claudeMd`, `settings`, `skills`, `agents`, `rules`, `commands`, `hooks`
  - Include metadata: source project name, tech stack, export date, CLI version
- Add `--import <path>` flag that applies an exported configuration
  - Read the JSON archive
  - Write files to `.claude/` with conflict detection (prompt before overwriting)
  - Adapt paths if project structure differs (warn about potential mismatches)
- Add `--export-format` option: `json` (default) or `tar.gz` (preserves directory structure exactly)

**Files to modify**: `src/types.ts` (new Args fields), `src/cli.ts` (new subcommands), new `src/portability.ts`

---

### 8.2 Organization templates

**Implementation**:
- Add `--template <name-or-url>` flag for bootstrapping from a predefined template
- Templates are JSON files (same format as export) hosted anywhere (local path, HTTP URL, npm package)
- Built-in template discovery: check for `.claude-template.json` in the project root (useful for monorepos where a parent project defines the base config)
- Template application flow:
  1. Load template (fetch if URL, read if local)
  2. Run tech stack analysis on current project
  3. Merge template with analysis results (template provides base, analysis fills project-specific gaps)
  4. Generate files
- Templates can define `overrides` (always applied) and `defaults` (only if not detected)

**Files to modify**: `src/types.ts`, `src/cli.ts`, `src/portability.ts`

---

### 8.3 Profile flag for different contexts

**Implementation**:
- Add `--profile <name>` flag (e.g., `--profile solo`, `--profile team`, `--profile ci`)
- Profiles adjust generation parameters:
  - **solo**: Fewer guardrails, more automation, skip interactive prompts
  - **team**: Stricter conventions, more comprehensive rules, enforce code review agent
  - **ci**: Minimal output, non-interactive, skip extras prompts, generate only essential files
- Profiles are defined in a `profiles` section of the exported config format, making them sharable
- Default profile is `solo` for new projects, `team` if `.github/CODEOWNERS` or similar is detected

**Files to modify**: `src/types.ts`, `src/cli.ts`, `src/prompt.ts` (profile-specific prompt adjustments)

---

## Phase 9: Standalone Health Check

A `--check` command that audits an existing `.claude/` directory without regenerating anything.

### 9.1 Implement standalone `--check` flag

**Implementation**:
- Reuse the health check module from Phase 6.2 (`src/health.ts`)
- When `--check` is passed:
  1. Skip all generation steps
  2. Run full health check suite
  3. Output scored report
  4. Exit with code 0 if score is above threshold (configurable, default 40/60), code 1 otherwise
- This enables CI integration: `npx claude-code-starter --check` in a GitHub Action to enforce configuration quality
- Add `check: boolean` to `Args` interface

**Files to modify**: `src/types.ts`, `src/cli.ts`

---

### 9.2 CI integration recipe

**Implementation**:
- Add a GitHub Actions workflow example in the README or as a generated file
- Workflow: runs `npx claude-code-starter --check` on PRs that modify `.claude/` files
- Uses `paths` filter: `paths: ['.claude/**']`
- Fails the check if health score drops below threshold
- This ensures `.claude/` configuration stays healthy as the project evolves

**Deliverable**: Documentation + example workflow file

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | Done | Reliability fixes: VERSION crash, signal handling, Python formatter, Ruby testing, writeSettings merge, tsup node18 |
| Phase 2 | Done | 4 new agents in prompt: code-simplifier, explore, plan, docs-writer |
| Phase 3 | Done | 4 new commands in prompt: /commit, /fix, /explain, /refactor |
| Phase 4 | Done | Memory bootstrapping Phase 8 in prompt, --no-memory flag, ci profile skips memory |
| Phase 5 | Partial | Sensitive files hook + tool logger done. Auto-lint hook deferred (requires stack-aware linter detection). |
| Phase 6 | Partial | Health check module + --tune + --check done. --tune --fix auto-repair deferred. |
| Phase 7 | Done | Skill globs guidance, project-specific skills (database, docker, monorepo, cicd) in prompt |
| Phase 8 | Partial | Export/import/template done. URL template loading deferred. Profile: ci implemented, solo/team are no-ops. |
| Phase 9 | Done | --check flag with exit code for CI integration. CI workflow recipe is documentation-only (deferred). |

### Remaining Work

- **Phase 5.3**: Auto-lint hook (stack-aware, needs linter detection at hook install time)
- **Phase 6.3**: `--tune --fix` auto-repair mode
- **Phase 8.2**: URL-based template loading (HTTP fetch)
- **Phase 8.3**: `solo`/`team` profile behaviors beyond `ci`
- **Phase 9.2**: CI integration workflow example documentation
