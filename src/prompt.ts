/**
 * @module prompt
 * @description Claude-powered project analysis prompt.
 *
 * This module contains the comprehensive prompt that instructs Claude CLI
 * to deeply analyze a project and generate ALL .claude/ configuration files:
 * - CLAUDE.md — Project-specific instructions
 * - Skills — Methodology and framework-specific guides
 * - Agents — 6 agents (code-reviewer, test-writer, code-simplifier, explore, plan, docs-writer)
 * - Rules — Language-specific conventions
 * - Commands — 6 commands (/analyze, /code-review, /commit, /fix, /explain, /refactor)
 * - Memory — Initial memory seeds from project analysis
 *
 * The prompt is embedded as a string constant so it's bundled by tsup
 * and doesn't require a separate file at runtime.
 */

import type { ProjectInfo, TechStack } from "./types.js";

/**
 * Options controlling how CLAUDE.md is handled during generation
 */
export interface ClaudeMdPromptOptions {
  claudeMdMode: "keep" | "improve" | "replace";
  existingClaudeMd: string | null;
  noMemory?: boolean;
}

/**
 * Build the full analysis prompt with pre-detected tech stack context
 */
export function getAnalysisPrompt(
  projectInfo: ProjectInfo,
  options: ClaudeMdPromptOptions = { claudeMdMode: "replace", existingClaudeMd: null }
): string {
  const context = buildContextSection(projectInfo);
  const templateVars = buildTemplateVariables(projectInfo);
  const claudeMdInstructions = buildClaudeMdInstructions(options);

  const memorySection = options.noMemory ? "" : `\n\n${MEMORY_PROMPT}`;

  return `${ANALYSIS_PROMPT}

${SKILLS_PROMPT}

${AGENTS_PROMPT}

${RULES_PROMPT}

${COMMANDS_PROMPT}${memorySection}

---

## Pre-detected Context

The static analyzer has already detected the following about this project.
Use this as a starting point - verify and expand on it during your analysis.

${context}

### Template Variables (use these in generated files)

${templateVars}

${claudeMdInstructions}

---

## Execute Now

1. Read this entire prompt to understand all phases
2. Execute Phase 1 completely - read files, analyze code, gather all data
${options.claudeMdMode === "keep" ? `3. Skip CLAUDE.md generation — the existing file is being kept as-is` : options.claudeMdMode === "improve" ? `3. Execute Phase 2 — IMPROVE the existing CLAUDE.md (see Improvement Mode instructions above)` : `3. Execute Phase 2 - generate the CLAUDE.md (max 120 lines) using only discovered information`}
4. Execute Phase 3 - verify quality before writing
${options.claudeMdMode === "keep" ? `5. Skip writing CLAUDE.md — it is being preserved` : `5. Use the Write tool to create \`.claude/CLAUDE.md\` with the final content`}
6. Execute Phase 4 - generate ALL skill files (4 core + framework-specific if detected)
7. Execute Phase 5 - generate ALL agent files (6 agents)
8. Execute Phase 6 - generate rule files
9. Execute Phase 7 - generate ALL command files (6 commands)
${options.noMemory ? `10. Skip memory seeding (--no-memory flag)` : `10. Execute Phase 8 - seed initial memory files`}
11. Run the Anti-Redundancy Enforcement checks one final time across ALL generated files — if any convention is restated, any command is duplicated, or any rule lacks a \`paths:\` filter, fix it before proceeding
12. Output a brief summary of what was generated and any gaps found

Do NOT output file contents to stdout. Write all files to disk using the Write tool.
Generate ALL files in a single pass — do not stop after CLAUDE.md.`;
}

/**
 * Build CLAUDE.md mode-specific instructions
 */
function buildClaudeMdInstructions(options: ClaudeMdPromptOptions): string {
  if (options.claudeMdMode === "keep") {
    return `---

## CLAUDE.md Mode: KEEP

The user chose to keep their existing CLAUDE.md unchanged.
**Do NOT read, modify, or overwrite \`.claude/CLAUDE.md\`.**
Generate all other files (skills, agents, rules, commands) normally.
Use the existing CLAUDE.md as the source of truth for cross-references.`;
  }

  if (options.claudeMdMode === "improve" && options.existingClaudeMd) {
    return `---

## CLAUDE.md Mode: IMPROVE

The user has an existing CLAUDE.md and wants it improved, not replaced.
Here is the current content:

\`\`\`markdown
${options.existingClaudeMd}
\`\`\`

### Improvement Rules

1. **Preserve all manually-added content** — sections, notes, and custom rules the user wrote
2. **Enhance with discovered information** — fill gaps, add missing sections, improve specificity
3. **Fix generic content** — replace boilerplate with project-specific details found during Phase 1
4. **Update stale references** — fix file paths, commands, or patterns that no longer match the codebase
5. **Respect the 120-line cap** — if the file is already near the limit, prioritize density over additions
6. **Keep the user's structure** — if they organized sections differently from the template, keep their layout
7. **Do NOT remove content you don't understand** — if a section seems custom or domain-specific, preserve it`;
  }

  // Default: replace mode — no extra instructions needed
  return "";
}

