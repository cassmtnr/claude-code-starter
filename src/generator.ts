/**
 * @module generator
 * @description Dynamic artifact generation for Claude Code configurations.
 *
 * This module generates tailored Claude Code artifacts based on detected tech stack:
 * - CLAUDE.md - Project-specific instructions
 * - settings.json - Permissions configuration
 * - Skills - Methodology guides + framework-specific patterns
 * - Agents - Code reviewer, test writer
 * - Rules - Language conventions (TypeScript, Python)
 * - Commands - /task, /status, /done, /analyze
 *
 * All content is generated dynamically (no static templates) to provide
 * configurations that are relevant to the specific project's stack.
 *
 * @example
 * import { generateArtifacts, writeArtifacts } from './generator.js';
 *
 * const result = generateArtifacts(projectInfo);
 * writeArtifacts(result.artifacts, '/path/to/project', false);
 */

import fs from "node:fs";
import path from "node:path";
import type {
  Framework,
  GeneratedArtifact,
  GenerationResult,
  Language,
  ProjectInfo,
  TechStack,
} from "./types.js";

// ============================================================================
// Artifact Generator
// ============================================================================

/**
 * Generate all Claude Code artifacts based on project analysis
 */
export function generateArtifacts(projectInfo: ProjectInfo): GenerationResult {
  const artifacts: GeneratedArtifact[] = [];
  const { techStack, rootDir } = projectInfo;

  // Generate CLAUDE.md
  artifacts.push(generateClaudeMd(projectInfo));

  // Generate settings.json
  artifacts.push(generateSettings(techStack));

  // Generate skills based on tech stack
  artifacts.push(...generateSkills(techStack));

  // Generate agents based on tech stack
  artifacts.push(...generateAgents(techStack));

  // Generate rules based on tech stack
  artifacts.push(...generateRules(techStack));

  // Generate commands (universal)
  artifacts.push(...generateCommands());

  // Check which files already exist
  for (const artifact of artifacts) {
    const fullPath = path.join(rootDir, artifact.path);
    artifact.isNew = !fs.existsSync(fullPath);
  }

  // Calculate summary
  const summary = {
    created: artifacts.filter((a) => a.isNew).length,
    updated: artifacts.filter((a) => !a.isNew).length,
    skipped: 0,
  };

  return { artifacts, summary };
}

/**
 * Write artifacts to disk with merge strategy
 */
export function writeArtifacts(
  artifacts: GeneratedArtifact[],
  rootDir: string,
  force: boolean
): { created: string[]; updated: string[]; skipped: string[] } {
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const artifact of artifacts) {
    const fullPath = path.join(rootDir, artifact.path);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true });

    const exists = fs.existsSync(fullPath);

    if (exists && !force) {
      // Check if it's a file we should always update vs preserve
      const shouldPreserve =
        artifact.path.includes("state/task.md") || artifact.path === ".claude/CLAUDE.md";

      if (shouldPreserve) {
        skipped.push(artifact.path);
        continue;
      }
    }

    fs.writeFileSync(fullPath, artifact.content);

    if (exists) {
      updated.push(artifact.path);
    } else {
      created.push(artifact.path);
    }
  }

  return { created, updated, skipped };
}

// ============================================================================
// CLAUDE.md Generator
// ============================================================================

function generateClaudeMd(projectInfo: ProjectInfo): GeneratedArtifact {
  const { techStack, name, description } = projectInfo;

  const sections: string[] = [];

  // Header
  sections.push(`# ${name}`);
  sections.push("");

  if (description) {
    sections.push(`> ${description}`);
    sections.push("");
  }

  // Quick Start
  sections.push("## Start Here");
  sections.push("");
  sections.push("Check `.claude/state/task.md` for your current task.");
  sections.push("");

  // Tech Stack Summary
  sections.push("## Tech Stack");
  sections.push("");
  if (techStack.primaryLanguage) {
    sections.push(`- **Language**: ${formatLanguage(techStack.primaryLanguage)}`);
  }
  if (techStack.primaryFramework) {
    sections.push(`- **Framework**: ${formatFramework(techStack.primaryFramework)}`);
  }
  if (techStack.packageManager) {
    sections.push(`- **Package Manager**: ${techStack.packageManager}`);
  }
  if (techStack.testingFramework) {
    sections.push(`- **Testing**: ${techStack.testingFramework}`);
  }
  if (techStack.linter) {
    sections.push(`- **Linter**: ${techStack.linter}`);
  }
  sections.push("");

  // Commands
  sections.push("## Commands");
  sections.push("");
  sections.push("| Command | Purpose |");
  sections.push("|---------|---------|");
  sections.push("| `/task <desc>` | Start or switch to a new task |");
  sections.push("| `/status` | Show current task state |");
  sections.push("| `/done` | Mark current task complete |");
  sections.push("| `/analyze <area>` | Deep-dive into specific code |");
  sections.push("");

  // Common Commands based on tech stack
  sections.push("## Common Operations");
  sections.push("");
  sections.push("```bash");
  sections.push(getCommonCommands(techStack));
  sections.push("```");
  sections.push("");

  // Project Rules
  sections.push("## Rules");
  sections.push("");
  sections.push("1. **State First** - Always read `.claude/state/task.md` when resuming");
  sections.push("2. **One Task** - Focus on one thing at a time");
  sections.push("3. **Test Before Done** - Run tests before marking complete");
  sections.push("4. **Update State** - Keep task.md current as you work");
  sections.push("5. **Match Patterns** - Follow existing code conventions");
  sections.push("");

  // Skills reference
  sections.push("## Skills");
  sections.push("");
  sections.push("Reference these for specialized workflows:");
  const skills = getSkillsForStack(techStack);
  for (const skill of skills) {
    sections.push(`- \`.claude/skills/${skill.name}.md\` - ${skill.description}`);
  }
  sections.push("");

  // Agents reference
  const agents = getAgentsForStack(techStack);
  if (agents.length > 0) {
    sections.push("## Agents");
    sections.push("");
    sections.push("Specialized agents available:");
    for (const agent of agents) {
      sections.push(`- \`${agent.name}\` - ${agent.description}`);
    }
    sections.push("");
  }

  // File References
  sections.push("## File References");
  sections.push("");
  sections.push("Use `path/to/file.ts:123` format when referencing code.");
  sections.push("");

  return {
    type: "claude-md",
    path: ".claude/CLAUDE.md",
    content: sections.join("\n"),
    isNew: true,
  };
}

