---
name: systematic-debugging
description: Language-agnostic debugging methodology
globs: ["**/*.log", "**/error*", "**/debug*", "**/logs/**/*", "src/**/*", "lib/**/*", "app/**/*"]
---

# Systematic Debugging

A 4-phase approach that works for any language or framework.

## Phase 1: Reproduce

**Goal**: Reliably trigger the bug.

1. Get exact steps from user/logs
2. Note the environment (versions, OS, configs)
3. Determine if consistent or intermittent
4. Find minimal reproduction case

```
Questions to ask:
- "What exactly happens vs what should happen?"
- "When did it start? What changed?"
- "Does it happen every time?"
```

## Phase 2: Locate

**Goal**: Find where the bug originates.

### With Error/Stack Trace
- Read stack trace from bottom to top
- Find first file in project code (not dependencies)
- That's usually the bug location

### Without Error (Silent Failure)
- Add logging at key points
- Use binary search: log at middle, narrow down
- Check inputs/outputs at each step

### Data Issues
- Log the actual data vs expected
- Check data transformations
- Verify API responses match expectations

## Phase 3: Diagnose

**Goal**: Understand WHY it's broken.

### Common Causes (Any Language)

**Data Issues**
- Null/undefined/nil access
- Wrong data type
- Missing or malformed data
- Encoding issues

**Timing Issues**
- Race conditions
- Async operations completing out of order
- Stale data/cache

**Logic Errors**
- Off-by-one errors
- Wrong comparison operators
- Missing edge cases
- Incorrect boolean logic

**Environment Issues**
- Missing environment variables
- Wrong file paths
- Permission issues
- Version mismatches

### Diagnostic Questions
1. What are the exact inputs?
2. What's the expected output?
3. Where does actual diverge from expected?
4. What assumptions might be wrong?

## Phase 4: Fix

**Goal**: Apply minimal, correct fix.

### Fix Criteria
- Addresses root cause, not symptom
- Doesn't break other functionality
- Handles related edge cases
- Is the simplest solution that works

### Verification Checklist
- [ ] Original bug is fixed
- [ ] Related tests pass
- [ ] No new issues introduced
- [ ] Edge cases handled
- [ ] Fix makes sense to explain

## Quick Reference

| Symptom | Check First |
|---------|-------------|
| "undefined" errors | Data flow, null checks |
| Intermittent failures | Async/timing, race conditions |
| Works locally, fails in prod | Environment, configs |
| Works for some users | User-specific data, permissions |
| Slow performance | N+1 queries, loops, memory |
| Silent failures | Error handling, logging |

## Debug Without Debugger

When you can't use a debugger:

```
1. Strategic logging at entry/exit points
2. Log input/output of suspect functions
3. Add timestamps for timing issues
4. Log state before/after mutations
5. Use conditional logging for specific cases
```