function buildContextSection(projectInfo: ProjectInfo): string {
  const { name, description, techStack, fileCount } = projectInfo;
  const lines: string[] = [];

  lines.push(`- **Project Name**: ${name}`);
  if (description) {
    lines.push(`- **Description**: ${description}`);
  }
  lines.push(`- **Source Files**: ${fileCount}`);

  if (techStack.primaryLanguage) {
    lines.push(`- **Primary Language**: ${techStack.primaryLanguage}`);
  }
  if (techStack.languages.length > 1) {
    lines.push(
      `- **Other Languages**: ${techStack.languages.filter((l) => l !== techStack.primaryLanguage).join(", ")}`
    );
  }
  if (techStack.primaryFramework) {
    lines.push(`- **Primary Framework**: ${techStack.primaryFramework}`);
  }
  if (techStack.frameworks.length > 1) {
    lines.push(
      `- **Other Frameworks**: ${techStack.frameworks.filter((f) => f !== techStack.primaryFramework).join(", ")}`
    );
  }
  if (techStack.packageManager) {
    lines.push(`- **Package Manager**: ${techStack.packageManager}`);
  }
  if (techStack.testingFramework) {
    lines.push(`- **Testing Framework**: ${techStack.testingFramework}`);
  }
  if (techStack.linter) {
    lines.push(`- **Linter**: ${techStack.linter}`);
  }
  if (techStack.formatter) {
    lines.push(`- **Formatter**: ${techStack.formatter}`);
  }
  if (techStack.bundler) {
    lines.push(`- **Bundler**: ${techStack.bundler}`);
  }
  if (techStack.isMonorepo) {
    lines.push("- **Monorepo**: yes");
  }
  if (techStack.hasDocker) {
    lines.push("- **Docker**: yes");
  }
  if (techStack.hasCICD && techStack.cicdPlatform) {
    lines.push(`- **CI/CD**: ${techStack.cicdPlatform}`);
  }

  return lines.join("\n");
}

/**
 * Build template variables from detected tech stack for use in generated files.
 */
function buildTemplateVariables(projectInfo: ProjectInfo): string {
  const { techStack } = projectInfo;
  const vars: string[] = [];

  vars.push(`- **detected_languages**: ${techStack.languages.join(", ") || "none detected"}`);
  vars.push(`- **detected_frameworks**: ${techStack.frameworks.join(", ") || "none detected"}`);
  vars.push(`- **detected_testing_framework**: ${techStack.testingFramework || "none detected"}`);
  vars.push(`- **test_command**: ${getTestCommand(techStack)}`);
  vars.push(`- **lint_command**: ${getLintCommand(techStack)}`);
  vars.push(`- **detected_linter**: ${techStack.linter || "none detected"}`);
  vars.push(`- **detected_formatter**: ${techStack.formatter || "none detected"}`);
  vars.push(`- **source_glob_patterns**: ${getSourceGlobs(techStack)}`);

  return vars.join("\n");
}

/**
 * Determine the test command based on the detected stack.
 */
function getTestCommand(stack: TechStack): string {
  if (stack.testingFramework) {
    const commands: Record<string, string> = {
      jest: "npx jest",
      vitest: "npx vitest",
      "bun-test": "bun test",
      pytest: "pytest",
      "go-test": "go test ./...",
      "rust-test": "cargo test",
      rspec: "bundle exec rspec",
      junit: "mvn test",
      mocha: "npx mocha",
      playwright: "npx playwright test",
      cypress: "npx cypress run",
      unittest: "python -m unittest discover",
    };
    return commands[stack.testingFramework] || stack.testingFramework;
  }

  // Fallback by package manager
  if (stack.packageManager === "bun") return "bun test";
  if (stack.packageManager === "cargo") return "cargo test";
  if (stack.packageManager === "go") return "go test ./...";
  if (stack.packageManager) return `${stack.packageManager} test`;

  return "npm test";
}

/**
 * Determine the lint command based on the detected stack.
 */
function getLintCommand(stack: TechStack): string {
  if (stack.linter) {
    const commands: Record<string, string> = {
      eslint: "npx eslint .",
      biome: "npx biome check .",
      pylint: "pylint",
      flake8: "flake8",
      ruff: "ruff check .",
      "golangci-lint": "golangci-lint run",
      clippy: "cargo clippy",
      rubocop: "bundle exec rubocop",
    };
    return commands[stack.linter] || stack.linter;
  }

  return "no linter detected";
}

/**
 * Get source file glob patterns based on detected languages.
 */
function getSourceGlobs(stack: TechStack): string {
  const globs: string[] = [];

  for (const lang of stack.languages) {
    const langGlobs: Record<string, string[]> = {
      typescript: ["**/*.ts", "**/*.tsx"],
      javascript: ["**/*.js", "**/*.jsx"],
      python: ["**/*.py"],
      go: ["**/*.go"],
      rust: ["**/*.rs"],
      java: ["**/*.java"],
      ruby: ["**/*.rb"],
      csharp: ["**/*.cs"],
      swift: ["**/*.swift"],
      kotlin: ["**/*.kt", "**/*.kts"],
      php: ["**/*.php"],
      cpp: ["**/*.cpp", "**/*.hpp", "**/*.h"],
    };
    const patterns = langGlobs[lang];
    if (patterns) {
      globs.push(...patterns);
    }
  }

  return globs.length > 0 ? globs.join(", ") : "**/*";
}

// ============================================================================
// The Analysis Prompt — Phases 1-3 (embedded constant)
// ============================================================================

