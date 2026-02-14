# Full Refactoring: Claude-Powered Project Analysis

## Objective

Refactor `claude-code-starter` from the ground up so that `npx claude-code-starter` uses the locally installed **Claude CLI** to deeply analyze any project and generate a professional `.claude/CLAUDE.md`. Remove all dead code, unused functions, duplicate helpers, and stale tests left over from the old static generation approach. Every line of code that ships must earn its place.

---

## Current Architecture (What Exists Today)

```
src/
  types.ts       — Type definitions (Args, TechStack, ProjectInfo, GeneratedArtifact, etc.)
  analyzer.ts    — Tech stack detection (languages, frameworks, package managers, CI/CD, etc.)
  generator.ts   — 3,700+ line file that generates ALL artifacts via string concatenation
  prompt.ts      — Embedded analysis prompt for Claude CLI (new, already created)
  cli.ts         — CLI entry point, argument parsing, main flow
  cli.test.ts    — 133 tests
```

### The Problem

`generator.ts` contains `generateClaudeMd()` (lines 127-245) which builds CLAUDE.md via static string concatenation. It never reads a single source file from the target project. The output is generic boilerplate — identical for any project using the same framework.

The `main()` flow in `cli.ts` already filters out the static CLAUDE.md artifact (`a.type !== "claude-md"`) and spawns Claude CLI instead, but the dead code is still sitting in the codebase. The generator still produces a CLAUDE.md artifact that is immediately thrown away.

---

## Target Architecture (What It Should Become)

```
npx claude-code-starter
  │
  ├─ 1. analyzeRepository()        — Detect tech stack (keep as-is)
  ├─ 2. checkClaudeCli()           — Require claude CLI (exit if missing)
  ├─ 3. generateArtifacts()        — Generate supporting files ONLY:
  │     ├─ settings.json
  │     ├─ skills (8 universal + framework-specific)
  │     ├─ agents (code-reviewer, test-writer)
  │     ├─ rules (language-specific + code-style)
  │     └─ commands (task, status, done, analyze, code-review)
  ├─ 4. writeArtifacts()           — Write supporting files to disk
  ├─ 5. runClaudeAnalysis()        — Spawn claude -p with analysis prompt
  │     └─ Claude reads codebase, writes .claude/CLAUDE.md
  └─ 6. Show summary
```

No static CLAUDE.md generation. No fallback. No `--static` flag. Claude CLI is a hard requirement.

---

## File-by-File Refactoring Plan

### 1. `src/types.ts`

**Current state:** Clean — all types are used. No changes needed except:

- Remove `"claude-md"` from the `GeneratedArtifact.type` union type. The only artifact types the generator should produce are: `"skill" | "agent" | "rule" | "command" | "settings"`.
- Confirm the `Args` interface has NO `static` field.

### 2. `src/analyzer.ts`

**Current state:** Clean — all exports (`analyzeRepository`, `detectTechStack`, `summarizeTechStack`) are used. All internal functions serve the public API.

**Action:** No changes. Keep as-is.

### 3. `src/generator.ts` (major cleanup)

This is the biggest file (~3,700 lines) and where most dead code lives.

#### Remove these functions entirely:

| Function | Lines | Reason |
|----------|-------|--------|
| `generateClaudeMd()` | 127-245 | Dead — output is filtered out, Claude CLI generates CLAUDE.md now |
| `getCommonCommands()` | 247-356 | Dead — only called by `generateClaudeMd()` |
| `formatLanguage()` | ~3571-3587 | Duplicate — identical copy exists in `cli.ts:289` where it's actually used |
| `formatFramework()` | ~3589-3655 | Duplicate — identical copy exists in `cli.ts:307` where it's actually used |

#### Modify `generateArtifacts()`:

- Remove the line `artifacts.push(generateClaudeMd(projectInfo))` — this function no longer exists
- The function should only generate: settings, skills, agents, rules, commands
- Update the JSDoc to reflect it no longer generates CLAUDE.md

#### Keep everything else:

These are all actively used and should remain:

- `writeArtifacts()` — writes artifacts to disk
- `generateSettings()` — settings.json with permissions
- `generateSkills()` + all individual skill generators (pattern-discovery, systematic-debugging, testing-methodology, iterative-development, commit-hygiene, code-deduplication, simplicity-rules, security, and all framework-specific: nextjs, react, fastapi, nestjs, swiftui, uikit, vapor, jetpack-compose, android-views)
- `getSkillsForStack()` — shared between skills generation (keep, but remove usage notes that mention CLAUDE.md)
- `getTestingExamples()` — used by testing methodology skill
- `generateAgents()` + `generateCodeReviewerAgent()` + `generateTestWriterAgent()`
- `getAgentsForStack()` — shared between agents generation (keep, but remove usage notes that mention CLAUDE.md)
- `getLintCommand()` — shared across agents, skills, rules
- `getTestCommand()` — shared across agents, skills
- `generateRules()` + `generateTypeScriptRules()` + `generatePythonRules()` + `generateCodeStyleRule()`
- `generateCommands()` + all 5 individual command generators

#### After cleanup, also:

- Remove any imports that are no longer needed (e.g., if `ProjectInfo` is no longer imported because `generateClaudeMd` was the only consumer)
- Update the module-level JSDoc comment to remove mention of "CLAUDE.md" from the artifact list
- Scan for any private helper that was only reachable through the removed functions

### 4. `src/prompt.ts`

**Current state:** Already created with `getAnalysisPrompt()` and `buildContextSection()`.

**Action:** Review the embedded `ANALYSIS_PROMPT` constant and ensure it is comprehensive. The prompt should instruct Claude to:

#### Phase 1: Discovery
- Read project manifest files
- Map directory structure (depth 3, excluding build artifacts)
- Deep scan tech stack — not just names but HOW each technology is configured and used
- Read 5-10 key source files to recognize architecture patterns (MVC, Clean Architecture, etc.)
- Identify entry points, routes, config, schemas, middleware, types, constants
- Document actual code conventions by reading real files (naming, imports, exports, function style, error handling)
- Catalog dev workflow (scripts, env vars, hooks, test setup, database operations)
- Extract domain knowledge (entities, workflows, integrations, background jobs)

#### Phase 2: Generate CLAUDE.md
Write `.claude/CLAUDE.md` using ONLY discovered information, with sections for:
- Overview, Architecture (with directory tree + data flow + key files table)
- Tech Stack (table with usage notes), Development Setup, Common Commands
- Code Conventions (actual patterns with file references, anti-patterns to avoid)
- Testing, Domain Knowledge, Gotchas, Rules

#### Phase 3: Quality Check
- Every section has project-specific content — no generic boilerplate
- File paths referenced actually exist
- Commands verified from project scripts
- Skip sections that don't apply

### 5. `src/cli.ts`

#### Confirm these exist and work:

- `checkClaudeCli()` — uses `execSync("claude --version")`, returns boolean
- `runClaudeAnalysis(projectDir, projectInfo)` — spawns `claude -p` with `--allowedTools Read Glob Grep Write(.claude/**) Edit(.claude/**)`
- Import of `execSync` and `spawn` from `node:child_process`
- Import of `getAnalysisPrompt` from `./prompt.js`

#### Confirm `main()` flow:

1. Parse args, show banner
2. Analyze repository
3. Handle new projects / existing config prompts
4. **Check Claude CLI** — exit with error + install link if missing
5. Generate supporting artifacts (NO `claude-md` type in the result at all now)
6. Write supporting artifacts to disk
7. Create task file
8. **Run Claude analysis** — exit with error if fails
9. Show summary

#### Confirm NO references to:

- `--static` / `-s` flag
- `args.static`
- Any fallback to static CLAUDE.md generation
- Any conditional `useClaudeAnalysis` branching — Claude is always used

#### Verify `formatLanguage()` and `formatFramework()`:

These functions exist in cli.ts AND had duplicates in generator.ts. After removing the generator.ts duplicates, confirm nothing in generator.ts imports or calls them. If any remaining generator code needs language/framework formatting, import from cli.ts (but this shouldn't be needed since only the dead `generateClaudeMd()` used them in generator.ts).

### 6. `src/cli.test.ts` (test cleanup)

#### Remove these 13 tests that test dead static CLAUDE.md generation:

1. `"generates CLAUDE.md artifact"`
2. `"generates CLAUDE.md with quality gates"`
3. `"CLAUDE.md contains pnpm commands for pnpm projects"`
4. `"CLAUDE.md contains yarn commands for yarn projects"`
5. `"CLAUDE.md contains npm commands for npm projects"`
6. `"CLAUDE.md contains pip commands for Python projects"`
7. `"CLAUDE.md contains poetry commands for Poetry projects"`
8. `"CLAUDE.md contains cargo commands for Rust projects"`
9. `"CLAUDE.md contains go commands for Go projects"`
10. `"CLAUDE.md contains eslint commands with npx for non-bun projects"`
11. `"CLAUDE.md contains biome commands for biome projects"`
12. `"CLAUDE.md contains ruff commands for Python projects with ruff"`
13. Any test asserting `type: "claude-md"` in artifact output

#### Update these tests:

- Tests that count total artifact count should be updated (one fewer artifact now)
- Tests that check `generateArtifacts()` output should not expect a `claude-md` artifact
- Tests that check `writeArtifacts()` with force flag should not reference CLAUDE.md preservation logic

#### Add these tests:

- `checkClaudeCli()` returns true when claude is available
- `checkClaudeCli()` returns false when claude is not available
- `parseArgs()` does NOT have a `static` property
- `getAnalysisPrompt()` returns a string containing the project name and tech stack context

#### After all test changes:

- All remaining tests must pass: `bun test`
- No test should reference `generateClaudeMd`, `getCommonCommands`, or `"claude-md"` artifact type

---

## Final Verification Checklist

After all changes, run and confirm:

```bash
# All pass
bun run check        # biome lint + format
bun test             # all tests green
bun run build        # tsup builds successfully
```

### Code audit:

- [ ] `generator.ts` has no `generateClaudeMd` function
- [ ] `generator.ts` has no `getCommonCommands` function
- [ ] `generator.ts` has no duplicate `formatLanguage` / `formatFramework`
- [ ] `generateArtifacts()` does NOT push a `claude-md` artifact
- [ ] `GeneratedArtifact.type` union does NOT include `"claude-md"`
- [ ] `cli.ts` has no `--static` flag, no `args.static`, no fallback logic
- [ ] `cli.ts` requires Claude CLI and exits if missing
- [ ] `cli.ts` always runs `runClaudeAnalysis()` for existing projects
- [ ] No unused imports in any file
- [ ] No unexported helper functions that are never called
- [ ] No unreachable code paths
- [ ] All tests pass and none reference removed functions or types
- [ ] `writeArtifacts()` preservation logic for `CLAUDE.md` path can be removed (Claude writes it directly now, not through `writeArtifacts`)

### Grep for ghosts:

```bash
# These should return ZERO results in src/ (excluding test files and this PROMPT.md):
grep -r "generateClaudeMd" src/
grep -r "getCommonCommands" src/
grep -r "claude-md" src/
grep -r "args.static" src/
grep -r "\-\-static" src/
```

---

## What NOT to Change

- `src/analyzer.ts` — keep entirely as-is, it's clean
- All skill generators — keep as-is
- All agent generators — keep as-is
- All rule generators — keep as-is
- All command generators — keep as-is
- `getSkillsForStack()`, `getAgentsForStack()` — keep (shared helpers, still used by skill/agent generation)
- `getLintCommand()`, `getTestCommand()` — keep (shared helpers, used by multiple generators)
- `writeArtifacts()` — keep (still used for supporting files), but review its `shouldPreserve` logic for the CLAUDE.md path since Claude now writes CLAUDE.md directly
- `PROMPT.md` itself — this is a dev-only file, not shipped to npm (`"files": ["dist"]`)
