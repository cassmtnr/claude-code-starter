---
name: testing-methodology
description: Language-agnostic testing approach
globs: ["**/*.test.*", "**/*.spec.*", "**/*_test.*", "__tests__/**/*", "tests/**/*", "test/**/*"]
---

# Testing Methodology

A framework-agnostic approach to writing effective tests.

## First: Check Existing Tests

Before writing tests:
1. Find existing test files in the project
2. Study their structure and style
3. Match the existing patterns exactly
4. Use the same testing framework

## Test Structure (AAA Pattern)

Works in any language:

```
Test: [what you're testing]

  Arrange:
    - Set up test data
    - Configure mocks/stubs
    - Prepare dependencies

  Act:
    - Execute the code under test
    - Capture the result

  Assert:
    - Verify the result matches expected
    - Check side effects if any
```

## What to Test

### Always Test
- Core business logic
- Data transformations
- Edge cases and boundaries
- Error handling paths
- Public API contracts

### Sometimes Test
- Integration points
- Complex UI interactions
- Database operations

### Rarely Test
- Framework code
- Simple getters/setters
- Configuration
- Third-party libraries

## Test Naming

Be descriptive about:
1. What is being tested
2. Under what conditions
3. What is expected

```
Good: "creates user when email is valid"
Bad: "test1" or "user test"
```

## Mocking Strategy

### Mock When
- External services (APIs, databases)
- Time-dependent code
- Random/non-deterministic behavior
- Slow operations

### Don't Mock
- The code you're testing
- Simple utility functions
- When you can use real implementations

## Test Data

### Good Test Data
- Minimal but complete
- Clearly shows the test case
- Uses realistic values
- Isolated per test

### Bad Test Data
- Shared between tests
- Uses magic numbers without context
- Overly complex for the test case

## Coverage Philosophy

Focus on:
- **Critical paths**: What breaks the app if it fails?
- **Complex logic**: Where are bugs likely?
- **Regression prevention**: What broke before?

Don't chase percentages - chase confidence.

## Test Maintenance

- Delete tests that don't add value
- Update tests when requirements change
- Keep tests fast (< 100ms unit tests)
- Make failures easy to diagnose
