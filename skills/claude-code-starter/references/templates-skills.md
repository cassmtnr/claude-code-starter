# Skill Templates

All skill templates to generate in `.claude/skills/`. Each section is a complete skill file.

## Table of Contents

- [Core Skills (Always Generate)](#core-skills-always-generate)
  - [pattern-discovery](#pattern-discovery)
  - [systematic-debugging](#systematic-debugging)
  - [testing-methodology](#testing-methodology)
  - [iterative-development](#iterative-development)
  - [commit-hygiene](#commit-hygiene)
  - [code-deduplication](#code-deduplication)
  - [simplicity-rules](#simplicity-rules)
  - [security](#security)
- [Framework Skills (Conditional)](#framework-skills-conditional)
  - [nextjs-patterns](#nextjs-patterns)
  - [react-components](#react-components)
  - [fastapi-patterns](#fastapi-patterns)
  - [nestjs-patterns](#nestjs-patterns)
  - [swiftui-patterns](#swiftui-patterns)
  - [uikit-patterns](#uikit-patterns)
  - [vapor-patterns](#vapor-patterns)
  - [compose-patterns](#compose-patterns)
  - [android-views-patterns](#android-views-patterns)

---

## Core Skills (Always Generate)

### pattern-discovery

**File**: `.claude/skills/pattern-discovery.md`

```markdown
---
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

```
Look for:
- README.md, CONTRIBUTING.md
- docs/ folder
- Code comments and JSDoc/TSDoc
- .editorconfig, .prettierrc, eslint config
```

### 2. Analyze Project Structure

```
Questions to answer:
- How are files organized? (by feature, by type, flat?)
- Where does business logic live?
- Where are tests located?
- How are configs managed?
```

### 3. Detect Code Patterns

```
Look at 3-5 similar files to find:
- Naming conventions (camelCase, snake_case, PascalCase)
- Import organization (grouped? sorted? relative vs absolute?)
- Export style (named, default, barrel files?)
- Error handling approach
- Logging patterns
```

### 4. Identify Architecture

```
Common patterns to detect:
- MVC / MVVM / Clean Architecture
- Repository pattern
- Service layer
- Dependency injection
- Event-driven
- Functional vs OOP
```

## When No Code Exists

If starting a new project:

1. Ask about preferred patterns
2. Check package.json/config files for framework hints
3. Use sensible defaults for detected stack
4. Document decisions in `.claude/state/task.md`

## Important

- **Match existing patterns** - don't impose new ones
- **When in doubt, check similar files** in the codebase
- **Document as you discover** - note patterns in task state
- **Ask if unclear** - better to ask than assume
```

---

### systematic-debugging

**File**: `.claude/skills/systematic-debugging.md`

```markdown
---
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

```
1. Get exact steps to reproduce
2. Identify expected vs actual behavior
3. Note any error messages verbatim
4. Check if it's consistent or intermittent
```

## Phase 2: Locate

Narrow down where the bug occurs.

```
Techniques:
- Binary search through code flow
- Add logging at key points
- Check recent changes (git log, git diff)
- Review stack traces carefully
- Use debugger breakpoints
```

## Phase 3: Diagnose

Understand WHY the bug happens.

```
Questions:
- What assumptions are being violated?
- What state is unexpected?
- Is this a logic error, data error, or timing issue?
- Are there edge cases not handled?
```

## Phase 4: Fix

Apply the minimal correct fix.

```
Guidelines:
- Fix the root cause, not symptoms
- Make the smallest change that fixes the issue
- Add a test that would have caught this bug
- Check for similar bugs elsewhere
- Update documentation if needed
```

## Quick Reference

| Symptom | Check First |
|---------|-------------|
| TypeError | Null/undefined values, type mismatches |
| Off-by-one | Loop bounds, array indices |
| Race condition | Async operations, shared state |
| Memory leak | Event listeners, subscriptions, closures |
| Infinite loop | Exit conditions, recursive calls |
```

---

### testing-methodology

**File**: `.claude/skills/testing-methodology.md`

This skill is **dynamic** — it adapts to the detected testing framework.

**Template** (replace `{TESTING_FRAMEWORK}` and `{TESTING_EXAMPLES}`):

```markdown
---
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

This project uses: **{TESTING_FRAMEWORK}**

## The AAA Pattern

Structure every test with:

```
Arrange - Set up test data and conditions
Act     - Execute the code being tested
Assert  - Verify the expected outcome
```

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

{TESTING_EXAMPLES}

## Test Naming

```
Format: [unit]_[scenario]_[expected result]

Examples:
- calculateTotal_withEmptyCart_returnsZero
- userService_createUser_savesToDatabase
- parseDate_invalidFormat_throwsError
```

## Mocking Guidelines

1. **Mock external dependencies** - APIs, databases, file system
2. **Don't mock what you own** - Prefer real implementations for your code
3. **Keep mocks simple** - Complex mocks often indicate design issues
4. **Reset mocks between tests** - Avoid state leakage

## Coverage Philosophy

- Aim for **80%+ coverage** on critical paths
- Don't chase 100% - it often leads to brittle tests
- Focus on **behavior coverage**, not line coverage
```

#### Testing Examples by Framework

**vitest / jest**:
```typescript
import { describe, it, expect } from '{FRAMEWORK}';

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
```

**pytest**:
```python
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
```

**go-test**:
```go
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
```

**bun-test**:
```typescript
import { describe, it, expect } from 'bun:test';
// Same pattern as vitest/jest examples above
```

**Generic fallback**:
```
// Add examples for your testing framework here
describe('Component', () => {
  it('should behave correctly', () => {
    // Arrange - set up test conditions
    // Act - execute the code
    // Assert - verify results
  });
});
```

---

### iterative-development

**File**: `.claude/skills/iterative-development.md`

This skill is **dynamic** — it adapts to the detected test and lint commands.

**Template** (replace `{TEST_CMD}` and `{LINT_CMD}`):

The test command is determined by:
| Testing Framework | Package Manager | Command |
|---|---|---|
| vitest | npm | `npm run test` |
| vitest | bun/pnpm/yarn | `{pm} test` |
| jest | npm | `npm run test` |
| jest | bun/pnpm/yarn | `{pm} test` |
| bun-test | any | `bun test` |
| pytest | any | `pytest` |
| go-test | any | `go test ./...` |
| rust-test | any | `cargo test` |
| default | any | `{pm} test` |

The lint command is determined by:
| Linter | Package Manager | Command |
|---|---|---|
| eslint | bun | `bun eslint .` |
| eslint | other | `npx eslint .` |
| biome | bun | `bun biome check .` |
| biome | other | `npx biome check .` |
| ruff | any | `ruff check .` |
| none | any | (omit lint step) |

```markdown
---
name: iterative-development
description: TDD-driven iterative loops until tests pass
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.py"
  - "**/*.go"
---

# Iterative Development (TDD Loops)

Self-referential development loops where you iterate until completion criteria are met.

## Core Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│  ITERATION > PERFECTION                                     │
│  Don't aim for perfect on first try.                        │
│  Let the loop refine the work.                              │
├─────────────────────────────────────────────────────────────┤
│  FAILURES ARE DATA                                          │
│  Failed tests, lint errors, type mismatches are signals.    │
│  Use them to guide the next iteration.                      │
├─────────────────────────────────────────────────────────────┤
│  CLEAR COMPLETION CRITERIA                                  │
│  Define exactly what "done" looks like.                     │
│  Tests passing. Coverage met. Lint clean.                   │
└─────────────────────────────────────────────────────────────┘
```

## TDD Workflow (Mandatory)

Every implementation task MUST follow this workflow:

### 1. RED: Write Tests First
```bash
# Write tests based on requirements
# Run tests - they MUST FAIL
{TEST_CMD}
```

### 2. GREEN: Implement Feature
```bash
# Write minimum code to pass tests
# Run tests - they MUST PASS
{TEST_CMD}
```

### 3. VALIDATE: Quality Gates
```bash
# Full quality check
{LINT_CMD}{TEST_CMD}
```

## Completion Criteria Template

For any implementation task, define:

```markdown
### Completion Criteria
- [ ] All tests passing
- [ ] Coverage >= 80% (on new code)
- [ ] Lint clean (no errors)
- [ ] Type check passing
```

## When to Use This Workflow

| Task Type | Use TDD Loop? |
|-----------|---------------|
| New feature | ✅ Always |
| Bug fix | ✅ Always (write test that reproduces bug first) |
| Refactoring | ✅ Always (existing tests must stay green) |
| Spike/exploration | ❌ Skip (but document findings) |
| Documentation | ❌ Skip |

## Anti-Patterns

- ❌ Writing code before tests
- ❌ Skipping the RED phase (tests that never fail are useless)
- ❌ Moving on when tests fail
- ❌ Large batches (prefer small, focused iterations)
```

---

### commit-hygiene

**File**: `.claude/skills/commit-hygiene.md`

```markdown
---
name: commit-hygiene
description: Atomic commits, PR size limits, commit thresholds
globs:
  - "**/*"
---

# Commit Hygiene

Keep commits atomic, PRs reviewable, and git history clean.

## Size Thresholds

| Metric | 🟢 Good | 🟡 Warning | 🔴 Commit Now |
|--------|------|---------|------------|
| Files changed | 1-5 | 6-10 | > 10 |
| Lines added | < 150 | 150-300 | > 300 |
| Total changes | < 250 | 250-400 | > 400 |

**Research shows:** PRs > 400 lines have 40%+ defect rates vs 15% for smaller changes.

## When to Commit

### Commit Triggers (Any = Commit)

| Trigger | Action |
|---------|--------|
| Test passes | Just got a test green → commit |
| Feature complete | Finished a function → commit |
| Refactor done | Renamed across files → commit |
| Bug fixed | Fixed the issue → commit |
| Threshold hit | > 5 files or > 200 lines → commit |

### Commit Immediately If

- ✅ Tests are passing after being red
- ✅ You're about to make a "big change"
- ✅ You've been coding for 30+ minutes
- ✅ You're about to try something risky
- ✅ The current state is "working"

## Atomic Commit Patterns

### Good Commits ✅

```
"Add email validation to signup form"
- 3 files: validator.ts, signup.tsx, signup.test.ts
- 120 lines changed
- Single purpose: email validation

"Fix null pointer in user lookup"
- 2 files: userService.ts, userService.test.ts
- 25 lines changed
- Single purpose: fix one bug
```

### Bad Commits ❌

```
"Add authentication, fix bugs, update styles"
- 25 files changed, 800 lines
- Multiple unrelated purposes

"WIP" / "Updates" / "Fix stuff"
- Unknown scope, no clear purpose
```

## Quick Status Check

Run frequently to check current state:

```bash
# See what's changed
git status --short

# Count changes
git diff --shortstat

# Full summary
git diff --stat HEAD
```

## PR Size Rules

| PR Size | Review Time | Quality |
|---------|-------------|---------|
| < 200 lines | < 30 min | High confidence |
| 200-400 lines | 30-60 min | Good confidence |
| 400-1000 lines | 1-2 hours | Declining quality |
| > 1000 lines | Often skipped | Rubber-stamped |

**Best practice:** If a PR will be > 400 lines, split into stacked PRs.
```

---

### code-deduplication

**File**: `.claude/skills/code-deduplication.md`

```markdown
---
name: code-deduplication
description: Prevent semantic code duplication with capability index
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.py"
---

# Code Deduplication

Prevent semantic duplication by maintaining awareness of existing capabilities.

## Core Principle

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECK BEFORE YOU WRITE                                         │
│  ─────────────────────────────────────────────────────────────  │
│  AI doesn't copy/paste - it reimplements.                       │
│  The problem isn't duplicate code, it's duplicate PURPOSE.      │
│                                                                 │
│  Before writing ANY new function:                               │
│  1. Search codebase for similar functionality                   │
│  2. Check utils/, helpers/, lib/ for existing implementations   │
│  3. Extend existing code if possible                            │
│  4. Only create new if nothing suitable exists                  │
└─────────────────────────────────────────────────────────────────┘
```

## Before Writing New Code

### Search Checklist

1. **Search by purpose**: "format date", "validate email", "fetch user"
2. **Search common locations**:
   - `src/utils/` or `lib/`
   - `src/helpers/`
   - `src/common/`
   - `src/shared/`
3. **Search by function signature**: Similar inputs/outputs

### Common Duplicate Candidates

| Category | Look For |
|----------|----------|
| Date/Time | formatDate, parseDate, isExpired, addDays |
| Validation | isEmail, isPhone, isURL, isUUID |
| Strings | slugify, truncate, capitalize, pluralize |
| API | fetchUser, createItem, handleError |
| Auth | validateToken, requireAuth, getCurrentUser |

## If Similar Code Exists

### Option 1: Reuse directly
```typescript
// Import and use existing function
import { formatDate } from '@/utils/dates';
```

### Option 2: Extend with options
```typescript
// Add optional parameter to existing function
export function formatDate(
  date: Date,
  format: string = 'short',
  locale?: string  // NEW: added locale support
): string { ... }
```

### Option 3: Compose from existing
```typescript
// Build on existing utilities
export function formatDateRange(start: Date, end: Date) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}
```

## File Header Pattern

Document what each file provides:

```typescript
/**
 * @file User validation utilities
 * @description Email, phone, and identity validation functions.
 *
 * Key exports:
 * - isEmail(email) - Validates email format
 * - isPhone(phone, country?) - Validates phone with country
 * - isValidUsername(username) - Checks username rules
 */
```

## Anti-Patterns

- ❌ Writing date formatter without checking utils/
- ❌ Creating new API client when one exists
- ❌ Duplicating validation logic across files
- ❌ Copy-pasting functions between files
- ❌ "I'll refactor later" (you won't)
```

---

### simplicity-rules

**File**: `.claude/skills/simplicity-rules.md`

```markdown
---
name: simplicity-rules
description: Enforced code complexity constraints
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.py"
  - "**/*.go"
---

# Simplicity Rules

Complexity is the enemy. Every line of code is a liability.

## Enforced Limits

**CRITICAL: These limits are non-negotiable. Check and enforce for EVERY file.**

### Function Level

| Constraint | Limit | Action if Exceeded |
|------------|-------|-------------------|
| Lines per function | 20 max | Decompose immediately |
| Parameters | 3 max | Use options object |
| Nesting levels | 2 max | Flatten with early returns |

### File Level

| Constraint | Limit | Action if Exceeded |
|------------|-------|-------------------|
| Lines per file | 200 max | Split by responsibility |
| Functions per file | 10 max | Split into modules |

### Module Level

| Constraint | Limit | Reason |
|------------|-------|--------|
| Directory nesting | 3 levels max | Flat is better |
| Circular deps | 0 | Never acceptable |

## Enforcement Protocol

**Before completing ANY file:**

```
1. Count total lines     → if > 200, STOP and split
2. Count functions       → if > 10, STOP and split
3. Check function length → if any > 20 lines, decompose
4. Check parameters      → if any > 3, refactor to options object
```

## Violation Response

When limits are exceeded:

```
⚠️ FILE SIZE VIOLATION DETECTED

[filename] has [X] lines (limit: 200)

Splitting into:
- [filename-a].ts - [responsibility A]
- [filename-b].ts - [responsibility B]
```

**Never defer refactoring.** Fix violations immediately.

## Decomposition Patterns

### Long Function → Multiple Functions

```typescript
// BEFORE: 40 lines
function processOrder(order) {
  // validate... 10 lines
  // calculate totals... 15 lines
  // apply discounts... 10 lines
  // save... 5 lines
}

// AFTER: 4 functions, each < 15 lines
function processOrder(order) {
  validateOrder(order);
  const totals = calculateTotals(order);
  const finalPrice = applyDiscounts(totals, order.coupons);
  return saveOrder({ ...order, finalPrice });
}
```

### Many Parameters → Options Object

```typescript
// BEFORE: 6 parameters
function createUser(name, email, password, role, team, settings) { }

// AFTER: 1 options object
interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  role?: string;
  team?: string;
  settings?: UserSettings;
}
function createUser(options: CreateUserOptions) { }
```

### Deep Nesting → Early Returns

```typescript
// BEFORE: 4 levels deep
function process(data) {
  if (data) {
    if (data.valid) {
      if (data.items) {
        for (const item of data.items) {
          // actual logic here
        }
      }
    }
  }
}

// AFTER: 1 level deep
function process(data) {
  if (!data?.valid || !data.items) return;

  for (const item of data.items) {
    // actual logic here
  }
}
```

## Anti-Patterns

- ❌ God objects/files (do everything)
- ❌ "Just one more line" (compound violations)
- ❌ "I'll split it later" (you won't)
- ❌ Deep inheritance hierarchies
- ❌ Complex conditionals without extraction
```

---

### security

**File**: `.claude/skills/security.md`

This skill is **dynamic** — it adapts based on detected languages (JS/TS and Python sections are conditional).

**Template** (include JS/TS sections if `typescript` or `javascript` detected, Python sections if `python` detected):

```markdown
---
name: security
description: Security best practices, secrets management, OWASP patterns
globs:
  - "**/*"
---

# Security Best Practices

Security is not optional. Every project must pass security checks.

## Required .gitignore Entries

**NEVER commit these:**

```gitignore
# Environment files
.env
.env.*
!.env.example

# Secrets and credentials
*.pem
*.key
*.p12
credentials.json
secrets.json
*-credentials.json
service-account*.json

# IDE secrets
.idea/
.vscode/settings.json
```

## Environment Variables

### Create .env.example

Document required vars without values:

```bash
# Server-side only (never expose to client)
DATABASE_URL=
API_SECRET_KEY=
ANTHROPIC_API_KEY=

# Client-side safe (public, non-sensitive)
{JS: VITE_API_URL=\nNEXT_PUBLIC_SITE_URL=}
{Python: API_BASE_URL=}
```

{IF JS/TS: Include this section}
### Frontend Exposure Rules

| Framework | Client-Exposed Prefix | Server-Only |
|-----------|----------------------|-------------|
| Vite | `VITE_*` | No prefix |
| Next.js | `NEXT_PUBLIC_*` | No prefix |
| CRA | `REACT_APP_*` | N/A |

**CRITICAL:** Never put secrets in client-exposed env vars!

```typescript
// ❌ WRONG - Secret exposed to browser
const key = import.meta.env.VITE_API_SECRET;

// ✅ CORRECT - Secret stays server-side
const key = process.env.API_SECRET; // in API route only
```
{END IF}

### Validate at Startup

{IF JS/TS:}
```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

export const env = envSchema.parse(process.env);
```
{END IF}

{IF Python:}
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    api_secret_key: str
    environment: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
```
{END IF}

## OWASP Top 10 Checklist

| Vulnerability | Prevention |
|---------------|------------|
| Injection (SQL, NoSQL, Command) | Parameterized queries, input validation |
| Broken Auth | Secure session management, MFA |
| Sensitive Data Exposure | Encryption at rest and in transit |
| XXE | Disable external entity processing |
| Broken Access Control | Verify permissions on every request |
| Security Misconfiguration | Secure defaults, minimal permissions |
| XSS | Output encoding, CSP headers |
| Insecure Deserialization | Validate all serialized data |
| Using Vulnerable Components | Keep dependencies updated |
| Insufficient Logging | Log security events, monitor |

## Input Validation

```
RULE: Never trust user input. Validate everything.

- Validate type, length, format, range
- Sanitize before storage
- Encode before output
- Use allowlists over denylists
```

## Secrets Detection

Before committing, check for:

- API keys (usually 32+ chars, specific patterns)
- Passwords in code
- Connection strings with credentials
- Private keys (BEGIN RSA/EC/PRIVATE KEY)
- Tokens (jwt, bearer, oauth)

## Security Review Checklist

Before PR merge:

- [ ] No secrets in code or config
- [ ] Input validation on all user data
- [ ] Output encoding where displayed
- [ ] Authentication checked on protected routes
- [ ] Authorization verified for resources
- [ ] Dependencies scanned for vulnerabilities
- [ ] Error messages don't leak internals
```

---

## Framework Skills (Conditional)

### nextjs-patterns

**Condition**: Generate if `nextjs` framework detected.

**File**: `.claude/skills/nextjs-patterns.md`

```markdown
---
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
| `page.tsx` | Route UI |
| `layout.tsx` | Shared layout wrapper |
| `loading.tsx` | Loading UI (Suspense) |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 page |
| `route.ts` | API endpoint |

## Server vs Client Components

```tsx
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
```

## Data Fetching

```tsx
// Server Component - fetch directly
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  return <ProductDetails product={product} />;
}

// With caching
const getData = cache(async (id: string) => {
  return await db.find(id);
});
```

## Server Actions

```tsx
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
```

## Route Handlers

```tsx
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
```

## Patterns to Follow

1. **Default to Server Components** - Only use 'use client' when needed
2. **Colocate related files** - Keep components near their routes
3. **Use route groups** - `(auth)/login` for organization without URL impact
4. **Parallel routes** - `@modal/` for simultaneous rendering
5. **Intercepting routes** - `(.)/photo` for modal patterns
```

---

### react-components

**Condition**: Generate if `react` framework detected AND `nextjs` is NOT detected.

**File**: `.claude/skills/react-components.md`

```markdown
---
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

```tsx
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
```

## Hooks Patterns

```tsx
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
```

## State Management

```tsx
// Use reducer for complex state
const [state, dispatch] = useReducer(reducer, initialState);

// Use context for shared state
const ThemeContext = createContext<Theme>('light');
export const useTheme = () => useContext(ThemeContext);
```

## Performance

1. **Memoize expensive calculations**: `useMemo`
2. **Memoize callbacks**: `useCallback`
3. **Memoize components**: `React.memo`
4. **Avoid inline objects/arrays in props**

## Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';

test('button triggers action', () => {
  const onAction = vi.fn();
  render(<MyComponent title="Test" onAction={onAction} />);

  fireEvent.click(screen.getByRole('button'));

  expect(onAction).toHaveBeenCalled();
});
```
```

---

### fastapi-patterns

**Condition**: Generate if `fastapi` framework detected.

**File**: `.claude/skills/fastapi-patterns.md`

```markdown
---
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

```python
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
```

## Dependency Injection

```python
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
```

## Pydantic Schemas

```python
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
```

## Error Handling

```python
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
```

## Testing

```python
from fastapi.testclient import TestClient

def test_create_user(client: TestClient):
    response = client.post("/users/", json={
        "email": "test@example.com",
        "name": "Test",
        "password": "password123"
    })
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"
```
```

---

### nestjs-patterns

**Condition**: Generate if `nestjs` framework detected.

**File**: `.claude/skills/nestjs-patterns.md`

```markdown
---
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

```typescript
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
```

## Controller Pattern

```typescript
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
```

## Service Pattern

```typescript
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
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }
}
```

## DTO Validation

```typescript
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
```

## Testing

```typescript
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
```
```

---

### swiftui-patterns

**Condition**: Generate if `swiftui` framework detected.

**File**: `.claude/skills/swiftui-patterns.md`

```markdown
---
name: swiftui-patterns
description: SwiftUI declarative UI patterns and best practices
globs:
  - "**/*.swift"
---

# SwiftUI Patterns

## View Structure

```swift
import SwiftUI

struct ContentView: View {
    @State private var count = 0
    @StateObject private var viewModel = ContentViewModel()

    var body: some View {
        VStack(spacing: 16) {
            Text("Count: \(count)")
                .font(.title)

            Button("Increment") {
                count += 1
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
```

## Property Wrappers

| Wrapper | Use Case |
|---------|----------|
| `@State` | Simple value types owned by view |
| `@Binding` | Two-way connection to parent's state |
| `@StateObject` | Reference type owned by view (create once) |
| `@ObservedObject` | Reference type passed from parent |
| `@EnvironmentObject` | Shared data through view hierarchy |
| `@Environment` | System environment values |

## MVVM Pattern

```swift
// ViewModel
@MainActor
class UserViewModel: ObservableObject {
    @Published var users: [User] = []
    @Published var isLoading = false
    @Published var error: Error?

    private let service: UserService

    init(service: UserService = .shared) {
        self.service = service
    }

    func fetchUsers() async {
        isLoading = true
        defer { isLoading = false }

        do {
            users = try await service.getUsers()
        } catch {
            self.error = error
        }
    }
}

// View
struct UsersView: View {
    @StateObject private var viewModel = UserViewModel()

    var body: some View {
        List(viewModel.users) { user in
            UserRow(user: user)
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
            }
        }
        .task {
            await viewModel.fetchUsers()
        }
    }
}
```

## Navigation (iOS 16+)

```swift
struct AppNavigation: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HomeView()
                .navigationDestination(for: User.self) { user in
                    UserDetailView(user: user)
                }
                .navigationDestination(for: Settings.self) { settings in
                    SettingsView(settings: settings)
                }
        }
    }
}
```

## Async/Await Patterns

```swift
// Task modifier for view lifecycle
.task {
    await loadData()
}

// Task with cancellation
.task(id: searchText) {
    try? await Task.sleep(for: .milliseconds(300))
    await search(searchText)
}

// Refreshable
.refreshable {
    await viewModel.refresh()
}
```

## Best Practices

1. **Keep views small** - Extract subviews for reusability
2. **Use `@MainActor`** - For ViewModels updating UI
3. **Prefer value types** - Structs over classes when possible
4. **Use `.task`** - Instead of `.onAppear` for async work
5. **Preview extensively** - Use #Preview for rapid iteration
```

---

### uikit-patterns

**Condition**: Generate if `uikit` framework detected.

**File**: `.claude/skills/uikit-patterns.md`

```markdown
---
name: uikit-patterns
description: UIKit view controller patterns and best practices
globs:
  - "**/*.swift"
---

# UIKit Patterns

## View Controller Structure

```swift
import UIKit

class UserViewController: UIViewController {
    // MARK: - Properties
    private let viewModel: UserViewModel
    private var cancellables = Set<AnyCancellable>()

    // MARK: - UI Components
    private lazy var tableView: UITableView = {
        let table = UITableView()
        table.translatesAutoresizingMaskIntoConstraints = false
        table.delegate = self
        table.dataSource = self
        table.register(UserCell.self, forCellReuseIdentifier: UserCell.identifier)
        return table
    }()

    // MARK: - Lifecycle
    init(viewModel: UserViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupBindings()
        viewModel.fetchUsers()
    }

    // MARK: - Setup
    private func setupUI() {
        view.backgroundColor = .systemBackground
        view.addSubview(tableView)

        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupBindings() {
        viewModel.$users
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.tableView.reloadData()
            }
            .store(in: &cancellables)
    }
}
```

## Coordinator Pattern

```swift
protocol Coordinator: AnyObject {
    var childCoordinators: [Coordinator] { get set }
    var navigationController: UINavigationController { get set }
    func start()
}

class AppCoordinator: Coordinator {
    var childCoordinators: [Coordinator] = []
    var navigationController: UINavigationController

    init(navigationController: UINavigationController) {
        self.navigationController = navigationController
    }

    func start() {
        let vc = HomeViewController()
        vc.coordinator = self
        navigationController.pushViewController(vc, animated: false)
    }

    func showUserDetail(_ user: User) {
        let vc = UserDetailViewController(user: user)
        navigationController.pushViewController(vc, animated: true)
    }
}
```

## Table View Cell

```swift
class UserCell: UITableViewCell {
    static let identifier = "UserCell"

    private let nameLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI() {
        contentView.addSubview(nameLabel)
        NSLayoutConstraint.activate([
            nameLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            nameLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor)
        ])
    }

    func configure(with user: User) {
        nameLabel.text = user.name
    }
}
```

## Best Practices

1. **Use Auto Layout** - Programmatic constraints over Storyboards
2. **MARK comments** - Organize code sections
3. **Coordinator pattern** - For navigation logic
4. **Dependency injection** - Pass dependencies via init
5. **Combine for bindings** - Reactive updates from ViewModel
```

---

### vapor-patterns

**Condition**: Generate if `vapor` framework detected.

**File**: `.claude/skills/vapor-patterns.md`

```markdown
---
name: vapor-patterns
description: Vapor server-side Swift patterns
globs:
  - "**/*.swift"
  - "Package.swift"
---

# Vapor Patterns

## Route Structure

```swift
import Vapor

func routes(_ app: Application) throws {
    // Basic routes
    app.get { req in
        "Hello, world!"
    }

    // Route groups
    let api = app.grouped("api", "v1")

    // Controller registration
    try api.register(collection: UserController())
}
```

## Controller Pattern

```swift
import Vapor

struct UserController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")

        users.get(use: index)
        users.post(use: create)
        users.group(":userID") { user in
            user.get(use: show)
            user.put(use: update)
            user.delete(use: delete)
        }
    }

    // GET /users
    func index(req: Request) async throws -> [UserDTO] {
        try await User.query(on: req.db).all().map { $0.toDTO() }
    }

    // POST /users
    func create(req: Request) async throws -> UserDTO {
        let input = try req.content.decode(CreateUserInput.self)
        let user = User(name: input.name, email: input.email)
        try await user.save(on: req.db)
        return user.toDTO()
    }

    // GET /users/:userID
    func show(req: Request) async throws -> UserDTO {
        guard let user = try await User.find(req.parameters.get("userID"), on: req.db) else {
            throw Abort(.notFound)
        }
        return user.toDTO()
    }
}
```

## Fluent Models

```swift
import Fluent
import Vapor

final class User: Model, Content {
    static let schema = "users"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "name")
    var name: String

    @Field(key: "email")
    var email: String

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @Children(for: \.$user)
    var posts: [Post]

    init() {}

    init(id: UUID? = nil, name: String, email: String) {
        self.id = id
        self.name = name
        self.email = email
    }
}

// Migration
struct CreateUser: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("users")
            .id()
            .field("name", .string, .required)
            .field("email", .string, .required)
            .field("created_at", .datetime)
            .unique(on: "email")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("users").delete()
    }
}
```

## DTOs and Validation

```swift
struct CreateUserInput: Content, Validatable {
    var name: String
    var email: String

    static func validations(_ validations: inout Validations) {
        validations.add("name", as: String.self, is: !.empty)
        validations.add("email", as: String.self, is: .email)
    }
}

struct UserDTO: Content {
    var id: UUID?
    var name: String
    var email: String
}

extension User {
    func toDTO() -> UserDTO {
        UserDTO(id: id, name: name, email: email)
    }
}
```

## Middleware

```swift
struct AuthMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        guard let token = request.headers.bearerAuthorization?.token else {
            throw Abort(.unauthorized)
        }

        // Validate token
        let user = try await validateToken(token, on: request)
        request.auth.login(user)

        return try await next.respond(to: request)
    }
}
```

## Testing

```swift
@testable import App
import XCTVapor

final class UserTests: XCTestCase {
    var app: Application!

    override func setUp() async throws {
        app = Application(.testing)
        try configure(app)
        try await app.autoMigrate()
    }

    override func tearDown() async throws {
        try await app.autoRevert()
        app.shutdown()
    }

    func testCreateUser() async throws {
        try app.test(.POST, "api/v1/users", beforeRequest: { req in
            try req.content.encode(CreateUserInput(name: "Test", email: "test@example.com"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let user = try res.content.decode(UserDTO.self)
            XCTAssertEqual(user.name, "Test")
        })
    }
}
```
```

---

### compose-patterns

**Condition**: Generate if `jetpack-compose` framework detected.

**File**: `.claude/skills/compose-patterns.md`

```markdown
---
name: compose-patterns
description: Jetpack Compose UI patterns and best practices
globs:
  - "**/*.kt"
---

# Jetpack Compose Patterns

## Composable Structure

```kotlin
@Composable
fun UserScreen(
    viewModel: UserViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    UserScreenContent(
        uiState = uiState,
        onRefresh = viewModel::refresh,
        onUserClick = viewModel::selectUser
    )
}

@Composable
private fun UserScreenContent(
    uiState: UserUiState,
    onRefresh: () -> Unit,
    onUserClick: (User) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Users") })
        }
    ) { padding ->
        when (uiState) {
            is UserUiState.Loading -> LoadingIndicator()
            is UserUiState.Success -> UserList(
                users = uiState.users,
                onUserClick = onUserClick,
                modifier = Modifier.padding(padding)
            )
            is UserUiState.Error -> ErrorMessage(uiState.message)
        }
    }
}
```

## State Management

```kotlin
// UI State
sealed interface UserUiState {
    object Loading : UserUiState
    data class Success(val users: List<User>) : UserUiState
    data class Error(val message: String) : UserUiState
}

// ViewModel
@HiltViewModel
class UserViewModel @Inject constructor(
    private val repository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UserUiState>(UserUiState.Loading)
    val uiState: StateFlow<UserUiState> = _uiState.asStateFlow()

    init {
        loadUsers()
    }

    fun refresh() {
        loadUsers()
    }

    private fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UserUiState.Loading
            repository.getUsers()
                .onSuccess { users ->
                    _uiState.value = UserUiState.Success(users)
                }
                .onFailure { error ->
                    _uiState.value = UserUiState.Error(error.message ?: "Unknown error")
                }
        }
    }
}
```

## Reusable Components

```kotlin
@Composable
fun UserCard(
    user: User,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = user.avatarUrl,
                contentDescription = null,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = user.name,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
```

## Navigation

```kotlin
@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = "home"
    ) {
        composable("home") {
            HomeScreen(
                onUserClick = { userId ->
                    navController.navigate("user/$userId")
                }
            )
        }
        composable(
            route = "user/{userId}",
            arguments = listOf(navArgument("userId") { type = NavType.StringType })
        ) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId")
            UserDetailScreen(userId = userId)
        }
    }
}
```

## Theming

```kotlin
@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = Purple80,
            secondary = PurpleGrey80
        )
    } else {
        lightColorScheme(
            primary = Purple40,
            secondary = PurpleGrey40
        )
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
```

## Best Practices

1. **Stateless composables** - Pass state down, events up
2. **Remember wisely** - Use `remember` for expensive calculations
3. **Lifecycle-aware collection** - Use `collectAsStateWithLifecycle()`
4. **Modifier parameter** - Always accept Modifier as last parameter
5. **Preview annotations** - Add @Preview for rapid iteration
```

---

### android-views-patterns

**Condition**: Generate if `android-views` framework detected.

**File**: `.claude/skills/android-views-patterns.md`

```markdown
---
name: android-views-patterns
description: Android XML views and traditional patterns
globs:
  - "**/*.kt"
  - "**/*.xml"
---

# Android Views Patterns

## Activity Structure

```kotlin
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        observeViewModel()
    }

    private fun setupUI() {
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = userAdapter
        }

        binding.swipeRefresh.setOnRefreshListener {
            viewModel.refresh()
        }
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    updateUI(state)
                }
            }
        }
    }

    private fun updateUI(state: MainUiState) {
        binding.swipeRefresh.isRefreshing = state.isLoading
        userAdapter.submitList(state.users)
        binding.errorText.isVisible = state.error != null
        binding.errorText.text = state.error
    }
}
```

## Fragment Pattern

```kotlin
class UserFragment : Fragment(R.layout.fragment_user) {

