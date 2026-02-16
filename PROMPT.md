# Overhaul: claude-code-starter

## Objective

Perform a complete overhaul of `claude-code-starter` so that Claude generates all content files (CLAUDE.md, skills, agents, rules, commands) instead of hardcoded TypeScript templates. The tool must work as both an npm CLI package and a skills.sh Claude Code skill.

## Context

`claude-code-starter` is a TypeScript CLI tool that analyzes a project's tech stack and generates Claude Code configuration files. It ALWAYS runs with Claude Code — either as `npx claude-code-starter` (spawns `claude -p`) or as a Claude Code skill (`/claude-code-starter` via skills.sh).

**The problem:** `src/generator.ts` is ~3050 lines of hardcoded markdown templates — React patterns, FastAPI patterns, SwiftUI patterns, debugging guides, etc. Claude already knows all of this better than any static template. These templates are generic boilerplate. Claude can generate the same content but TAILORED to the actual project.

**The fix:** Gut `generator.ts` down to ~200 lines (only `settings.json` generation + directory creation). Expand `prompt.ts` so one Claude spawn generates EVERYTHING. Add a `SKILL.md` for skills.sh distribution. Expand the new-project questionnaire.

### Source Files

Read every source file before making any changes:

- `src/types.ts` (~260 lines) — Type definitions
- `src/analyzer.ts` (~810 lines) — Tech stack detection
- `src/generator.ts` (~3050 lines) — THE PROBLEM: hardcoded templates
- `src/prompt.ts` (~350 lines) — Analysis prompt for CLAUDE.md only
- `src/cli.ts` (~592 lines) — CLI orchestration
- `src/cli.test.ts` — Unit tests
- `src/cli.e2e.test.ts` — E2E tests
- `package.json` — npm package configuration
- `tsup.config.ts` — Build configuration

---

## Requirements

### Requirement 1: Dual Distribution (npm package + skills.sh skill)

The tool must work in TWO distribution modes:

**Mode A: npm package (CLI)** — Existing mode. Users run:
```bash
npx claude-code-starter          # one-shot via npx
npm install -g claude-code-starter && claude-code-starter  # global install
```

Works by: running as a Node.js CLI → parsing args → detecting tech stack → spawning `claude -p` with the analysis prompt piped via stdin → Claude generates all `.claude/` content files.

The `package.json` already has the correct `"bin"` and `"files"` fields. Keep as-is:
```json
{
  "bin": { "claude-code-starter": "./dist/cli.js" },
  "files": ["dist"]
}
```

**Mode B: skills.sh skill (Claude Code `/command`)** — New mode. Users install:
```bash
npx skills add cassmtnr/claude-code-starter
```
Then invoke inside Claude Code as `/claude-code-starter`.

This requires a `SKILL.md` file at the repository root with YAML frontmatter for routing and a markdown body for instructions. When used as a skill, Claude itself is the runtime — no subprocess spawning needed.

Create `SKILL.md` at the repository root with:
- YAML frontmatter: `name: claude-code-starter`, `description:` a routing rule that describes when to invoke this skill (analyze a project and generate Claude Code configuration)
- Markdown body: complete instructions for Claude to detect project type (new vs existing), run the appropriate flow (questionnaire vs analysis), and generate ALL `.claude/` files

The SKILL.md body must contain the SAME file generation instructions as the expanded `src/prompt.ts` — both paths must produce the same output.

---

### Requirement 2: Gut `src/generator.ts` (from ~3050 to ~200 lines)

**KEEP these functions:**

1. `generateSettings(stack: TechStack)` (currently lines ~116-204) — Builds `settings.json` with permission patterns per language/framework/tool. This MUST stay deterministic in code. Change return type from `GeneratedArtifact` to `{ path: string; content: string }`.

2. File-writing utility (currently `writeArtifacts()` at lines ~72-110) — Simplify to only write `settings.json` and create directories.

**ADD these functions:**

3. `ensureDirectories(rootDir: string): void` — Creates:
   ```
   .claude/
   .claude/skills/
   .claude/agents/
   .claude/rules/
   .claude/commands/
   .claude/state/
   ```
   Use `fs.mkdirSync(dir, { recursive: true })`.