function getCommonCommands(stack: TechStack): string {
  const commands: string[] = [];

  // Package manager commands
  switch (stack.packageManager) {
    case "bun":
      commands.push("# Install dependencies");
      commands.push("bun install");
      commands.push("");
      commands.push("# Run development server");
      commands.push("bun dev");
      commands.push("");
      commands.push("# Run tests");
      commands.push("bun test");
      commands.push("");
      commands.push("# Build");
      commands.push("bun run build");
      break;
    case "pnpm":
      commands.push("# Install dependencies");
      commands.push("pnpm install");
      commands.push("");
      commands.push("# Run development server");
      commands.push("pnpm dev");
      commands.push("");
      commands.push("# Run tests");
      commands.push("pnpm test");
      break;
    case "yarn":
      commands.push("# Install dependencies");
      commands.push("yarn");
      commands.push("");
      commands.push("# Run development server");
      commands.push("yarn dev");
      commands.push("");
      commands.push("# Run tests");
      commands.push("yarn test");
      break;
    case "npm":
      commands.push("# Install dependencies");
      commands.push("npm install");
      commands.push("");
      commands.push("# Run development server");
      commands.push("npm run dev");
      commands.push("");
      commands.push("# Run tests");
      commands.push("npm test");
      break;
    case "pip":
    case "poetry":
      commands.push("# Install dependencies");
      commands.push(
        stack.packageManager === "poetry" ? "poetry install" : "pip install -r requirements.txt"
      );
      commands.push("");
      commands.push("# Run tests");
      commands.push("pytest");
      commands.push("");
      commands.push("# Run server");
      commands.push("uvicorn main:app --reload");
      break;
    case "cargo":
      commands.push("# Build");
      commands.push("cargo build");
      commands.push("");
      commands.push("# Run tests");
      commands.push("cargo test");
      commands.push("");
      commands.push("# Run");
      commands.push("cargo run");
      break;
    case "go":
      commands.push("# Run tests");
      commands.push("go test ./...");
      commands.push("");
      commands.push("# Build");
      commands.push("go build");
      commands.push("");
      commands.push("# Run");
      commands.push("go run .");
      break;
    default:
      commands.push("# No package manager detected");
      commands.push("# Add your common commands here");
  }

  // Add linting if available
  if (stack.linter) {
    commands.push("");
    commands.push("# Lint");
    switch (stack.linter) {
      case "eslint":
        commands.push(`${stack.packageManager === "bun" ? "bun" : "npx"} eslint .`);
        break;
      case "biome":
        commands.push(`${stack.packageManager === "bun" ? "bun" : "npx"} biome check .`);
        break;
      case "ruff":
        commands.push("ruff check .");
        break;
    }
  }

  return commands.join("\n");
}

// ============================================================================
// Settings Generator
// ============================================================================