    private var _binding: FragmentUserBinding? = null
    private val binding get() = _binding!!

    private val viewModel: UserViewModel by viewModels()
    private val args: UserFragmentArgs by navArgs()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        _binding = FragmentUserBinding.bind(view)

        setupUI()
        observeViewModel()
        viewModel.loadUser(args.userId)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
```

## RecyclerView Adapter

```kotlin
class UserAdapter(
    private val onItemClick: (User) -> Unit
) : ListAdapter<User, UserAdapter.ViewHolder>(UserDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemUserBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(
        private val binding: ItemUserBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        init {
            binding.root.setOnClickListener {
                onItemClick(getItem(adapterPosition))
            }
        }

        fun bind(user: User) {
            binding.nameText.text = user.name
            binding.emailText.text = user.email
            Glide.with(binding.avatar)
                .load(user.avatarUrl)
                .circleCrop()
                .into(binding.avatar)
        }
    }

    class UserDiffCallback : DiffUtil.ItemCallback<User>() {
        override fun areItemsTheSame(oldItem: User, newItem: User) =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: User, newItem: User) =
            oldItem == newItem
    }
}
```

## XML Layout

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <com.google.android.material.appbar.MaterialToolbar
        android:id="@+id/toolbar"
        android:layout_width="0dp"
        android:layout_height="?attr/actionBarSize"
        app:title="Users"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipeRefresh"
        android:layout_width="0dp"
        android:layout_height="0dp"
        app:layout_constraintTop_toBottomOf="@id/toolbar"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">

        <androidx.recyclerview.widget.RecyclerView
            android:id="@+id/recyclerView"
            android:layout_width="match_parent"
            android:layout_height="match_parent" />

    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>

</androidx.constraintlayout.widget.ConstraintLayout>
```

## ViewModel with Repository

```kotlin
@HiltViewModel
class UserViewModel @Inject constructor(
    private val repository: UserRepository,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(UserUiState())
    val uiState: StateFlow<UserUiState> = _uiState.asStateFlow()

    fun loadUsers() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val users = repository.getUsers()
                _uiState.update { it.copy(users = users, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }
}

data class UserUiState(
    val users: List<User> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)
```

## Best Practices

1. **View Binding** - Use over findViewById or synthetic imports
2. **Lifecycle awareness** - Collect flows in repeatOnLifecycle
3. **ListAdapter** - For efficient RecyclerView updates
4. **Navigation Component** - For fragment navigation
5. **Clean up bindings** - Set to null in onDestroyView
```
