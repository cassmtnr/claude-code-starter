# Changelog

## [Unreleased]

### Changed
- **Full Claude-powered content generation** - Claude now generates ALL `.claude/` content files, not just CLAUDE.md
  - `generator.ts` gutted from ~3050 lines to ~156 lines — only handles `settings.json` and directory creation
  - `prompt.ts` expanded to ~752 lines with a 7-phase protocol (Discovery, CLAUDE.md, Quality Check, Skills, Agents, Rules, Commands)
  - CLI flow changed from `generateArtifacts -> writeArtifacts` to `writeSettings + ensureDirectories -> Claude generates everything`
  - Claude CLI is a hard requirement (exits with error + install link if missing)
- **Expanded new project preferences** - `NewProjectPreferences` now includes `packageManager`, `testingFramework`, `linter`, `formatter`, `projectType`

### Added
- `src/prompt.ts` - Comprehensive multi-phase prompt module:
  - `getAnalysisPrompt()` composes all phases into a single prompt
  - `buildTemplateVariables()` builds context variables (test commands, lint commands, source globs)
  - `getTestCommand()`, `getLintCommand()`, `getSourceGlobs()` helpers
  - `ANALYSIS_PROMPT`, `SKILLS_PROMPT`, `AGENTS_PROMPT`, `RULES_PROMPT`, `COMMANDS_PROMPT` constants
- `ensureDirectories()` in generator.ts — creates `.claude/` subdirectory structure
- `writeSettings()` in generator.ts — writes `settings.json` to disk
- `createTaskFile()` in cli.ts — creates initial task tracking file
- `checkClaudeCli()` - Verifies Claude CLI is installed before proceeding
- `runClaudeAnalysis()` - Spawns Claude CLI with `--allowedTools` for safe, scoped file access
- ESM entry point guard - `main()` only runs when executed directly, not when imported by tests

### Removed
- `GeneratedArtifact` interface from types.ts
- `GenerationResult` interface from types.ts
- `generateArtifacts()` from generator.ts
- `writeArtifacts()` from generator.ts
- `generateSkills()`, `generateAgents()`, `generateRules()`, `generateCommands()` from generator.ts
- `generateClaudeMd()`, `getCommonCommands()` from generator.ts
- All hardcoded markdown templates (~2900 lines of static content)
- `"claude-md"` artifact type
- `--static` / `-s` flag
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