const ANALYSIS_PROMPT = `You are a senior software architect performing a comprehensive codebase analysis.
Your goal is to generate ALL \`.claude/\` configuration files that give Claude
complete context to work effectively in this project.

**This is NOT a generic template.** Every file must contain information specific to THIS
project, discovered through actual file reading and analysis. If you cannot determine
something, omit that section entirely - do not fill in generic boilerplate.

---

## Artifact Architecture

Understanding the context cost of each artifact type is critical. Artifacts load at different
frequencies, so place information where it costs the least while remaining accessible:

| Artifact | When Loaded | Context Cost |
|----------|-------------|--------------|
| CLAUDE.md | Every turn | Highest — keep concise |
| Rule without \`paths:\` | Every session | High — avoid generating these |
| Rule with \`paths:\` | When matching files are open | Medium — use sparingly |
| Skill / Command | On-demand (user invokes) | Low |
| Agent | Spawned in subprocess | Zero main-context cost |

### Placement Rules

1. **CLAUDE.md is the single source of truth for conventions.** All naming, style, commit format, and project rules live here and ONLY here.
2. **NEVER generate rules without \`paths:\` filters.** A rule without \`paths:\` loads every session and competes with CLAUDE.md for context. All general style information belongs in CLAUDE.md.
3. **Rules must be concise, non-redundant supplements.** A language rule (e.g., \`typescript.md\` with \`paths: ["**/*.ts"]\`) should ONLY contain language-specific gotchas (compiler flags, import quirks, tooling-specific settings) that don't belong in CLAUDE.md.
4. **Skills are for rich on-demand methodology.** Write "Follow conventions in CLAUDE.md" instead of restating conventions. Focus skills on HOW (methodology), not WHAT (conventions).
5. **Agents have zero main-context cost.** Put detailed checklists and review criteria in agent files — they run in subprocesses and don't consume the user's context window.
6. **Each piece of information must live in exactly ONE place.** If it's in CLAUDE.md, don't repeat it in rules, skills, or commands.

### Anti-Redundancy Enforcement

Before writing EACH artifact, apply these hard constraints:

- **REJECT** any artifact that restates a convention from CLAUDE.md. If a convention appears in CLAUDE.md, it MUST NOT appear in any other file. Not paraphrased, not summarized, not restated in different words.
- **Test commands, lint commands, and build commands** MUST appear in exactly ONE place: CLAUDE.md's Common Commands section. Skills and agents MUST write "See Common Commands in CLAUDE.md" instead.
- **All rules MUST have a \`paths:\` filter** — no unfiltered rules.
- **Cross-references replace copies** — write "Follow conventions in CLAUDE.md" instead of restating any convention.

#### Forbidden Duplication List

The following MUST NOT appear in skills, agents, rules, or commands — they belong exclusively in CLAUDE.md:
- Test commands (the literal test runner invocation)
- Lint commands (the literal linter invocation)
- Build commands (the literal build invocation)
- Import convention descriptions (absolute vs relative, ordering, type imports)
- Naming convention descriptions (camelCase, PascalCase, file naming)
- Commit format descriptions (conventional commits, message format)
- Anti-patterns list (things to avoid)
- Testing framework syntax examples (describe/it/expect — belongs in test-writer agent only)

---

## Phase 1: Discovery (Read Before You Write)

Perform these analysis steps IN ORDER. Do not skip any step. Do not start writing
any files until all discovery is complete.

### 1.1 Project Identity

- Read \`package.json\`, \`pyproject.toml\`, \`Cargo.toml\`, \`go.mod\`, \`Gemfile\`, or equivalent
- Extract: project name, version, description, author, license
- Read \`README.md\` if it exists - extract the project's purpose in one sentence
- Check for a \`docs/\` folder and scan for architecture docs

### 1.2 Directory Structure Map

- List the top-level directories and their purposes
- Identify the source code root (\`src/\`, \`lib/\`, \`app/\`, \`pkg/\`, etc.)
- Identify test directories (\`tests/\`, \`__tests__/\`, \`spec/\`, \`test/\`, etc.)
- Identify configuration directories (\`.github/\`, \`.vscode/\`, \`config/\`, etc.)
- Note any monorepo structure (\`packages/\`, \`apps/\`, \`services/\`)
- Map the directory tree to a max depth of 3 levels (excluding \`node_modules\`, \`.git\`, \`dist\`, \`build\`, \`__pycache__\`, \`.next\`, \`target\`)

### 1.3 Tech Stack Deep Scan

Go beyond just detecting names. For each technology found, note HOW it is used:

- **Languages**: Primary and secondary. Check config files for strictness settings
- **Frameworks**: Read the main entry point to confirm framework usage patterns
- **Package Manager**: Check lock files
- **Database**: Check for ORM configs, connection strings in env examples, database drivers
- **Authentication**: Look for auth libraries, auth middleware, session configs
- **API Layer**: REST routes, GraphQL schemas, tRPC routers, gRPC proto files
- **State Management**: Redux, Zustand, Pinia, Context API patterns
- **Styling**: CSS modules, Tailwind config, styled-components, Sass
- **Build Tools**: Check build configs
- **CI/CD**: Read workflow files
- **Infrastructure**: Docker, Terraform, Kubernetes manifests

### 1.4 Architecture Pattern Recognition

Read 5-10 key source files to identify:

- **Architecture Style**: MVC, Clean Architecture, Hexagonal, Microservices, Monolith, Serverless
- **Code Organization**: Feature-based, Layer-based, Domain-based
- **Dependency Injection**: How dependencies are wired
- **Data Flow**: How data moves through the application
- **Error Handling Pattern**: How errors are caught, transformed, and reported
- **API Pattern**: RESTful conventions, GraphQL resolvers, RPC style

### 1.5 Entry Points & Key Files

Identify and read these critical files:

- **Application Entry**: main.ts, index.ts, app.ts, server.ts, main.py, app.py, main.go, main.rs
- **Route/API Definitions**: Where routes/endpoints are registered
- **Configuration**: Environment loading, app config
- **Database Schema**: Models, migrations, schema definitions
- **Middleware Chain**: Authentication, logging, error handling
- **Type Definitions**: Shared types, interfaces, schemas
- **Constants**: Shared constants, status codes, error codes

### 1.6 Code Conventions (Read Actual Code)

Read at least 3-5 source files and document the ACTUAL patterns used:

- **Naming**: camelCase vs snake_case, file naming, component naming
- **Imports**: Absolute vs relative, import ordering, barrel exports
- **Exports**: Default vs named exports, re-export patterns
- **Function Style**: Arrow functions vs function declarations, async/await patterns
- **Error Handling**: try/catch style, Result types, error-first callbacks
- **Type Annotations**: Explicit vs inferred, interface vs type
- **File Structure**: How individual files are organized

### 1.7 Development Workflow

- **Scripts**: Read all scripts from package.json or equivalent
- **Environment Variables**: Read \`.env.example\`, \`.env.sample\`, or \`.env.template\` - list ALL required variables
- **Pre-commit Hooks**: Check \`.husky/\`, \`.lefthook.yml\`, lint-staged config
- **Code Quality**: Linter/formatter rules and config
- **Testing Setup**: Test config files, test utilities, fixtures, mocks
- **Database Operations**: Migrations, seed data, reset commands

### 1.8 Domain Knowledge

- **Business Entities**: Core domain objects (User, Order, Product, etc.)
- **Key Workflows**: Main user flows
- **External Integrations**: Third-party APIs, webhooks, payment gateways
- **Background Jobs**: Queue systems, cron jobs, scheduled tasks

---

## Phase 2: Generate the CLAUDE.md

Using ONLY information discovered in Phase 1, generate the \`.claude/CLAUDE.md\` file.
Every section must contain PROJECT-SPECIFIC content. Skip sections that don't apply.

**The CLAUDE.md MUST NOT exceed 120 lines. Prioritize density over completeness.**

Do NOT include sections that duplicate information available in package.json, tsconfig.json, or other config files the agent can read directly.

### Output Structure

The CLAUDE.md MUST follow this compact structure:

\`\`\`markdown
# {Project Name}

> {One-line description from README or package.json}

## Overview

{2-3 sentences: what this project does, who it's for, core value proposition.
Written for an AI assistant that needs to understand PURPOSE to make good decisions.}

## Architecture

{1-2 sentences describing the actual architecture pattern found, then the Key Files table.
Do NOT include a Directory Structure ASCII tree or Data Flow subsection — the agent can
read the filesystem directly.}

### Key Files

| File | Purpose |
|------|---------|
| \`path/to/file\` | What it does |

## Common Commands

\\\`\\\`\\\`bash
{5 critical commands max, from package.json scripts or equivalent.
Only the commands developers use daily — not every script.}
\\\`\\\`\\\`

## Code Conventions

### Naming

{ACTUAL naming patterns found — be brief}

### Patterns to Follow

{3-5 patterns with file references as examples}

### Anti-Patterns to Avoid

{What NOT to do based on codebase conventions}

> **This Code Conventions section is the single source of truth.**
> Rules and skills cross-reference this section — they do not repeat it.

## Testing

{2-3 lines: test command, test file location, key testing pattern.
NOT a full guide — the test-writer agent handles detailed test methodology.}

## Domain Knowledge

### Core Entities

{Brief list of main domain objects and relationships}

## Gotchas & Important Notes

{3-10 non-obvious things about this project that would trip up a newcomer}

## Rules

1. **Read before writing** - Understand existing patterns before adding code
2. **Match conventions** - Follow the patterns documented above
3. **Test everything** - Write tests, run existing tests after changes
4. {project-specific rules discovered during analysis}
\`\`\`

**Sections NOT to include** (the agent can read these from config files directly):
- Directory Structure ASCII tree (agent uses Glob/Read)
- Tech Stack table (available in package.json, tsconfig.json, etc.)
- Development Setup / Getting Started / Prerequisites
- Environment Variables table (available in .env.example)
- Skills index table
- Agents index table
- Key Workflows (duplicates Data Flow / Architecture)

---

## Phase 3: Quality Checklist

Before writing the CLAUDE.md, verify:

- [ ] The file does NOT exceed 120 lines
- [ ] Every section contains PROJECT-SPECIFIC information (not generic boilerplate)
- [ ] File paths referenced actually exist in the project
- [ ] File references use \`path/to/file.ts (functionName)\` format, not line numbers
- [ ] Commands listed are verified from package.json scripts or equivalent
- [ ] Code conventions were observed from ACTUAL source files
- [ ] The "Gotchas" section contains genuinely useful, non-obvious information
- [ ] An AI reading this CLAUDE.md could add a new feature following existing patterns
- [ ] Sections without real content have been omitted entirely
- [ ] No section duplicates information available in config files the agent can read

### Cross-Artifact Deduplication Check

Before writing ANY artifact (rule, skill, agent, command), verify:
- [ ] No conventions from CLAUDE.md are restated (naming, commit format, import order, style)
- [ ] No item from the Forbidden Duplication List appears outside CLAUDE.md
- [ ] No content from one artifact is duplicated in another
- [ ] Cross-references are used instead of copies (e.g., "Follow conventions in CLAUDE.md")
- [ ] Every rule file has a \`paths:\` filter — no unfiltered rules
- [ ] Single-language rules are justified (add genuine value beyond CLAUDE.md)

---

## Important Guidelines

1. **Be specific, not generic.** "Uses React with hooks" is useless. "Uses React 18 with Server Components via Next.js App Router, client components in src/components/client/ with 'use client' directive" is useful.

2. **Reference real files.** Every pattern should reference an actual file as an example. Use \`path/to/file.ts (functionName)\` format — NOT line numbers, which become stale as code changes.

3. **Prioritize actionable information.** Focus on what helps an AI write correct code: where to put new code, what patterns to follow, what to avoid, how to test.

4. **Skip empty sections.** Only include sections with real content.

5. **Keep it maintainable.** Don't include metrics that go stale quickly.

6. **Respect existing CLAUDE.md.** If one exists, read it first and preserve manually-added sections.`;

