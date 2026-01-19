# Current Task

## Status: Completed

**Task:** Move CLAUDE.md inside .claude folder for both new and existing projects

## Summary

The CLI now creates `CLAUDE.md` inside the `.claude/` folder instead of at the project root. This provides cleaner project organization by keeping all Claude-related files under a single directory.

## Files Changed

- `src/cli.ts` - Updated copy destination and help text
- `README.md` - Updated "What It Does" section
- `docs/ARCHITECTURE.md` - Updated directory structure diagrams
- `docs/index.html` - Updated feature card
- `CLAUDE.md` → `.claude/CLAUDE.md` - Moved for this project

## Follow-up

- None (tests pass, build succeeds)

## Decisions

- CLAUDE.md placed at `.claude/CLAUDE.md` for both new and existing projects
- Template remains at `templates/CLAUDE.md` (only destination changed)
