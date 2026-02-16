# Rule Templates

Rule templates to generate in `.claude/rules/`.

## Table of Contents

- [TypeScript Rules (Conditional)](#typescript-rules)
- [Python Rules (Conditional)](#python-rules)
- [Code Style Rules (Always)](#code-style-rules)

---

## TypeScript Rules

**Condition**: Generate if `typescript` language detected.

**File**: `.claude/rules/typescript.md`

```markdown
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Rules

## Type Safety

- Avoid `any` - use `unknown` and narrow types
- Prefer interfaces for objects, types for unions/intersections
- Use strict mode (`strict: true` in tsconfig)
- Enable `noUncheckedIndexedAccess` for safer array access

## Patterns

```typescript
// Prefer
const user: User | undefined = users.find(u => u.id === id);
if (user) { /* use user */ }

// Avoid
const user = users.find(u => u.id === id) as User;
```

## Naming

- Interfaces: PascalCase (e.g., `UserProfile`)
- Types: PascalCase (e.g., `ApiResponse`)
- Functions: camelCase (e.g., `getUserById`)
- Constants: SCREAMING_SNAKE_CASE for true constants

## Imports

- Group imports: external, internal, relative
- Use path aliases when configured
- Prefer named exports over default exports
```

---

## Python Rules

**Condition**: Generate if `python` language detected.

**File**: `.claude/rules/python.md`

```markdown
---
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

```python
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
```

## Naming

- Functions/variables: snake_case
- Classes: PascalCase
- Constants: SCREAMING_SNAKE_CASE
- Private: _leading_underscore

## Imports

```python
# Standard library
import os
from pathlib import Path

# Third-party
from fastapi import FastAPI
from pydantic import BaseModel

# Local
from app.models import User
from app.services import UserService
```
```

---

## Code Style Rules

**Condition**: Always generate.

**File**: `.claude/rules/code-style.md`

This rule is **dynamic** — it references the detected formatter and linter.

### Template

Replace `{FORMATTER}` and `{LINTER}` with detected values. If none detected, use the generic fallback text.

```markdown
# Code Style

## General Principles

1. **Clarity over cleverness** - Code is read more than written
2. **Consistency** - Match existing patterns in the codebase
3. **Simplicity** - Prefer simple solutions over complex ones

## Formatting

{IF FORMATTER: This project uses **{FORMATTER}** for formatting. Run it before committing.}
{IF NO FORMATTER: Format code consistently with the existing codebase.}

{IF LINTER: This project uses **{LINTER}** for linting. Fix all warnings.}

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
```
