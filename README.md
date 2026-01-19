# Claude Code Starter

A lightweight starter kit for AI-assisted development with Claude Code.

## Quick Start

```bash
cd your-project
npx claude-code-starter
claude
```

## What It Does

Sets up your project with:
- `.claude/CLAUDE.md` - Instructions for Claude
- `.claude/commands/` - Slash commands (`/task`, `/status`, `/done`, `/analyze`)
- `.claude/skills/` - Methodology guides (debugging, testing, patterns)
- `.claude/state/task.md` - Task tracking

## Commands

| Command | Description |
|---------|-------------|
| `/task <desc>` | Start a new task |
| `/status` | Show current task |
| `/done` | Mark task complete |
| `/analyze <area>` | Deep dive into code |

## Options

```bash
npx claude-code-starter --help     # Show help
npx claude-code-starter --force    # Overwrite existing files
```

## Tip

Add `.claude/` to your global gitignore:

```bash
echo ".claude/" >> ~/.gitignore
git config --global core.excludesfile ~/.gitignore
```

## License

MIT
