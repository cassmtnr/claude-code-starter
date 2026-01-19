# Changelog

## [Unreleased]

### Changed
- **Converted to Bun** - Full migration from npm/Node.js to Bun for local development
  - Replaced vitest with `bun:test`
  - Updated all scripts to use `bun run`
  - Removed `package-lock.json` (using `bun.lock`)
  - Kept Node.js 18+ compatibility for distribution

- **Simplified project detection** - Removed hardcoded framework detection
  - Removed JavaScript framework checks (React, Vue, Next.js, etc.)
  - Removed tech stack detection (Python, Ruby, Go, etc.)
  - Now relies on Claude to analyze projects directly
  - `detectProject()` only counts source files

- **Improved .gitignore handling** - Dynamic ignore patterns
  - Reads patterns from project's `.gitignore` file
  - Always ignores `.git` directory
  - No more hardcoded ignore list

- **Updated GitHub Actions**
  - `publish.yml`: Uses Bun for build/test, npm for publishing
  - `pages.yml`: Deploys only `docs/` folder (not entire repo)

### Fixed
- **Critical**: Fixed `templates/settings.json` schema URL
  - Changed from `claude.ai/schemas/...` to `json.schemastore.org/...`
  - Previous URL caused validation errors for all users

### Added
- `prepublishOnly` script - Ensures build and tests run before npm publish
- `docs/` folder - Technical documentation and GitHub Pages landing page
- `docs/ARCHITECTURE.md` - Technical overview
- `docs/CHANGELOG.md` - This file

### Improved
- `.gitignore` - Added `.env*`, `.vscode/`, `.idea/`, `coverage/`

## [0.1.0] - Previous Release

Initial release with:
- CLI scaffolding for Claude Code projects
- Slash commands (/task, /status, /done, /analyze)
- Skills documentation (debugging, testing, patterns)
- Task state tracking