function generateSettings(stack: TechStack): GeneratedArtifact {
  const permissions: string[] = ["Read(**)", "Edit(**)", "Write(.claude/**)", "Bash(git:*)"];

  // Add package manager permissions
  const pkgManagers = ["npm", "yarn", "pnpm", "bun", "npx"];
  for (const pm of pkgManagers) {
    permissions.push(`Bash(${pm}:*)`);
  }

  // Add language-specific permissions
  if (stack.languages.includes("typescript") || stack.languages.includes("javascript")) {
    permissions.push("Bash(node:*)", "Bash(tsc:*)");
  }

  if (stack.languages.includes("python")) {
    permissions.push(
      "Bash(python:*)",
      "Bash(pip:*)",
      "Bash(poetry:*)",
      "Bash(pytest:*)",
      "Bash(uvicorn:*)"
    );
  }

  if (stack.languages.includes("go")) {
    permissions.push("Bash(go:*)");
  }

  if (stack.languages.includes("rust")) {
    permissions.push("Bash(cargo:*)", "Bash(rustc:*)");
  }

  if (stack.languages.includes("ruby")) {
    permissions.push("Bash(ruby:*)", "Bash(bundle:*)", "Bash(rails:*)", "Bash(rake:*)");
  }

  // Add testing framework permissions
  if (stack.testingFramework) {
    const testCommands: Record<string, string[]> = {
      jest: ["jest:*"],
      vitest: ["vitest:*"],
      playwright: ["playwright:*"],
      cypress: ["cypress:*"],
      pytest: ["pytest:*"],
      rspec: ["rspec:*"],
    };
    const cmds = testCommands[stack.testingFramework];
    if (cmds) {
      permissions.push(...cmds.map((c) => `Bash(${c})`));
    }
  }

  // Add linter/formatter permissions
  if (stack.linter) {
    permissions.push(`Bash(${stack.linter}:*)`);
  }
  if (stack.formatter) {
    permissions.push(`Bash(${stack.formatter}:*)`);
  }

  // Add common utility permissions
  permissions.push(
    "Bash(ls:*)",
    "Bash(mkdir:*)",
    "Bash(cat:*)",
    "Bash(echo:*)",
    "Bash(grep:*)",
    "Bash(find:*)"
  );

  // Add Docker if present
  if (stack.hasDocker) {
    permissions.push("Bash(docker:*)", "Bash(docker-compose:*)");
  }

  const settings = {
    $schema: "https://json.schemastore.org/claude-code-settings.json",
    permissions: {
      allow: [...new Set(permissions)], // Deduplicate
    },
  };

  return {
    type: "settings",
    path: ".claude/settings.json",
    content: JSON.stringify(settings, null, 2),
    isNew: true,
  };
}

// ============================================================================
// Skills Generator
// ============================================================================

interface SkillDef {
  name: string;
  description: string;
}

function getSkillsForStack(stack: TechStack): SkillDef[] {
  const skills: SkillDef[] = [
    { name: "pattern-discovery", description: "Finding codebase patterns" },
    { name: "systematic-debugging", description: "Debugging approach" },
    { name: "testing-methodology", description: "Testing strategy" },
  ];

  // Add framework-specific skills
  if (stack.frameworks.includes("nextjs")) {
    skills.push({ name: "nextjs-patterns", description: "Next.js App Router patterns" });
  }

  if (stack.frameworks.includes("react") || stack.frameworks.includes("nextjs")) {
    skills.push({ name: "react-components", description: "React component patterns" });
  }

  if (stack.frameworks.includes("fastapi")) {
    skills.push({ name: "fastapi-patterns", description: "FastAPI endpoint patterns" });
  }

  if (stack.frameworks.includes("nestjs")) {
    skills.push({ name: "nestjs-patterns", description: "NestJS module patterns" });
  }

  if (stack.frameworks.includes("prisma") || stack.frameworks.includes("drizzle")) {
    skills.push({ name: "database-patterns", description: "Database and ORM patterns" });
  }

  return skills;
}

function generateSkills(stack: TechStack): GeneratedArtifact[] {
  const artifacts: GeneratedArtifact[] = [];

  // Universal skills
  artifacts.push(generatePatternDiscoverySkill());
  artifacts.push(generateSystematicDebuggingSkill());
  artifacts.push(generateTestingMethodologySkill(stack));

  // Framework-specific skills
  if (stack.frameworks.includes("nextjs")) {
    artifacts.push(generateNextJsSkill());
  }

  if (stack.frameworks.includes("react") && !stack.frameworks.includes("nextjs")) {
    artifacts.push(generateReactSkill());
  }

  if (stack.frameworks.includes("fastapi")) {
    artifacts.push(generateFastAPISkill());
  }

  if (stack.frameworks.includes("nestjs")) {
    artifacts.push(generateNestJSSkill());
  }

  return artifacts;
}

function generatePatternDiscoverySkill(): GeneratedArtifact {
  return {
    type: "skill",
    path: ".claude/skills/pattern-discovery.md",
    content: `---
name: pattern-discovery
description: Analyze existing codebase to discover and document patterns
globs:
  - "src/**/*"
  - "lib/**/*"
  - "app/**/*"
  - "components/**/*"
  - "pages/**/*"
  - "api/**/*"
  - "services/**/*"
---

# Pattern Discovery

When starting work on a project, analyze the existing code to understand its patterns.

## Discovery Process

### 1. Check for Existing Documentation

\`\`\`
Look for:
- README.md, CONTRIBUTING.md
- docs/ folder
- Code comments and JSDoc/TSDoc
- .editorconfig, .prettierrc, eslint config
\`\`\`

### 2. Analyze Project Structure

\`\`\`
Questions to answer:
- How are files organized? (by feature, by type, flat?)
- Where does business logic live?
- Where are tests located?
- How are configs managed?
\`\`\`

### 3. Detect Code Patterns

\`\`\`
Look at 3-5 similar files to find:
- Naming conventions (camelCase, snake_case, PascalCase)
- Import organization (grouped? sorted? relative vs absolute?)
- Export style (named, default, barrel files?)
- Error handling approach
- Logging patterns
\`\`\`

### 4. Identify Architecture

\`\`\`
Common patterns to detect:
- MVC / MVVM / Clean Architecture
- Repository pattern
- Service layer
- Dependency injection
- Event-driven
- Functional vs OOP
\`\`\`

## When No Code Exists

If starting a new project:

1. Ask about preferred patterns
2. Check package.json/config files for framework hints
3. Use sensible defaults for detected stack
4. Document decisions in \`.claude/state/task.md\`

## Important

- **Match existing patterns** - don't impose new ones
- **When in doubt, check similar files** in the codebase
- **Document as you discover** - note patterns in task state
- **Ask if unclear** - better to ask than assume
`,
    isNew: true,
  };
}