4. `writeSettings(rootDir: string, stack: TechStack): void` — Calls `generateSettings()` and writes to `.claude/settings.json`.

**DELETE every other function** — all template generators:

Skills: `generateSkills()`, `generatePatternDiscoverySkill()`, `generateSystematicDebuggingSkill()`, `generateTestingMethodologySkill()`, `generateIterativeDevelopmentSkill()`, `generateCommitHygieneSkill()`, `generateCodeDeduplicationSkill()`, `generateSimplicityRulesSkill()`, `generateSecuritySkill()`, `generateNextJsSkill()`, `generateReactSkill()`, `generateFastAPISkill()`, `generateNestJSSkill()`, `generateSwiftUISkill()`, `generateUIKitSkill()`, `generateVaporSkill()`, `generateJetpackComposeSkill()`, `generateAndroidViewsSkill()`

Agents: `generateAgents()`, `generateCodeReviewerAgent()`, `generateTestWriterAgent()`

Rules: `generateRules()`, `generateTypeScriptRules()`, `generatePythonRules()`, `generateCodeStyleRule()`

Commands: `generateCommands()`, `generateTaskCommand()`, `generateStatusCommand()`, `generateDoneCommand()`, `generateAnalyzeCommand()`, `generateCodeReviewCommand()`

Helpers: `generateArtifacts()`, `getTestingExamples()`, `getLintCommand()`, `getTestCommand()`

---

### Requirement 3: Expand `src/prompt.ts` (from ~350 to ~600 lines)

The current prompt only instructs Claude to generate `.claude/CLAUDE.md`. Expand it so Claude generates ALL files in a single pass.

**Keep the existing structure:** `getAnalysisPrompt(projectInfo)`, `buildContextSection(projectInfo)`, the entire `ANALYSIS_PROMPT` constant (Phases 1-3).

**Add new phases AFTER Phase 3:**

**Phase 4: Generate Skills** — Instruct Claude to create each skill file with YAML frontmatter (name, description, globs) and project-tailored content.

8 core skills (ALWAYS generate):
- `.claude/skills/pattern-discovery.md` — Analyze codebase to discover and document patterns
- `.claude/skills/systematic-debugging.md` — 4-phase methodology: Reproduce, Locate, Diagnose, Fix
- `.claude/skills/testing-methodology.md` — AAA pattern, project's actual testing framework syntax, mocking guidelines
- `.claude/skills/iterative-development.md` — TDD workflow with actual test and lint commands
- `.claude/skills/commit-hygiene.md` — Size thresholds, when-to-commit triggers, atomic commit patterns
- `.claude/skills/code-deduplication.md` — Check-before-write principle, search checklist
- `.claude/skills/simplicity-rules.md` — Function/file limits, decomposition patterns
- `.claude/skills/security.md` — .gitignore entries, env variable handling tailored to stack, OWASP checklist

Framework-specific skills (ONLY if detected):
- Next.js → `.claude/skills/nextjs-patterns.md`
- React (without Next.js) → `.claude/skills/react-components.md`
- FastAPI → `.claude/skills/fastapi-patterns.md`
- NestJS → `.claude/skills/nestjs-patterns.md`
- SwiftUI → `.claude/skills/swiftui-patterns.md`
- UIKit → `.claude/skills/uikit-patterns.md`
- Vapor → `.claude/skills/vapor-patterns.md`
- Jetpack Compose → `.claude/skills/compose-patterns.md`
- Android Views → `.claude/skills/android-views-patterns.md`
- Vue/Nuxt → `.claude/skills/vue-patterns.md`
- Django → `.claude/skills/django-patterns.md`
- Rails → `.claude/skills/rails-patterns.md`
- Spring → `.claude/skills/spring-patterns.md`

**Phase 5: Generate Agents** (2):
- `.claude/agents/code-reviewer.md` — tools: Read, Grep, Glob, Bash(lint), disallowed: Write, Edit, model: sonnet
- `.claude/agents/test-writer.md` — tools: Read, Grep, Glob, Write, Edit, Bash(test), model: sonnet