// ============================================================================
// Phase 4: Skills Generation Prompt
// ============================================================================

const SKILLS_PROMPT = `---

## Phase 4: Generate Skills

Write each skill file to \`.claude/skills/\` using the Write tool. Every skill must have
YAML frontmatter with \`name\`, \`description\`, and \`globs\` for auto-triggering when relevant files are open.

**Tailor ALL skills to this specific project** — use the actual file patterns and
conventions discovered during Phase 1.

### Skill Content Rules

1. **Cross-reference, don't copy** — write "Follow conventions in CLAUDE.md" instead of restating naming, style, or commit conventions. Skills focus on methodology (HOW to do something), not conventions (WHAT the conventions are).
2. **Use stable references** — reference code as \`path/to/file.ts (functionName)\`, not line numbers which become stale.
3. **No convention duplication** — if CLAUDE.md already documents commit format, import order, or naming rules, the skill must not repeat them.
4. **No command duplication** — for test, lint, and build commands, write "See Common Commands in CLAUDE.md" instead of repeating the literal command.

### 4.1 Core Skills (ALWAYS generate all 4)

**\`.claude/skills/iterative-development.md\`**
- Name: iterative-development
- Description: TDD workflow with debugging methodology and verification chain
- Content: The TDD loop referencing "See Common Commands in CLAUDE.md" for actual commands. Include the project's verification steps (typecheck, build, etc.). Add a Debugging section with: 4-phase methodology (Reproduce, Locate, Diagnose, Fix), project-specific file-to-module mapping for tracing bugs, how to use the project's logging/debugging setup. Add commit guidance: size thresholds (±300 lines per commit), when-to-commit triggers, "Follow commit conventions in CLAUDE.md" for format.

**\`.claude/skills/code-deduplication.md\`**
- Name: code-deduplication
- Description: Check-before-write principle, search checklist, and size limits
- Content: Search existing code before writing new code. Include project-specific glob patterns for source files. Reference the actual directory structure for where to look. Include a "Where to Look" checklist for discovering patterns in THIS project's structure (source directories, key file patterns). Add size limits: function length (40 lines), file length (300 lines), decomposition patterns appropriate for the project's architecture style.

**\`.claude/skills/security.md\`**
- Name: security
- Description: Security patterns and secrets management for this stack
- Content: .gitignore entries appropriate for the detected stack. Environment variable handling patterns. OWASP checklist items relevant to the detected framework. Include actual secrets patterns to watch for (API keys, database URLs, etc.).

**\`.claude/skills/testing-methodology.md\`**
- Name: testing-methodology
- Description: Test design methodology — what to test, edge cases, test organization
- Content: Focus on test DESIGN: what to test, how to identify edge cases, test organization strategy, when to use unit vs integration tests. Include project-specific test file naming and location conventions. Reference "See Common Commands in CLAUDE.md" for the test command. Do NOT include testing framework syntax examples (describe/it/expect, pytest fixtures, etc.) — those belong in the test-writer agent, not here. The \`testing-methodology\` skill focuses on test DESIGN (what to test, edge cases, test organization). The \`test-writer\` agent focuses on test EXECUTION (writing code, running tests). They must not overlap.

### 4.2 Framework-Specific Skills (ONLY if detected)

Generate the matching skill ONLY if the framework was detected in the tech stack:

- **Next.js detected** → Write \`.claude/skills/nextjs-patterns.md\` — App Router patterns, Server/Client Components, data fetching (fetch, server actions), middleware, image optimization, caching strategies. Use patterns from the actual codebase.

- **React (without Next.js) detected** → Write \`.claude/skills/react-components.md\` — Hooks patterns, component composition, state management (whatever is used), performance (memo, useMemo, useCallback), error boundaries.

- **FastAPI detected** → Write \`.claude/skills/fastapi-patterns.md\` — Router organization, dependency injection, Pydantic models, async/await patterns, middleware, exception handlers.

- **NestJS detected** → Write \`.claude/skills/nestjs-patterns.md\` — Module structure, controllers, services, decorators, pipes, guards, interceptors, custom providers.

- **SwiftUI detected** → Write \`.claude/skills/swiftui-patterns.md\` — Property wrappers (@State, @Binding, @StateObject, @EnvironmentObject), MVVM, navigation (NavigationStack/NavigationSplitView), previews, accessibility.

- **UIKit detected** → Write \`.claude/skills/uikit-patterns.md\` — View controller lifecycle, Auto Layout (programmatic and storyboard), delegates/datasources, MVC, coordinator pattern.

- **Vapor detected** → Write \`.claude/skills/vapor-patterns.md\` — Routes, middleware, Fluent ORM, async controllers, content negotiation, validation.

- **Jetpack Compose detected** → Write \`.claude/skills/compose-patterns.md\` — @Composable functions, remember/rememberSaveable, ViewModel integration, navigation, side effects (LaunchedEffect, DisposableEffect), theming.

- **Android Views detected** → Write \`.claude/skills/android-views-patterns.md\` — Activities, Fragments, XML layouts, ViewBinding, RecyclerView, lifecycle awareness.

- **Vue/Nuxt detected** → Write \`.claude/skills/vue-patterns.md\` — Composition API (ref, reactive, computed), composables, Pinia stores, routing, auto-imports.

- **Django detected** → Write \`.claude/skills/django-patterns.md\` — Models, views (class-based and function-based), serializers, middleware, admin customization, signals.

- **Rails detected** → Write \`.claude/skills/rails-patterns.md\` — MVC, ActiveRecord, concerns, service objects, jobs, mailers, strong parameters.

- **Spring detected** → Write \`.claude/skills/spring-patterns.md\` — Beans, controllers, services, repositories, AOP, dependency injection, configuration properties.

### 4.3 Project-Specific Skills (ONLY if detected)

Generate additional skills based on detected infrastructure:

- **Database/ORM detected** (Prisma, Drizzle, TypeORM, SQLAlchemy, Mongoose) → Write \`.claude/skills/database-patterns.md\` with globs targeting migration/schema files. Content: migration workflow, schema change process, query optimization patterns for the detected ORM, seed data conventions.

- **Docker detected** → Write \`.claude/skills/docker-patterns.md\` with globs: \`["**/Dockerfile*", "**/docker-compose*", "**/.dockerignore"]\`. Content: multi-stage build patterns, compose service definitions, volume mounting, health checks, image optimization.

- **Monorepo detected** → Write \`.claude/skills/monorepo-patterns.md\` with globs targeting workspace configs. Content: cross-package changes, shared dependency management, workspace protocol, package publishing order.

- **CI/CD detected** → Write \`.claude/skills/cicd-patterns.md\` with globs targeting workflow files. Content: workflow modification guidelines, secret handling, deployment patterns, caching strategies for the detected CI platform.

### 4.4 Skill Globs Reference

Every skill MUST include a \`globs\` field in its frontmatter for auto-triggering:

- \`iterative-development.md\` → omit globs (methodology, invoked manually)
- \`code-deduplication.md\` → omit globs (methodology, invoked manually)
- \`security.md\` → \`globs: ["**/.env*", "**/secrets/**", "**/auth/**", "**/middleware/**"]\`
- \`testing-methodology.md\` → \`globs: ["**/*.test.*", "**/*.spec.*", "**/tests/**", "**/test/**"]\`
- Framework skills → framework-specific globs (e.g., Next.js: \`["**/app/**", "**/pages/**", "next.config.*"]\`)`;

