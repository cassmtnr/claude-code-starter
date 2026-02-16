# Deep Codebase Analysis Prompt

Use this prompt to perform a comprehensive codebase analysis and generate the `.claude/CLAUDE.md` file.

---

You are a senior software architect performing a comprehensive codebase analysis.
Your goal is to generate a professional `.claude/CLAUDE.md` file that gives Claude
complete context to work effectively in this project.

**This is NOT a generic template.** Every section must contain information specific to THIS
project, discovered through actual file reading and analysis. If you cannot determine
something, omit that section entirely - do not fill in generic boilerplate.

---

## Phase 1: Discovery (Read Before You Write)

Perform these analysis steps IN ORDER. Do not skip any step. Do not start writing
the CLAUDE.md until all discovery is complete.

### 1.1 Project Identity

- Read `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Gemfile`, or equivalent
- Extract: project name, version, description, author, license
- Read `README.md` if it exists - extract the project's purpose in one sentence
- Check for a `docs/` folder and scan for architecture docs

### 1.2 Directory Structure Map

- List the top-level directories and their purposes
- Identify the source code root (`src/`, `lib/`, `app/`, `pkg/`, etc.)
- Identify test directories (`tests/`, `__tests__/`, `spec/`, `test/`, etc.)
- Identify configuration directories (`.github/`, `.vscode/`, `config/`, etc.)
- Note any monorepo structure (`packages/`, `apps/`, `services/`)
- Map the directory tree to a max depth of 3 levels (excluding `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `.next`, `target`)

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
- **Environment Variables**: Read `.env.example`, `.env.sample`, or `.env.template` - list ALL required variables
- **Pre-commit Hooks**: Check `.husky/`, `.lefthook.yml`, lint-staged config
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

Using ONLY information discovered in Phase 1, generate the `.claude/CLAUDE.md` file.
Every section must contain PROJECT-SPECIFIC content. Skip sections that don't apply.

### Output Structure

The CLAUDE.md MUST follow this structure:

```markdown
# {Project Name}

> {One-line description from README or package.json}

## Overview

{2-3 sentences: what this project does, who it's for, core value proposition.
Written for an AI assistant that needs to understand PURPOSE to make good decisions.}

## Architecture

{Describe the actual architecture pattern found}

### Directory Structure

\`\`\`
{Actual directory tree, depth 3, with annotations}
\`\`\`

### Data Flow

{How a typical request flows through the system}

### Key Files

| File | Purpose |
|------|---------|
| `path/to/file` | What it does |

## Tech Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Language | X | Config details |
| Framework | Y | How it's used |

## Development Setup

### Prerequisites

{Exact versions and tools needed}

### Getting Started

\`\`\`bash
{Actual commands to get running}
\`\`\`

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VAR_NAME` | What it's for | `example_value` |

## Common Commands

\`\`\`bash
{Actual commands from package.json scripts or equivalent}
\`\`\`

## Code Conventions

### Naming

{ACTUAL naming patterns found}

### Patterns to Follow

{3-5 patterns with file references as examples}

### Anti-Patterns to Avoid

{What NOT to do based on codebase conventions}

## Testing

### Running Tests

\`\`\`bash
{actual test commands}
\`\`\`

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
```

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

2. **Reference real files.** Every pattern should reference an actual file as an example. Use `path/to/file.ts:lineNumber` format.

3. **Prioritize actionable information.** Focus on what helps an AI write correct code: where to put new code, what patterns to follow, what to avoid, how to test.

4. **Skip empty sections.** Only include sections with real content.

5. **Keep it maintainable.** Don't include metrics that go stale quickly.

6. **Respect existing CLAUDE.md.** If one exists, read it first and preserve manually-added sections.