function generateSystematicDebuggingSkill(): GeneratedArtifact {
  return {
    type: "skill",
    path: ".claude/skills/systematic-debugging.md",
    content: `---
name: systematic-debugging
description: Methodical approach to finding and fixing bugs
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.rs"
---

# Systematic Debugging

A 4-phase methodology for finding and fixing bugs efficiently.

## Phase 1: Reproduce

Before fixing, confirm you can reproduce the bug.

\`\`\`
1. Get exact steps to reproduce
2. Identify expected vs actual behavior
3. Note any error messages verbatim
4. Check if it's consistent or intermittent
\`\`\`

## Phase 2: Locate

Narrow down where the bug occurs.

\`\`\`
Techniques:
- Binary search through code flow
- Add logging at key points
- Check recent changes (git log, git diff)
- Review stack traces carefully
- Use debugger breakpoints
\`\`\`

## Phase 3: Diagnose

Understand WHY the bug happens.

\`\`\`
Questions:
- What assumptions are being violated?
- What state is unexpected?
- Is this a logic error, data error, or timing issue?
- Are there edge cases not handled?
\`\`\`

## Phase 4: Fix

Apply the minimal correct fix.

\`\`\`
Guidelines:
- Fix the root cause, not symptoms
- Make the smallest change that fixes the issue
- Add a test that would have caught this bug
- Check for similar bugs elsewhere
- Update documentation if needed
\`\`\`

## Quick Reference

| Symptom | Check First |
|---------|-------------|
| TypeError | Null/undefined values, type mismatches |
| Off-by-one | Loop bounds, array indices |
| Race condition | Async operations, shared state |
| Memory leak | Event listeners, subscriptions, closures |
| Infinite loop | Exit conditions, recursive calls |
`,
    isNew: true,
  };
}

function generateTestingMethodologySkill(stack: TechStack): GeneratedArtifact {
  const testingFramework = stack.testingFramework || "generic";
  const examples = getTestingExamples(stack);

  return {
    type: "skill",
    path: ".claude/skills/testing-methodology.md",
    content: `---
name: testing-methodology
description: Testing patterns and best practices for this project
globs:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/test/**"
  - "**/tests/**"
  - "**/__tests__/**"
---

# Testing Methodology

## Testing Framework

This project uses: **${testingFramework}**

## The AAA Pattern

Structure every test with:

\`\`\`
Arrange - Set up test data and conditions
Act     - Execute the code being tested
Assert  - Verify the expected outcome
\`\`\`

## What to Test

### Must Test
- Core business logic
- Edge cases and boundaries
- Error handling paths
- Public API contracts

### Consider Testing
- Integration points
- Complex conditional logic
- State transitions

### Skip Testing
- Framework internals
- Simple getters/setters
- Configuration constants

## Example Patterns

${examples}

## Test Naming

\`\`\`
Format: [unit]_[scenario]_[expected result]

Examples:
- calculateTotal_withEmptyCart_returnsZero
- userService_createUser_savesToDatabase
- parseDate_invalidFormat_throwsError
\`\`\`

## Mocking Guidelines

1. **Mock external dependencies** - APIs, databases, file system
2. **Don't mock what you own** - Prefer real implementations for your code
3. **Keep mocks simple** - Complex mocks often indicate design issues
4. **Reset mocks between tests** - Avoid state leakage

## Coverage Philosophy

- Aim for **80%+ coverage** on critical paths
- Don't chase 100% - it often leads to brittle tests
- Focus on **behavior coverage**, not line coverage
`,
    isNew: true,
  };
}

function getTestingExamples(stack: TechStack): string {
  if (stack.testingFramework === "vitest" || stack.testingFramework === "jest") {
    return `
\`\`\`typescript
import { describe, it, expect } from '${stack.testingFramework}';

describe('UserService', () => {
  it('should create user with valid data', async () => {
    // Arrange
    const userData = { name: 'Test', email: 'test@example.com' };

    // Act
    const user = await userService.create(userData);

    // Assert
    expect(user.id).toBeDefined();
    expect(user.name).toBe('Test');
  });

  it('should throw on invalid email', async () => {
    // Arrange
    const userData = { name: 'Test', email: 'invalid' };

    // Act & Assert
    await expect(userService.create(userData)).rejects.toThrow('Invalid email');
  });
});
\`\`\``;
  }

  if (stack.testingFramework === "pytest") {
    return `
\`\`\`python
import pytest
from myapp.services import UserService

class TestUserService:
    def test_create_user_with_valid_data(self, db_session):
        # Arrange
        user_data = {"name": "Test", "email": "test@example.com"}
        service = UserService(db_session)

        # Act
        user = service.create(user_data)

        # Assert
        assert user.id is not None
        assert user.name == "Test"

    def test_create_user_invalid_email_raises(self, db_session):
        # Arrange
        user_data = {"name": "Test", "email": "invalid"}
        service = UserService(db_session)

        # Act & Assert
        with pytest.raises(ValueError, match="Invalid email"):
            service.create(user_data)
\`\`\``;
  }

  if (stack.testingFramework === "go-test") {
    return `
\`\`\`go
func TestUserService_Create(t *testing.T) {
    t.Run("creates user with valid data", func(t *testing.T) {
        // Arrange
        svc := NewUserService(mockDB)
        userData := UserInput{Name: "Test", Email: "test@example.com"}

        // Act
        user, err := svc.Create(userData)

        // Assert
        assert.NoError(t, err)
        assert.NotEmpty(t, user.ID)
        assert.Equal(t, "Test", user.Name)
    })

    t.Run("returns error on invalid email", func(t *testing.T) {
        // Arrange
        svc := NewUserService(mockDB)
        userData := UserInput{Name: "Test", Email: "invalid"}

        // Act
        _, err := svc.Create(userData)

        // Assert
        assert.ErrorContains(t, err, "invalid email")
    })
}
\`\`\``;
  }

  return `
\`\`\`
// Add examples for your testing framework here
describe('Component', () => {
  it('should behave correctly', () => {
    // Arrange - set up test conditions
    // Act - execute the code
    // Assert - verify results
  });
});
\`\`\``;
}