// ============================================================================
// Phase 5: Agents Generation Prompt
// ============================================================================

const AGENTS_PROMPT = `---

## Phase 5: Generate Agents

Write 6 agent files to \`.claude/agents/\`.

### \`.claude/agents/code-reviewer.md\`

YAML frontmatter:
\`\`\`yaml
---
name: code-reviewer
description: Reviews code for quality, security issues, and best practices
tools:
  - Read
  - Grep
  - Glob
  - "Bash({lint_command})"
disallowed_tools:
  - Write
  - Edit
model: sonnet
---
\`\`\`

Body content — instructions for the code reviewer agent:
- Check naming conventions match project patterns
- Verify error handling follows project style
- Look for security issues (injection, XSS, auth bypass, secrets exposure)
- Verify test coverage for changed code
- Check import organization
- Flag code duplication
- Use the project's actual linter for automated checks

### \`.claude/agents/test-writer.md\`

YAML frontmatter:
\`\`\`yaml
---
name: test-writer
description: Generates comprehensive tests for code
tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - "Bash({test_command})"
model: sonnet
---
\`\`\`

Body content — instructions for the test writer agent:
- Follow the AAA pattern (Arrange, Act, Assert)
- Use the project's actual testing framework and syntax
- Follow existing test file naming conventions
- Include edge cases: empty inputs, nulls, errors, boundaries
- Mock external dependencies following project patterns
- Run tests after writing to verify they pass
- Do NOT duplicate the testing-methodology skill content. The skill covers test design (what to test, edge cases, organization); this agent covers writing and running tests (framework syntax, assertions, execution).

### \`.claude/agents/code-simplifier.md\`

YAML frontmatter:
\`\`\`yaml
---
name: code-simplifier
description: Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality
tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - "Bash({lint_command})"
  - "Bash({test_command})"
model: sonnet
---
\`\`\`

Body content — instructions for the code simplifier agent:
- Focus on recently modified code (use \`git diff --name-only\` to identify changed files)
- Look for: duplicated logic, overly complex conditionals, dead code, inconsistent patterns
- Simplify without changing behavior — preserve ALL existing functionality
- Follow conventions in CLAUDE.md
- Specific simplifications: extract repeated code into helpers, flatten nested conditionals, remove unused variables/imports, replace verbose patterns with idiomatic equivalents
- Run the linter after modifications
- Run tests after modifications to verify nothing breaks
- Do NOT add features, refactor beyond the changed area, or make "improvements" beyond simplification

### \`.claude/agents/explore.md\`

YAML frontmatter:
\`\`\`yaml
---
name: explore
description: Fast codebase exploration — find files, search code, answer architecture questions
tools:
  - Read
  - Grep
  - Glob
disallowed_tools:
  - Write
  - Edit
  - Bash
model: haiku
---
\`\`\`

Body content — instructions for the explore agent:
- Use Glob for file pattern matching, Grep for content search, Read for file contents
- Answer questions about: where things are defined, how modules connect, what patterns are used
- Report findings in a structured format: file paths, relevant code snippets, relationships
- When asked "how does X work?": trace the code path from entry point to implementation
- When asked "where is X?": search broadly first (Glob for files, Grep for content), then narrow
- Never modify files — this agent is strictly read-only
- Be thorough but fast — use targeted searches, not exhaustive reads

### \`.claude/agents/plan.md\`

YAML frontmatter:
\`\`\`yaml
---
name: plan
description: Designs implementation plans with step-by-step approach and trade-off analysis
tools:
  - Read
  - Grep
  - Glob
disallowed_tools:
  - Write
  - Edit
  - Bash
model: sonnet
---
\`\`\`

Body content — instructions for the plan agent:
- Read relevant source files to understand current architecture
- Identify affected files, dependencies, and potential risks
- Produce a step-by-step plan with: files to create/modify, approach for each, testing strategy
- Consider trade-offs: complexity vs simplicity, performance vs readability
- Flag breaking changes or migration requirements
- Follow conventions in CLAUDE.md
- Output format: numbered steps, each with file path, action (create/modify/delete), and description
- Include a "Risks & Considerations" section at the end

### \`.claude/agents/docs-writer.md\`

YAML frontmatter:
\`\`\`yaml
---
name: docs-writer
description: Generates and updates documentation from code analysis
tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
disallowed_tools:
  - Bash
model: sonnet
---
\`\`\`

Body content — instructions for the docs writer agent:
- Analyze code changes (specified files or recent changes)
- Update relevant documentation: README, API docs, architecture docs, changelogs
- Generate JSDoc/docstrings for new public functions, classes, and interfaces
- Maintain consistency with existing documentation style
- Never fabricate information — only document what is verifiable from the code
- When updating existing docs, preserve the author's structure and voice
- For new documentation, follow the project's existing documentation patterns`;

