# Architecture

## Overview

Claude Code Starter is a CLI tool that scaffolds a `.claude/` directory structure for AI-assisted development with Claude Code.

```
your-project/
├── CLAUDE.md              # Instructions for Claude
└── .claude/
    ├── settings.json      # Claude Code permissions
    ├── .version           # Installed framework version
    ├── commands/          # Slash commands (/task, /status, etc.)
    ├── skills/            # Methodology guides
    └── state/
        └── task.md        # Current task tracking
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun (local dev) / Node.js 18+ (distribution) |
| Language | TypeScript |
| Build | tsup (ESM output) |
| Testing | bun:test |
| Package Manager | Bun |

## Project Structure

```
claude-code-starter/
├── src/
│   ├── cli.ts           # Main CLI entry point
│   └── cli.test.ts      # Unit tests
├── templates/           # Files copied to user projects
│   ├── CLAUDE.md
│   ├── settings.json
│   ├── commands/
│   ├── skills/
│   └── state/
├── docs/                # GitHub Pages & documentation
│   ├── index.html       # Landing page
│   ├── assets/
│   └── *.md             # Technical docs
├── dist/                # Built output (gitignored)
└── package.json
```

## Core Functions

### `src/cli.ts`

| Function | Purpose |
|----------|---------|
| `parseArgs(args)` | Parse CLI flags (-h, -v, -f) |
| `detectProject(dir)` | Count source files, respecting .gitignore |
| `copyFile(src, dest, force)` | Copy with skip/overwrite logic |
| `copyDir(src, dest)` | Recursive directory copy |
| `getVersion()` | Return package version |
| `getTemplatesDir()` | Return templates path |

### File Detection

The `detectProject` function:
1. Reads `.gitignore` patterns (if exists)
2. Always ignores `.git` directory
3. Counts files with common source extensions
4. Limits depth to 3 levels for performance

```typescript
const extensions = [
  ".js", ".ts", ".tsx", ".py", ".go", ".rs",
  ".java", ".rb", ".c", ".cpp", ".cs", ".swift", ".kt"
];
```

## Build & Test

```bash
# Development
bun run dev          # Watch mode

# Build
bun run build        # Compile to dist/

# Test
bun test             # Run all tests

# Type check
bun run typecheck    # TypeScript validation
```

## CI/CD

### Publish Workflow (`.github/workflows/publish.yml`)

Triggered on GitHub Release creation:
1. Extract version from tag
2. Install dependencies with Bun
3. Build and test
4. Publish to npm
5. Commit version bump to main

### Pages Workflow (`.github/workflows/pages.yml`)

Deploys `docs/` folder to GitHub Pages on push to main.

## Design Decisions

### Why Bun?
- Faster local development
- Built-in test runner (no vitest needed)
- Native TypeScript support

### Why Node.js compatibility?
- Broader user base can run via `npx`
- npm registry is the standard distribution channel

### Why no framework detection?
- Let Claude analyze the project directly
- Simpler, more maintainable code
- Works for any language/framework without hardcoding