function generateNextJsSkill(): GeneratedArtifact {
  return {
    type: "skill",
    path: ".claude/skills/nextjs-patterns.md",
    content: `---
name: nextjs-patterns
description: Next.js App Router patterns and best practices
globs:
  - "app/**/*"
  - "src/app/**/*"
  - "components/**/*"
---

# Next.js Patterns (App Router)

## File Conventions

| File | Purpose |
|------|---------|
| \`page.tsx\` | Route UI |
| \`layout.tsx\` | Shared layout wrapper |
| \`loading.tsx\` | Loading UI (Suspense) |
| \`error.tsx\` | Error boundary |
| \`not-found.tsx\` | 404 page |
| \`route.ts\` | API endpoint |

## Server vs Client Components

\`\`\`tsx
// Server Component (default) - runs on server only
export default function ServerComponent() {
  // Can use: async/await, direct DB access, server-only code
  // Cannot use: useState, useEffect, browser APIs
  return <div>Server rendered</div>;
}

// Client Component - runs on client
'use client';
export default function ClientComponent() {
  // Can use: hooks, event handlers, browser APIs
  const [state, setState] = useState();
  return <button onClick={() => setState(...)}>Click</button>;
}
\`\`\`

## Data Fetching

\`\`\`tsx
// Server Component - fetch directly
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  return <ProductDetails product={product} />;
}

// With caching
const getData = cache(async (id: string) => {
  return await db.find(id);
});
\`\`\`

## Server Actions

\`\`\`tsx
// actions.ts
'use server';

export async function createPost(formData: FormData) {
  const title = formData.get('title');
  await db.post.create({ data: { title } });
  revalidatePath('/posts');
}

// In component
<form action={createPost}>
  <input name="title" />
  <button type="submit">Create</button>
</form>
\`\`\`

## Route Handlers

\`\`\`tsx
// app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const users = await db.user.findMany();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.user.create({ data: body });
  return NextResponse.json(user, { status: 201 });
}
\`\`\`

## Patterns to Follow

1. **Default to Server Components** - Only use 'use client' when needed
2. **Colocate related files** - Keep components near their routes
3. **Use route groups** - \`(auth)/login\` for organization without URL impact
4. **Parallel routes** - \`@modal/\` for simultaneous rendering
5. **Intercepting routes** - \`(.)/photo\` for modal patterns
`,
    isNew: true,
  };
}

function generateReactSkill(): GeneratedArtifact {
  return {
    type: "skill",
    path: ".claude/skills/react-components.md",
    content: `---
name: react-components
description: React component patterns and best practices
globs:
  - "src/components/**/*"
  - "components/**/*"
  - "**/*.tsx"
  - "**/*.jsx"
---

# React Component Patterns

## Component Structure

\`\`\`tsx
// Standard component structure
import { useState, useCallback } from 'react';
import type { ComponentProps } from './types';

interface Props {
  title: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export function MyComponent({ title, onAction, children }: Props) {
  const [state, setState] = useState(false);

  const handleClick = useCallback(() => {
    setState(true);
    onAction?.();
  }, [onAction]);

  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleClick}>Action</button>
      {children}
    </div>
  );
}
\`\`\`

## Hooks Patterns

\`\`\`tsx
// Custom hook for data fetching
function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchUser(id)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { user, loading, error };
}
\`\`\`

## State Management

\`\`\`tsx
// Use reducer for complex state
const [state, dispatch] = useReducer(reducer, initialState);

// Use context for shared state
const ThemeContext = createContext<Theme>('light');
export const useTheme = () => useContext(ThemeContext);
\`\`\`

## Performance

1. **Memoize expensive calculations**: \`useMemo\`
2. **Memoize callbacks**: \`useCallback\`
3. **Memoize components**: \`React.memo\`
4. **Avoid inline objects/arrays in props**

## Testing

\`\`\`tsx
import { render, screen, fireEvent } from '@testing-library/react';

test('button triggers action', () => {
  const onAction = vi.fn();
  render(<MyComponent title="Test" onAction={onAction} />);

  fireEvent.click(screen.getByRole('button'));

  expect(onAction).toHaveBeenCalled();
});
\`\`\`
`,
    isNew: true,
  };
}