// ============================================================================
// Phase 6: Rules Generation Prompt
// ============================================================================

const RULES_PROMPT = `---

## Phase 6: Generate Rules

Write rule files to \`.claude/rules/\`. Each rule file needs YAML frontmatter.

### Important: No Unfiltered Rules

Do NOT generate a \`code-style.md\` rule or any rule without a \`paths:\` filter. General style information (formatter, linter commands, comment style, error handling, commit conventions, import ordering) belongs in CLAUDE.md — not in a rule that loads every session and duplicates it.

NEVER generate rules without \`paths:\` filters. Every rule must target specific file types.

### Conditional Rules (generate ONLY if the language was detected):

**Constraints for all conditional rules:**
- Every rule MUST have a \`paths:\` filter targeting language-specific file extensions
- Keep rules concise: 5-15 lines of content maximum
- Rules must NOT repeat conventions already in CLAUDE.md (naming, style, commit format, import order)
- For single-language projects: only generate a language rule if it adds genuine value beyond CLAUDE.md (compiler flags, import quirks, tooling-specific gotchas)
- Focus on: compiler/interpreter settings, language-specific gotchas, tooling-specific configuration — not general naming or style

**TypeScript detected** → Write \`.claude/rules/typescript.md\`
\`\`\`yaml
---
paths: ["**/*.ts", "**/*.tsx"]
---
\`\`\`
Content: strict mode settings, type annotation preferences (interface vs type), import style (type imports), null handling, generic patterns found in the codebase.

**Python detected** → Write \`.claude/rules/python.md\`
\`\`\`yaml
---
paths: ["**/*.py"]
---
\`\`\`
Content: type hint style, docstring format (Google/NumPy/Sphinx), import ordering (isort), virtual environment conventions, Python version requirements.

**Swift detected** → Write \`.claude/rules/swift.md\`
\`\`\`yaml
---
paths: ["**/*.swift"]
---
\`\`\`
Content: access control patterns, optional handling, protocol-oriented patterns, SwiftLint rules if configured.

**Go detected** → Write \`.claude/rules/go.md\`
\`\`\`yaml
---
paths: ["**/*.go"]
---
\`\`\`
Content: error handling patterns (wrap errors), interface placement, package naming, go fmt/vet/lint conventions.

**Rust detected** → Write \`.claude/rules/rust.md\`
\`\`\`yaml
---
paths: ["**/*.rs"]
---
\`\`\`
Content: ownership/borrowing patterns, error handling (Result/Option, thiserror/anyhow), trait patterns, clippy lints.`;