**Phase 6: Generate Rules:**
- Always: `.claude/rules/code-style.md`
- If TypeScript: `.claude/rules/typescript.md` with paths `["**/*.ts", "**/*.tsx"]`
- If Python: `.claude/rules/python.md` with paths `["**/*.py"]`
- If Swift: `.claude/rules/swift.md` with paths `["**/*.swift"]`
- If Go: `.claude/rules/go.md` with paths `["**/*.go"]`
- If Rust: `.claude/rules/rust.md` with paths `["**/*.rs"]`

**Phase 7: Generate Commands** (5):
- `.claude/commands/task.md` — Start or switch to a new task
- `.claude/commands/status.md` — Show current task state
- `.claude/commands/done.md` — Mark task complete, run final checks
- `.claude/commands/analyze.md` — Deep analysis of a specific area
- `.claude/commands/code-review.md` — Review code changes

Each command needs YAML frontmatter with `allowed-tools`, `description`, and optionally `argument-hint`.

**Update the "Execute Now" section** to instruct Claude to write ALL files (not just CLAUDE.md).

**Add template variables** interpolated from detected tech stack: `{detected_testing_framework}`, `{test_command}`, `{lint_command}`, `{detected_formatter}`, `{detected_linter}`, `{detected_languages}`, `{detected_frameworks}`, `{source_glob_patterns}`. Build these in `buildContextSection()` or a new helper.

---

### Requirement 4: Update `src/cli.ts` — New orchestration flow

**Change main() flow from:**
```typescript
const result = generateArtifacts(projectInfo);            // generates ~20 template files
const { created, updated } = writeArtifacts(...);         // writes them all
createTaskFile(projectInfo, preferences);                  // state/task.md
const success = await runClaudeAnalysis(projectDir, ...); // Claude writes only CLAUDE.md
```

**To:**
```typescript
writeSettings(projectDir, projectInfo.techStack);          // writes only settings.json
ensureDirectories(projectDir);                             // creates .claude/ subdirs
createTaskFile(projectInfo, preferences);                  // state/task.md
const success = await runClaudeAnalysis(projectDir, ...); // Claude writes EVERYTHING
```

**Update imports** from `import { generateArtifacts, writeArtifacts }` to `import { writeSettings, ensureDirectories }`.

**Fix Claude CLI spawn** — pipe prompt via stdin, use repeated `--allowedTools` flags:
```typescript
const child = spawn(
  "claude",
  [
    "-p",
    "--dangerously-skip-permissions",
    "--allowedTools", "Read",
    "--allowedTools", "Glob",
    "--allowedTools", "Grep",
    "--allowedTools", "Write",
    "--allowedTools", "Edit",
  ],
  {
    cwd: projectDir,
    stdio: ["pipe", "inherit", "inherit"],
  }
);
child.stdin.write(prompt);
child.stdin.end();
```

**Update summary output** — after Claude completes, verify which files were actually created by checking the filesystem.

**Update `showBanner`** — change "generate a comprehensive CLAUDE.md" to "generate all .claude/ configuration files".

---

### Requirement 5: Expand new-project questionnaire in `src/cli.ts`

When the project is new/empty (`projectInfo.isExisting === false` or `projectInfo.fileCount < 3`), present an interactive questionnaire using the `prompts` library (already a dependency):

1. **Project description** — free text, required
2. **Primary language** — TypeScript, JavaScript, Python, Go, Rust, Swift, Kotlin, Java, Ruby, C#, PHP, C++
3. **Framework** — choices filtered by selected language:
   - TS/JS: Next.js, React, Vue, Svelte, Express, NestJS, Fastify, Hono, Astro, None
   - Python: FastAPI, Django, Flask, None
   - Go: Gin, Echo, Fiber, None
   - Swift: SwiftUI, UIKit, Vapor, None
   - Kotlin: Jetpack Compose, Android Views, Spring, None
   - Java: Spring, Quarkus, None
   - Ruby: Rails, Sinatra, None
   - Rust: Actix, Axum, Rocket, None
   - Others: None
4. **Package manager** — filtered by language
5. **Testing framework** — filtered by language, include "None / I'll set it up later"
6. **Linter/Formatter** — filtered by language, include "None"
7. **Project type** — Web App, API/Backend, CLI Tool, Library/Package, Mobile App, Desktop App, Monorepo, Other

Pass answers to the prompt via `buildContextSection()` or a new function.

