# Changelog

## [Unreleased]

### Changed
- **Claude-powered CLAUDE.md generation** - Replaced static string-concatenation CLAUDE.md generation with Claude CLI deep analysis
  - `npx claude-code-starter` now spawns `claude -p` to read actual source files and generate project-specific documentation
  - Claude CLI is now a hard requirement (exits with error + install link if missing)
  - Removed `generateClaudeMd()` and all static CLAUDE.md generation code
  - Removed `--static` / `-s` flag (no fallback mode)
  - Supporting files (skills, agents, rules, commands, settings.json) are still generated statically

### Added
- `src/prompt.ts` - Embedded analysis prompt module with 3-phase protocol (Discovery, Generation, Quality Check)
- `checkClaudeCli()` - Verifies Claude CLI is installed before proceeding
- `runClaudeAnalysis()` - Spawns Claude CLI with `--allowedTools` for safe, scoped file access
- ESM entry point guard - `main()` only runs when executed directly, not when imported by tests

### Removed
- `generateClaudeMd()` function from generator.ts (dead code - output was never written)
- `getCommonCommands()` function from generator.ts (only used by removed `generateClaudeMd`)
- Duplicate `formatLanguage()` / `formatFramework()` from generator.ts (already exist in cli.ts)
- `"claude-md"` artifact type from `GeneratedArtifact` union
- 13 tests that validated static CLAUDE.md content generation
- `static` field from `Args` interface

## [0.3.0]

### Added
- Test coverage reporting and upload to Codecov
- Interactive prompts for new project setup
- Swift/iOS and Android/Kotlin pattern support
- Enhanced framework formatting with additional technology support

## [0.2.0]

### Changed
- **Converted to Bun** - Full migration from npm/Node.js to Bun for local development
  - Replaced vitest with `bun:test`
  - Updated all scripts to use `bun run`
  - Removed `package-lock.json` (using `bun.lock`)
  - Kept Node.js 18+ compatibility for distribution

- **Simplified project detection** - Removed hardcoded framework detection
  - Now relies on Claude to analyze projects directly
  - `detectProject()` only counts source files

- **Improved .gitignore handling** - Dynamic ignore patterns
  - Reads patterns from project's `.gitignore` file
  - Always ignores `.git` directory

- **Updated GitHub Actions**
  - `publish.yml`: Uses Bun for build/test, npm for publishing
  - `pages.yml`: Deploys only `docs/` folder

### Fixed
- **Critical**: Fixed `templates/settings.json` schema URL
  - Changed from `claude.ai/schemas/...` to `json.schemastore.org/...`

### Added
- `prepublishOnly` script - Ensures build and tests run before npm publish
- `docs/` folder - Technical documentation and GitHub Pages landing page
- `docs/ARCHITECTURE.md` - Technical overview
- `docs/CHANGELOG.md` - This file

## [0.1.0] - Initial Release

- CLI scaffolding for Claude Code projects
- Slash commands (/task, /status, /done, /analyze)
- Skills documentation (debugging, testing, patterns)
- Task state tracking