// ============================================================================
// Phase 7: Commands Generation Prompt
// ============================================================================

const COMMANDS_PROMPT = `---

## Phase 7: Generate Commands

Write 6 command files to \`.claude/commands/\`. Each needs YAML frontmatter with
\`allowed-tools\`, \`description\`, and optionally \`argument-hint\`.

Do NOT generate task management commands (\`task.md\`, \`status.md\`, \`done.md\`) —
Claude Code has built-in TaskCreate/TaskUpdate/TaskList tools for task management.

### \`.claude/commands/analyze.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Glob", "Grep"]
description: "Deep analysis of a specific area"
argument-hint: "<area or file path>"
---
\`\`\`
Body: Perform thorough analysis of the specified area. Read relevant files,
trace data flow, identify patterns, document findings. Output a structured report.

### \`.claude/commands/code-review.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Glob", "Grep", "Bash(git diff)", "Bash(git diff --cached)", "Bash({lint_command})"]
description: "Review code changes for quality and security"
---
\`\`\`
Body: This command delegates to the code-reviewer agent for thorough review.
1. Run \`git diff\` and \`git diff --cached\` to identify staged and unstaged changes
2. Spawn the \`code-reviewer\` agent to perform the full review
3. If the agent is unavailable, perform a lightweight review: run the linter and check for obvious issues
Do NOT duplicate the code-reviewer agent's checklist here — the agent has the full review criteria.

### \`.claude/commands/commit.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Grep", "Glob", "Bash(git status)", "Bash(git diff)", "Bash(git diff --cached)", "Bash(git log --oneline -10)"]
description: "Generate a conventional commit message from staged changes"
---
\`\`\`
Body:
1. Run \`git diff --cached\` to see staged changes (if nothing staged, run \`git diff\` and suggest what to stage)
2. Run \`git log --oneline -10\` to match existing commit style
3. Analyze the nature of changes: feat, fix, refactor, chore, docs, test, style, perf, ci, build
4. Determine scope from the files changed (e.g., \`cli\`, \`analyzer\`, \`hooks\`)
5. Generate a conventional commit message: \`type(scope): subject\`
6. Include a body if changes are substantial (>50 lines changed)
7. Follow commit conventions in CLAUDE.md
8. Present the message for user review — do NOT run git commit

### \`.claude/commands/fix.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Grep", "Glob", "Write", "Edit", "Bash({test_command})", "Bash({lint_command})"]
description: "Diagnose and fix a failing test or error"
argument-hint: "<error message or test name>"
---
\`\`\`
Body:
1. If argument is a test name: run that specific test to reproduce the failure
2. If argument is an error message: search codebase for related code
3. Follow 4-phase debugging methodology:
   - **Reproduce**: Run the failing test/command to see the exact error
   - **Locate**: Trace the error from the failure point to the source
   - **Diagnose**: Understand WHY the code fails (not just WHERE)
   - **Fix**: Apply the minimal fix that resolves the root cause
4. Re-run the failing test to verify the fix
5. Run the full test suite to check for regressions (see Common Commands in CLAUDE.md)

### \`.claude/commands/explain.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Grep", "Glob"]
description: "Deep explanation of a file, module, or concept"
argument-hint: "<file path, module name, or concept>"
---
\`\`\`
Body:
1. Read the specified file or search for the module/concept
2. Trace dependencies (what it imports) and dependents (what imports it)
3. Explain in a structured format:
   - **Purpose**: What this code does and why it exists
   - **How It Works**: Step-by-step walkthrough of the logic
   - **Dependencies**: What it relies on (internal and external)
   - **Public API**: Exported functions, classes, types with brief descriptions
   - **Gotchas**: Non-obvious behavior, edge cases, known limitations
4. Use actual code references with file paths
5. Tailor the explanation depth to the complexity of the code

### \`.claude/commands/refactor.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Grep", "Glob", "Write", "Edit", "Bash({test_command})", "Bash({lint_command})"]
description: "Targeted refactoring of a specific area"
argument-hint: "<file path or description of what to refactor>"
---
\`\`\`
Body:
1. Read the target code and understand its current structure
2. Search for ALL references to affected functions/variables/types (Grep the entire project)
3. Plan the refactoring: what changes, what stays, what tests cover it
4. Apply changes incrementally:
   - Make the structural change
   - Update all references (imports, usages, tests, docs)
   - Run linter
   - Run tests
5. Verify no stale references remain (Grep for old names)
6. Follow conventions in CLAUDE.md`;

