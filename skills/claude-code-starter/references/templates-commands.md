# Command Templates

Command templates to generate in `.claude/commands/`. All 5 commands are always generated.

## Table of Contents

- [/task](#task)
- [/status](#status)
- [/done](#done)
- [/analyze](#analyze)
- [/code-review](#code-review)

---

## task

**File**: `.claude/commands/task.md`

```markdown
---
allowed-tools: Read, Write, Edit, Glob, Grep
argument-hint: [task description]
description: Start or switch to a new task
---

# Start Task

## Current State
!cat .claude/state/task.md 2>/dev/null || echo "No existing task"

## Your Task

Start or switch to the task: **$ARGUMENTS**

1. Read current state from `.claude/state/task.md`
2. If switching tasks, summarize previous progress
3. Update `.claude/state/task.md` with:
   - Status: In Progress
   - Task description
   - Initial context/understanding
   - Planned next steps

4. Begin working on the task
```

---

## status

**File**: `.claude/commands/status.md`

```markdown
---
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
```

---

## done

**File**: `.claude/commands/done.md`

```markdown
---
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
2. Update `.claude/state/task.md`:
   - Status: **Completed**
   - Summary of what was done
   - Files changed
   - Any follow-up items

3. Show git status/diff for review
```

---

## analyze

**File**: `.claude/commands/analyze.md`

```markdown
---
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
- `path/to/file.ts:10` - Purpose

### Patterns Found
- Pattern 1: Description
- Pattern 2: Description

### Dependencies
What this area depends on and what depends on it.

### Recommendations
Any improvements or concerns noted.
```

---

## code-review

**File**: `.claude/commands/code-review.md`

```markdown
---
allowed-tools: Read, Glob, Grep, Bash(git diff), Bash(git status), Bash(git log)
description: Review code changes for quality, security, and best practices
---

# Code Review

## Changes to Review

!git diff --stat HEAD~1 2>/dev/null || git diff --stat

## Review Process

Analyze all changes for:

### 1. Security (Critical)
- [ ] No secrets/credentials in code
- [ ] Input validation present
- [ ] Output encoding where needed
- [ ] Auth/authz checks on protected routes

### 2. Quality
- [ ] Functions ≤ 20 lines
- [ ] Files ≤ 200 lines
- [ ] No code duplication
- [ ] Clear naming
- [ ] Proper error handling

### 3. Testing
- [ ] Tests exist for new code
- [ ] Edge cases covered
- [ ] Tests are meaningful (not just for coverage)

### 4. Style
- [ ] Matches existing patterns
- [ ] Consistent formatting
- [ ] No commented-out code

## Output Format

For each finding, include file:line reference:

### Critical (Must Fix)
Issues that block merge

### Warning (Should Fix)
Issues that should be addressed

### Suggestion (Consider)
Optional improvements

## Summary

Provide:
1. Overall assessment (Ready / Changes Needed / Not Ready)
2. Count of findings by severity
3. Top priorities to address
```