**Expand `NewProjectPreferences` in `src/types.ts`** to also store:
- `packageManager: PackageManager | null`
- `testingFramework: TestingFramework | null`
- `linter: Linter | null`
- `formatter: Formatter | null`
- `projectType: string`

---

### Requirement 6: Simplify `src/types.ts`

**DELETE:** `GeneratedArtifact`, `GenerationResult` (no longer used after gutting generator.ts)

**KEEP:** `Args`, `TechStack`, `Language`, `Framework`, `PackageManager`, `TestingFramework`, `Linter`, `Formatter`, `Bundler`, `CICDPlatform`, `ProjectInfo`, `NewProjectPreferences`

**EXPAND:** `NewProjectPreferences` as described in Requirement 5.

---

### Requirement 7: Keep `src/analyzer.ts` unchanged

The analyzer provides: quick CLI feedback, pre-detected context for Claude, tech stack data for `settings.json` generation. No changes needed.

---

### Requirement 8: Update tests

**`src/cli.test.ts`:**
- DELETE tests for removed functions (`generateArtifacts()`, individual template generators, template content verification)
- UPDATE tests for `writeSettings()`, `ensureDirectories()`, new CLI flow
- KEEP tests for `parseArgs()`, `getVersion()`, `showHelp()`, `showBanner()`, `showTechStack()`, `formatLanguage()`, `formatFramework()`, `checkClaudeCli()`, `createTaskFile()`, all analyzer tests
- ADD tests: `getAnalysisPrompt()` includes skills/agents/rules/commands instructions; prompt includes correct test/lint commands; prompt includes framework-specific skills conditionally

**`src/cli.e2e.test.ts`:**
- Update expectations to match new flow (CLI writes only `settings.json` + directories, Claude generates everything else)

---

## Constraints

- All code must pass `bun run check` (biome lint + format)
- All tests must pass with `bun test`
- Build must succeed with `bun run build`
- No dead code or unused imports
- `generator.ts` must be under 250 lines
- `generator.ts` must have ZERO hardcoded markdown template strings
- `SKILL.md` must be under 500 lines per skills.sh convention
- Do not modify `src/analyzer.ts`

---

## Success Criteria

- [ ] CHECKPOINT_1: `SKILL.md` exists at repository root with correct YAML frontmatter and comprehensive instructions
- [ ] CHECKPOINT_2: `src/types.ts` simplified (no `GeneratedArtifact`/`GenerationResult`, expanded `NewProjectPreferences`)
- [ ] CHECKPOINT_3: `src/generator.ts` gutted to under 250 lines with ONLY `generateSettings()`, `writeSettings()`, `ensureDirectories()`
- [ ] CHECKPOINT_4: `src/prompt.ts` expanded with Phases 4-7, template variables, framework-conditional skill instructions
- [ ] CHECKPOINT_5: `src/cli.ts` updated flow (writeSettings -> ensureDirectories -> createTaskFile -> runClaudeAnalysis)
- [ ] CHECKPOINT_6: `src/cli.ts` has expanded new-project questionnaire (7 questions, filtered choices)
- [ ] CHECKPOINT_7: `src/cli.ts` spawns Claude correctly (piped stdin, repeated --allowedTools)
- [ ] CHECKPOINT_8: Tests updated — old template tests removed, new prompt/flow tests added
- [ ] CHECKPOINT_9: `bun run check` passes
- [ ] CHECKPOINT_10: `bun test` passes
- [ ] CHECKPOINT_11: `bun run build` succeeds
- [ ] All criteria verified

## Progress Log

- [ ] Step 1: Read all source files
- [ ] Step 2: Create SKILL.md
- [ ] Step 3: Simplify src/types.ts
- [ ] Step 4: Gut src/generator.ts
- [ ] Step 5: Expand src/prompt.ts
- [ ] Step 6: Update src/cli.ts
- [ ] Step 7: Update tests
- [ ] Step 8: Run bun run check and fix issues
- [ ] Step 9: Run bun test and fix failures
- [ ] Step 10: Run bun run build and verify

## Current Status

Working on: Not started
Completed: None
Next: Step 1

---

The orchestrator will continue iterations until all success criteria are met or limits are reached.