function generateFastAPISkill(): GeneratedArtifact {
  return {
    type: "skill",
    path: ".claude/skills/fastapi-patterns.md",
    content: `---
name: fastapi-patterns
description: FastAPI endpoint patterns and best practices
globs:
  - "app/**/*.py"
  - "src/**/*.py"
  - "api/**/*.py"
  - "routers/**/*.py"
---

# FastAPI Patterns

## Router Structure

\`\`\`python
# routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import UserCreate, UserResponse
from app.services import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = UserService(db)
    return service.get_all(skip=skip, limit=limit)

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    service = UserService(db)
    return service.create(user)
\`\`\`

## Dependency Injection

\`\`\`python
# Dependencies
def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    user = decode_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    return user

# Usage
@router.delete("/{id}")
async def delete_user(id: int, admin: User = Depends(require_admin)):
    ...
\`\`\`

## Pydantic Schemas

\`\`\`python
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True  # For ORM mode
\`\`\`

## Error Handling

\`\`\`python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

# Custom exception
class NotFoundError(Exception):
    def __init__(self, resource: str, id: int):
        self.resource = resource
        self.id = id

# Exception handler
@app.exception_handler(NotFoundError)
async def not_found_handler(request, exc: NotFoundError):
    return JSONResponse(
        status_code=404,
        content={"error": f"{exc.resource} {exc.id} not found"}
    )
\`\`\`

## Testing

\`\`\`python
from fastapi.testclient import TestClient

def test_create_user(client: TestClient):
    response = client.post("/users/", json={
        "email": "test@example.com",
        "name": "Test",
        "password": "password123"
    })
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"
\`\`\`
`,
    isNew: true,
  };
}

function generateNestJSSkill(): GeneratedArtifact {
  return {
    type: "skill",
    path: ".claude/skills/nestjs-patterns.md",
    content: `---
name: nestjs-patterns
description: NestJS module patterns and best practices
globs:
  - "src/**/*.ts"
  - "**/*.module.ts"
  - "**/*.controller.ts"
  - "**/*.service.ts"
---

# NestJS Patterns

## Module Structure

\`\`\`typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
\`\`\`

## Controller Pattern

\`\`\`typescript
// users/users.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
\`\`\`

## Service Pattern

\`\`\`typescript
// users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(\`User #\${id} not found\`);
    }
    return user;
  }
}
\`\`\`

## DTO Validation

\`\`\`typescript
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;
}
\`\`\`

## Testing

\`\`\`typescript
describe('UsersService', () => {
  let service: UsersService;
  let repository: MockType<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: repositoryMockFactory },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should find all users', async () => {
    const users = [{ id: 1, name: 'Test' }];
    repository.find.mockReturnValue(users);

    expect(await service.findAll()).toEqual(users);
  });
});
\`\`\`
`,
    isNew: true,
  };
}

// ============================================================================
// Agents Generator
// ============================================================================

interface AgentDef {
  name: string;
  description: string;
}

function getAgentsForStack(stack: TechStack): AgentDef[] {
  const agents: AgentDef[] = [
    { name: "code-reviewer", description: "Reviews code for quality and security" },
    { name: "test-writer", description: "Generates tests for code" },
  ];

  if (stack.hasDocker) {
    agents.push({ name: "docker-helper", description: "Helps with Docker and containerization" });
  }

  return agents;
}

function generateAgents(stack: TechStack): GeneratedArtifact[] {
  const artifacts: GeneratedArtifact[] = [];

  // Code reviewer agent
  artifacts.push(generateCodeReviewerAgent(stack));

  // Test writer agent
  artifacts.push(generateTestWriterAgent(stack));

  return artifacts;
}

function generateCodeReviewerAgent(stack: TechStack): GeneratedArtifact {
  const lintCommand = getLintCommand(stack);

  return {
    type: "agent",
    path: ".claude/agents/code-reviewer.md",
    content: `---
name: code-reviewer
description: Reviews code for quality, security issues, and best practices
tools: Read, Grep, Glob${lintCommand ? `, Bash(${lintCommand})` : ""}
disallowedTools: Write, Edit
model: sonnet
---

You are a senior code reviewer with expertise in security and performance.

## Code Style Reference

Read these files to understand project conventions:
${stack.linter === "eslint" ? "- `eslint.config.js` or `.eslintrc.*`" : ""}
${stack.formatter === "prettier" ? "- `.prettierrc`" : ""}
${stack.languages.includes("typescript") ? "- `tsconfig.json`" : ""}
${stack.languages.includes("python") ? "- `pyproject.toml` or `setup.cfg`" : ""}

${lintCommand ? `Run \`${lintCommand}\` to check violations programmatically.` : ""}

## Review Process

1. Run \`git diff\` to identify changed files
2. Analyze each change for:
   - Security vulnerabilities (OWASP Top 10)
   - Performance issues
   - Code style violations
   - Missing error handling
   - Test coverage gaps

## Output Format

For each finding:

- **Critical**: Must fix before merge
- **Warning**: Should address
- **Suggestion**: Consider improving

Include file:line references for each issue.
`,
    isNew: true,
  };
}

