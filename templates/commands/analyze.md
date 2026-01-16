---
name: analyze
description: Deep analysis of a specific area
arguments:
  - name: area
    description: The area or topic to analyze
    required: true
---

# /analyze - Deep Analysis

Analyze a specific area of the codebase.

## Instructions

1. **Determine scope**
   What does the user want analyzed?
   - A file or directory
   - A feature or system
   - A bug or issue
   - Architecture question

2. **Gather context**
   - Find relevant files
   - Read key code sections
   - Check related tests
   - Look at dependencies

3. **Analyze by type:**

   **Code Analysis**
   - Structure and organization
   - Dependencies and data flow
   - Patterns used
   - Potential issues

   **Bug Analysis**
   - Reproduce the issue
   - Trace the code path
   - Identify root cause
   - Suggest fixes

   **Architecture Analysis**
   - Component relationships
   - Data flow
   - External dependencies

4. **Report findings**
   Provide clear, actionable insights with `file:line` references.