// ============================================================================
// Phase 8: Memory Bootstrapping Prompt
// ============================================================================

const MEMORY_PROMPT = `---

## Phase 8: Seed Initial Memory

Claude Code has a persistent memory system at \`.claude/memory/\`. Seed it with
factual information discovered during Phase 1 that would be useful in future conversations.

**Only write memories that cannot be easily derived from reading the code or CLAUDE.md.**

### Memory File Format

Each memory file uses this frontmatter format:
\`\`\`markdown
---
name: {memory name}
description: {one-line description}
type: {project | reference}
---

{memory content}
\`\`\`

### What to Seed

1. **Project memory** (type: \`project\`) — Write 1-2 files for:
   - Architecture pattern and rationale (e.g., "Clean Architecture with feature-based modules — chosen for testability and team scaling")
   - Primary domain and business context (e.g., "E-commerce platform for B2B wholesale — domain entities are Company, Order, Product, PriceList")

2. **Reference memory** (type: \`reference\`) — Write 1-2 files for:
   - CI/CD platform and deployment patterns (e.g., "GitHub Actions deploys to Vercel on push to main, preview deploys on PRs")
   - External system pointers found in README or config (e.g., "API docs at /docs/api.md, issue tracker is GitHub Issues")

### What NOT to Seed

- Anything already in CLAUDE.md (commands, conventions, file structure)
- Anything derivable from config files (package.json, tsconfig, etc.)
- Generic information (e.g., "this is a TypeScript project")
- Ephemeral state (current bugs, in-progress work)

### Where to Write

Write memory files to \`.claude/memory/\`:
- \`.claude/memory/architecture.md\`
- \`.claude/memory/domain.md\`
- \`.claude/memory/deployment.md\`
- \`.claude/memory/references.md\`

Only write files for which you have genuine, project-specific information.
Write a \`.claude/memory/MEMORY.md\` index file with one-line pointers to each memory file.

Skip this phase entirely if the project is too new or simple to have meaningful memory seeds.`;