function generateTestWriterAgent(stack: TechStack): GeneratedArtifact {
  const testCommand = getTestCommand(stack);

  return {
    type: "agent",
    path: ".claude/agents/test-writer.md",
    content: `---
name: test-writer
description: Generates comprehensive tests for code
tools: Read, Grep, Glob, Write, Edit, Bash(${testCommand})
model: sonnet
---

You are a testing expert who writes thorough, maintainable tests.

## Testing Framework

This project uses: **${stack.testingFramework || "unknown"}**

## Your Process

1. Read the code to be tested
2. Identify test cases:
   - Happy path scenarios
   - Edge cases
   - Error conditions
   - Boundary values
3. Write tests following project patterns
4. Run tests to verify they pass

## Test Structure

Follow the AAA pattern:
- **Arrange**: Set up test data
- **Act**: Execute the code
- **Assert**: Verify results

## Guidelines

- One assertion focus per test
- Descriptive test names
- Mock external dependencies
- Don't test implementation details
- Aim for behavior coverage

## Run Tests

\`\`\`bash
${testCommand}
\`\`\`
`,
    isNew: true,
  };
}

function getLintCommand(stack: TechStack): string {
  switch (stack.linter) {
    case "eslint":
      return `${stack.packageManager === "bun" ? "bun" : "npx"} eslint .`;
    case "biome":
      return `${stack.packageManager === "bun" ? "bun" : "npx"} biome check .`;
    case "ruff":
      return "ruff check .";
    default:
      return "";
  }
}

function getTestCommand(stack: TechStack): string {
  switch (stack.testingFramework) {
    case "vitest":
      return `${stack.packageManager || "npm"} ${stack.packageManager === "npm" ? "run " : ""}test`;
    case "jest":
      return `${stack.packageManager || "npm"} ${stack.packageManager === "npm" ? "run " : ""}test`;
    case "bun-test":
      return "bun test";
    case "pytest":
      return "pytest";
    case "go-test":
      return "go test ./...";
    case "rust-test":
      return "cargo test";
    default:
      return `${stack.packageManager || "npm"} test`;
  }
}

// ============================================================================
// Rules Generator
// ============================================================================

function generateRules(stack: TechStack): GeneratedArtifact[] {
  const artifacts: GeneratedArtifact[] = [];

  // Language-specific rules
  if (stack.languages.includes("typescript")) {
    artifacts.push(generateTypeScriptRules());
  }

  if (stack.languages.includes("python")) {
    artifacts.push(generatePythonRules());
  }

  // Universal code style rule
  artifacts.push(generateCodeStyleRule(stack));

  return artifacts;
}

function generateTypeScriptRules(): GeneratedArtifact {
  return {
    type: "rule",
    path: ".claude/rules/typescript.md",
    content: `---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Rules

## Type Safety

- Avoid \`any\` - use \`unknown\` and narrow types
- Prefer interfaces for objects, types for unions/intersections
- Use strict mode (\`strict: true\` in tsconfig)
- Enable \`noUncheckedIndexedAccess\` for safer array access

## Patterns

\`\`\`typescript
// Prefer
const user: User | undefined = users.find(u => u.id === id);
if (user) { /* use user */ }

// Avoid
const user = users.find(u => u.id === id) as User;
\`\`\`

## Naming

- Interfaces: PascalCase (e.g., \`UserProfile\`)
- Types: PascalCase (e.g., \`ApiResponse\`)
- Functions: camelCase (e.g., \`getUserById\`)
- Constants: SCREAMING_SNAKE_CASE for true constants

## Imports

- Group imports: external, internal, relative
- Use path aliases when configured
- Prefer named exports over default exports
`,
    isNew: true,
  };
}

function generatePythonRules(): GeneratedArtifact {
  return {
    type: "rule",
    path: ".claude/rules/python.md",
    content: `---
paths:
  - "**/*.py"
---

# Python Rules

## Style

- Follow PEP 8
- Use type hints for function signatures
- Docstrings for public functions (Google style)
- Max line length: 88 (Black default)

## Patterns

\`\`\`python
# Prefer
def get_user(user_id: int) -> User | None:
    """Fetch user by ID.

    Args:
        user_id: The user's unique identifier.

    Returns:
        User object if found, None otherwise.
    """
    return db.query(User).filter(User.id == user_id).first()

# Avoid
def get_user(id):
    return db.query(User).filter(User.id == id).first()
\`\`\`

## Naming

- Functions/variables: snake_case
- Classes: PascalCase
- Constants: SCREAMING_SNAKE_CASE
- Private: _leading_underscore

## Imports

\`\`\`python
# Standard library
import os
from pathlib import Path

# Third-party
from fastapi import FastAPI
from pydantic import BaseModel

# Local
from app.models import User
from app.services import UserService
\`\`\`
`,
    isNew: true,
  };
}

function generateCodeStyleRule(stack: TechStack): GeneratedArtifact {
  return {
    type: "rule",
    path: ".claude/rules/code-style.md",
    content: `# Code Style

## General Principles

1. **Clarity over cleverness** - Code is read more than written
2. **Consistency** - Match existing patterns in the codebase
3. **Simplicity** - Prefer simple solutions over complex ones

## Formatting

${stack.formatter ? `This project uses **${stack.formatter}** for formatting. Run it before committing.` : "Format code consistently with the existing codebase."}

${stack.linter ? `This project uses **${stack.linter}** for linting. Fix all warnings.` : ""}

## Comments

- Write self-documenting code first
- Comment the "why", not the "what"
- Keep comments up to date with code changes
- Use TODO/FIXME with context

## Error Handling

- Handle errors at appropriate boundaries
- Provide meaningful error messages
- Log errors with context
- Don't swallow errors silently

## Git Commits

- Write clear, concise commit messages
- Use conventional commits format when applicable
- Keep commits focused and atomic
`,
    isNew: true,
  };
}

