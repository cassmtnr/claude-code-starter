---
name: task
description: Start or switch to a new task
arguments:
  - name: description
    description: What you want to work on
    required: true
---

# /task - Start or Switch Task

Start a new task or switch focus.

## Instructions

1. **Check current state**
   - Read `.claude/state/task.md`
   - If task in progress, ask if user wants to save progress first

2. **Update task.md with:**

```markdown
# Current Task

## Status: In Progress

**Task:** [user's description]

## Context

[Brief context about what this involves]

## Next Steps

1. [First step]
2. [Second step]
3. ...

## Decisions

(None yet)
```

3. **Confirm and start**
   Tell user the task is set and begin working on it.

## Example

```
/task Add user authentication
```

Creates a new task and begins planning/implementation.
