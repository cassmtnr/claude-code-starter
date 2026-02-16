/**
 * @module prompt
 * @description Claude-powered project analysis prompt.
 *
 * This module contains the comprehensive prompt that instructs Claude CLI
 * to deeply analyze a project and generate ALL .claude/ configuration files:
 * - CLAUDE.md — Project-specific instructions
 * - Skills — Methodology and framework-specific guides
 * - Agents — Code reviewer, test writer
 * - Rules — Language-specific conventions
 * - Commands — /task, /status, /done, /analyze, /code-review
 *
 * The prompt is embedded as a string constant so it's bundled by tsup
 * and doesn't require a separate file at runtime.
 */

import type { ProjectInfo, TechStack } from "./types.js";

/**
 * Build the full analysis prompt with pre-detected tech stack context
 */
export function getAnalysisPrompt(projectInfo: ProjectInfo): string {
  const context = buildContextSection(projectInfo);
  const templateVars = buildTemplateVariables(projectInfo);

  return `${ANALYSIS_PROMPT}

${SKILLS_PROMPT}

${AGENTS_PROMPT}

${RULES_PROMPT}

${COMMANDS_PROMPT}

---

## Pre-detected Context

The static analyzer has already detected the following about this project.
Use this as a starting point - verify and expand on it during your analysis.

${context}

### Template Variables (use these in generated files)

${templateVars}

---

## Execute Now

1. Read this entire prompt to understand all phases
2. Execute Phase 1 completely - read files, analyze code, gather all data
3. Execute Phase 2 - generate the CLAUDE.md using only discovered information
4. Execute Phase 3 - verify quality before writing
5. Use the Write tool to create \`.claude/CLAUDE.md\` with the final content
6. Execute Phase 4 - generate ALL skill files
7. Execute Phase 5 - generate agent files
8. Execute Phase 6 - generate rule files
9. Execute Phase 7 - generate command files
10. Output a brief summary of what was generated and any gaps found

Do NOT output file contents to stdout. Write all files to disk using the Write tool.
Generate ALL files in a single pass — do not stop after CLAUDE.md.`;
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

### Output Structure

The CLAUDE.md MUST follow this structure:

\`\`\`markdown
# {Project Name}

> {One-line description from README or package.json}

## Overview

{2-3 sentences: what this project does, who it's for, core value proposition.
Written for an AI assistant that needs to understand PURPOSE to make good decisions.}

## Architecture

{Describe the actual architecture pattern found}

### Directory Structure

\\\`\\\`\\\`
{Actual directory tree, depth 3, with annotations}
\\\`\\\`\\\`

### Data Flow

{How a typical request flows through the system}

### Key Files

| File | Purpose |
|------|---------|
| \`path/to/file\` | What it does |

## Tech Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Language | X | Config details |
| Framework | Y | How it's used |

## Development Setup

### Prerequisites

{Exact versions and tools needed}

### Getting Started

\\\`\\\`\\\`bash
{Actual commands to get running}
\\\`\\\`\\\`

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| \`VAR_NAME\` | What it's for | \`example_value\` |

## Common Commands

\\\`\\\`\\\`bash
{Actual commands from package.json scripts or equivalent}
\\\`\\\`\\\`

## Code Conventions

### Naming

{ACTUAL naming patterns found}

### Patterns to Follow

{3-5 patterns with file references as examples}

### Anti-Patterns to Avoid

{What NOT to do based on codebase conventions}

## Testing

### Running Tests

\\\`\\\`\\\`bash
{actual test commands}
\\\`\\\`\\\`

### Writing Tests

{Testing patterns, utilities, fixtures available}

## Domain Knowledge

### Core Entities

{Main domain objects and relationships}

### Key Workflows

{3-5 most important workflows}

## Gotchas & Important Notes

{3-10 non-obvious things about this project that would trip up a newcomer}

## Rules

1. **Read before writing** - Understand existing patterns before adding code
2. **Match conventions** - Follow the patterns documented above
3. **Test everything** - Write tests, run existing tests after changes
4. {project-specific rules discovered during analysis}
\`\`\`

---

## Phase 3: Quality Checklist

Before writing the CLAUDE.md, verify:

- [ ] Every section contains PROJECT-SPECIFIC information (not generic boilerplate)
- [ ] File paths referenced actually exist in the project
- [ ] Commands listed are verified from package.json scripts or equivalent
- [ ] Code conventions were observed from ACTUAL source files
- [ ] The "Gotchas" section contains genuinely useful, non-obvious information
- [ ] An AI reading this CLAUDE.md could add a new feature following existing patterns
- [ ] Sections without real content have been omitted entirely

---

## Important Guidelines

1. **Be specific, not generic.** "Uses React with hooks" is useless. "Uses React 18 with Server Components via Next.js App Router, client components in src/components/client/ with 'use client' directive" is useful.

2. **Reference real files.** Every pattern should reference an actual file as an example. Use \`path/to/file.ts:lineNumber\` format.

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
YAML frontmatter with \`name\`, \`description\`, and optionally \`globs\` for file matching.

**Tailor ALL skills to this specific project** — use the actual test command, lint command,
file patterns, and conventions discovered during Phase 1.

### 4.1 Core Skills (ALWAYS generate all 8)

**\`.claude/skills/pattern-discovery.md\`**
- Name: pattern-discovery
- Description: Analyze codebase to discover and document patterns
- Content: How to search for patterns in THIS project's structure. Include the actual source directories, key file patterns, and import conventions found.

**\`.claude/skills/systematic-debugging.md\`**
- Name: systematic-debugging
- Description: 4-phase debugging methodology — Reproduce, Locate, Diagnose, Fix
- Content: Tailor reproduction steps to the project's actual test runner and dev server commands. Include how to use the project's logging/debugging setup.

**\`.claude/skills/testing-methodology.md\`**
- Name: testing-methodology
- Description: AAA testing pattern with project-specific framework syntax
- Content: Use the project's actual testing framework syntax. Include real examples of test patterns found in the codebase (describe/it blocks, pytest fixtures, etc.). Reference the actual test command. Include mocking/stubbing patterns specific to the stack.

**\`.claude/skills/iterative-development.md\`**
- Name: iterative-development
- Description: TDD workflow with project-specific test and lint commands
- Content: The TDD loop using the actual test command and lint command. Include the project's verification steps (typecheck, build, etc.).

**\`.claude/skills/commit-hygiene.md\`**
- Name: commit-hygiene
- Description: Atomic commits, conventional format, size thresholds
- Content: Size thresholds (±300 lines per commit), when-to-commit triggers, conventional commit format. If the project uses commitlint or similar, reference its config.

**\`.claude/skills/code-deduplication.md\`**
- Name: code-deduplication
- Description: Check-before-write principle and search checklist
- Content: Search existing code before writing new code. Include project-specific glob patterns for source files. Reference the actual directory structure for where to look.

**\`.claude/skills/simplicity-rules.md\`**
- Name: simplicity-rules
- Description: Function and file size limits, decomposition patterns
- Content: Function length limits (40 lines), file limits (300 lines), cyclomatic complexity. Decomposition patterns appropriate for the project's architecture style.

**\`.claude/skills/security.md\`**
- Name: security
- Description: Security patterns and secrets management for this stack
- Content: .gitignore entries appropriate for the detected stack. Environment variable handling patterns. OWASP checklist items relevant to the detected framework. Include actual secrets patterns to watch for (API keys, database URLs, etc.).

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

- **Spring detected** → Write \`.claude/skills/spring-patterns.md\` — Beans, controllers, services, repositories, AOP, dependency injection, configuration properties.`;

// ============================================================================
// Phase 5: Agents Generation Prompt
// ============================================================================

const AGENTS_PROMPT = `---

## Phase 5: Generate Agents

Write 2 agent files to \`.claude/agents/\`.

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
- Run tests after writing to verify they pass`;

// ============================================================================
// Phase 6: Rules Generation Prompt
// ============================================================================

const RULES_PROMPT = `---

## Phase 6: Generate Rules

Write rule files to \`.claude/rules/\`. Each rule file needs YAML frontmatter.

### Always Generate:

**\`.claude/rules/code-style.md\`** (no \`paths\` — applies to all files)

Content based on what was discovered in Phase 1:
- Which formatter/linter to use and how (include actual commands)
- Comment style: "why" not "what", keep comments current
- Error handling patterns specific to this project
- Git commit message conventions (conventional commits if commitlint is configured)
- Import ordering conventions found in the codebase

### Conditional Rules (generate ONLY if the language was detected):

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

Write 5 command files to \`.claude/commands/\`. Each needs YAML frontmatter with
\`allowed-tools\`, \`description\`, and optionally \`argument-hint\`.

### \`.claude/commands/task.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Write", "Edit", "Glob"]
description: "Start or switch to a new task"
argument-hint: "<task description>"
---
\`\`\`
Body: Instructions to read current \`.claude/state/task.md\`, update status to "In Progress",
record the task description and timestamp. If starting a new task, archive the previous one.

### \`.claude/commands/status.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Glob", "Grep", "Bash(git status)", "Bash(git diff --stat)"]
description: "Show current task and session state"
---
\`\`\`
Body: Read \`.claude/state/task.md\`, show git status, list recently modified files,
summarize current state in a concise format.

### \`.claude/commands/done.md\`
\`\`\`yaml
---
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash(git:*)", "Bash({test_command})", "Bash({lint_command})"]
description: "Mark current task complete"
---
\`\`\`
Body: Run tests and lint checks. If they pass, update \`.claude/state/task.md\`
status to "Done". Show a summary of what was accomplished. Suggest next steps.

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
Body: Review staged and unstaged changes. Check for: naming consistency,
error handling, security issues, test coverage, import organization,
code duplication. Run the project's linter. Provide a summary with
severity levels (critical, warning, suggestion).`;