// ============================================================================
// Commands Generator
// ============================================================================

function generateCommands(): GeneratedArtifact[] {
  return [
    generateTaskCommand(),
    generateStatusCommand(),
    generateDoneCommand(),
    generateAnalyzeCommand(),
  ];
}

function generateTaskCommand(): GeneratedArtifact {
  return {
    type: "command",
    path: ".claude/commands/task.md",
    content: `---
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: [task description]
description: Start or switch to a new task
---

# Start Task

## Current State
!cat .claude/state/task.md 2>/dev/null || echo "No existing task"

## Your Task

Start or switch to the task: **$ARGUMENTS**

1. Read current state from \`.claude/state/task.md\`
2. If switching tasks, summarize previous progress
3. Update \`.claude/state/task.md\` with:
   - Status: In Progress
   - Task description
   - Initial context/understanding
   - Planned next steps

4. Begin working on the task
`,
    isNew: true,
  };
}

function generateStatusCommand(): GeneratedArtifact {
  return {
    type: "command",
    path: ".claude/commands/status.md",
    content: `---
allowed-tools: Read, Glob
description: Show current task and session state
---

# Status Check

## Current Task State
!cat .claude/state/task.md 2>/dev/null || echo "No task in progress"

## Your Response

Provide a concise status update:

1. **Current Task**: What are you working on?
2. **Progress**: What's been completed?
3. **Blockers**: Any issues or questions?
4. **Next Steps**: What's coming up?

Keep it brief - this is a quick check-in.
`,
    isNew: true,
  };
}

function generateDoneCommand(): GeneratedArtifact {
  return {
    type: "command",
    path: ".claude/commands/done.md",
    content: `---
allowed-tools: Read, Write, Edit, Glob, Bash(git diff), Bash(git status)
description: Mark current task complete
---

# Complete Task

## Current State
!cat .claude/state/task.md

## Completion Checklist

Before marking complete, verify:

1. [ ] All requirements met
2. [ ] Tests pass (if applicable)
3. [ ] No linting errors
4. [ ] Code reviewed for quality

## Your Task

1. Run final checks (tests, lint)
2. Update \`.claude/state/task.md\`:
   - Status: **Completed**
   - Summary of what was done
   - Files changed
   - Any follow-up items

3. Show git status/diff for review
`,
    isNew: true,
  };
}

function generateAnalyzeCommand(): GeneratedArtifact {
  return {
    type: "command",
    path: ".claude/commands/analyze.md",
    content: `---
allowed-tools: Read, Glob, Grep
argument-hint: [area to analyze]
description: Deep analysis of a specific area
---

# Analyze: $ARGUMENTS

## Analysis Scope

Perform deep analysis of: **$ARGUMENTS**

## Process

1. **Locate relevant files** using Glob and Grep
2. **Read and understand** the code structure
3. **Identify patterns** and conventions
4. **Document findings** with file:line references

## Output Format

### Overview
Brief description of what this area does.

### Key Files
- \`path/to/file.ts:10\` - Purpose

### Patterns Found
- Pattern 1: Description
- Pattern 2: Description

### Dependencies
What this area depends on and what depends on it.

### Recommendations
Any improvements or concerns noted.
`,
    isNew: true,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function formatLanguage(lang: Language): string {
  const names: Record<Language, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    python: "Python",
    go: "Go",
    rust: "Rust",
    java: "Java",
    ruby: "Ruby",
    csharp: "C#",
    swift: "Swift",
    kotlin: "Kotlin",
    php: "PHP",
    cpp: "C++",
  };
  return names[lang] || lang;
}

function formatFramework(fw: Framework): string {
  const names: Record<Framework, string> = {
    nextjs: "Next.js",
    react: "React",
    vue: "Vue.js",
    nuxt: "Nuxt",
    svelte: "Svelte",
    sveltekit: "SvelteKit",
    angular: "Angular",
    astro: "Astro",
    remix: "Remix",
    gatsby: "Gatsby",
    solid: "Solid.js",
    express: "Express",
    nestjs: "NestJS",
    fastify: "Fastify",
    hono: "Hono",
    elysia: "Elysia",
    koa: "Koa",
    fastapi: "FastAPI",
    django: "Django",
    flask: "Flask",
    starlette: "Starlette",
    gin: "Gin",
    echo: "Echo",
    fiber: "Fiber",
    actix: "Actix",
    axum: "Axum",
    rocket: "Rocket",
    rails: "Rails",
    sinatra: "Sinatra",
    spring: "Spring",
    quarkus: "Quarkus",
    tailwind: "Tailwind CSS",
    shadcn: "shadcn/ui",
    chakra: "Chakra UI",
    mui: "Material UI",
    prisma: "Prisma",
    drizzle: "Drizzle",
    typeorm: "TypeORM",
    sequelize: "Sequelize",
    mongoose: "Mongoose",
    sqlalchemy: "SQLAlchemy",
  };
  return names[fw] || fw;
}
