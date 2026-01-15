# Claude Code Starter

A lightweight starter kit for AI-assisted development with Claude Code.

**Version:** 0.0.8

## Quick Start

```bash
cd /path/to/your-project
npx claude-code-starter
claude
```

## CLI Options

```bash
npx claude-code-starter --help      # Show help message
npx claude-code-starter --version   # Show version number
npx claude-code-starter --force     # Force overwrite CLAUDE.md and settings.json
```

---

## Examples

### Example 1: New Project

```bash
mkdir my-new-app
cd my-new-app
npx claude-code-starter
```

Output:
```
╔═══════════════════════════════════════╗
║   Claude Code Starter v0.0.8        ║
╚═══════════════════════════════════════╝

Setting up framework files...
  Created CLAUDE.md
  Created .claude/settings.json
  Updated .claude/commands/
  Updated .claude/skills/

New project detected

What are you building?
> A REST API for managing todo items

Ready! Run claude to start working on: A REST API for managing todo items

Tip: Add .claude/ to your global .gitignore
```

Then:
```bash
claude
```

Claude will start with context about your task and begin helping you build it.

---

### Example 2: Existing Project

```bash
cd /path/to/my-express-app
npx claude-code-starter
```

Output:
```
╔═══════════════════════════════════════╗
║   Claude Code Starter v0.0.8        ║
╚═══════════════════════════════════════╝

Setting up framework files...
  Created CLAUDE.md
  Created .claude/settings.json
  Updated .claude/commands/
  Updated .claude/skills/

Detected existing project
Tech stack: Node.js TypeScript

Analyzing codebase...

  Files: 47 source files
  Directories: src/ lib/ tests/
  Frameworks: Express

Ready! Run claude to start.

Tip: Add .claude/ to your global .gitignore
```

---

### Example 3: Starting a Task

```
You: /task Add user authentication with JWT

Claude: I'll set up JWT authentication. Let me first understand your current
        project structure...

        [Claude reads files, creates a plan, updates .claude/state/task.md]

        I've analyzed your project. Here's my plan:

        1. Install dependencies (jsonwebtoken, bcrypt)
        2. Create auth middleware in src/middleware/auth.ts
        3. Add login/register endpoints
        4. Protect existing routes

        Starting with step 1...
```

---

### Example 4: Checking Status

```
You: /status

Claude: ## Current Status

        **Task:** Add user authentication with JWT
        **Status:** In Progress

        ### Progress
        - [x] Installed dependencies
        - [x] Created auth middleware
        - [ ] Add login/register endpoints
        - [ ] Protect existing routes

        ### Decisions Made
        - Using RS256 for JWT signing
        - Storing refresh tokens in httpOnly cookies

        ### Next Steps
        Creating the login endpoint in src/routes/auth.ts
```

---

### Example 5: Completing a Task

```
You: /done

Claude: ## Task Complete

        **Task:** Add user authentication with JWT

        ### Summary
        Implemented full JWT authentication system with:
        - Login/register endpoints
        - Token refresh mechanism
        - Protected route middleware

        ### Files Changed
        - src/middleware/auth.ts (new)
        - src/routes/auth.ts (new)
        - src/routes/index.ts (modified)
        - package.json (modified)

        ### Follow-up
        - Consider adding rate limiting to auth endpoints
        - Add password reset functionality

        State cleared. Ready for next task.
```

---

### Example 6: Deep Analysis

```
You: /analyze authentication flow

Claude: ## Analysis: Authentication Flow

        ### Entry Points
        - `POST /api/auth/login` → src/routes/auth.ts:23
        - `POST /api/auth/register` → src/routes/auth.ts:45
        - `POST /api/auth/refresh` → src/routes/auth.ts:67

        ### Middleware Chain
        1. `validateBody()` → src/middleware/validate.ts:12
        2. `authMiddleware()` → src/middleware/auth.ts:8

        ### Token Flow
        ```
        Login Request
            ↓
        Validate credentials (bcrypt.compare)
            ↓
        Generate access token (15min) + refresh token (7d)
            ↓
        Set refresh token as httpOnly cookie
            ↓
        Return access token in response body
        ```

        ### Potential Issues
        - No rate limiting on login attempts
        - Refresh tokens not stored in DB (can't revoke)

        ### Recommendations
        1. Add rate limiting with express-rate-limit
        2. Store refresh tokens in Redis for revocation
```

---

### Example 7: Resuming Work

When you close Claude and come back later:

```bash
claude
```

Claude reads `.claude/state/task.md` (as instructed by CLAUDE.md) and continues:

```
Claude: Welcome back. I see you were working on:

        **Task:** Add user authentication with JWT
        **Status:** In Progress

        Last time we completed the auth middleware. Next step is
        creating the login endpoint.

        Should I continue with that?
```

---

### Example 8: Using Skills

Skills are referenced when relevant. You can also ask directly:

```
You: I'm debugging why login fails for some users. Help me use
     the systematic debugging approach.

Claude: I'll follow the systematic debugging methodology.

        ### 1. Reproduce
        First, let me understand the failure pattern...
        - Which users fail? New users? Existing users?
        - Any error messages in logs?

        ### 2. Isolate
        [Claude narrows down the issue]

        ### 3. Trace
        Looking at the code path:
        - src/routes/auth.ts:23 → login handler
        - src/services/auth.ts:15 → validatePassword
        ...

        ### 4. Root Cause
        Found it: The password comparison fails for users migrated
        from the old system because they use MD5 hashing, not bcrypt.

        ### 5. Fix
        I'll add a migration check in the login flow...
```

---

### Example 9: Pattern Discovery

```
You: I need to add a new API endpoint. What patterns does this
     project use?

Claude: Let me analyze the existing patterns...

        ### API Endpoint Pattern
        Based on src/routes/*.ts:

        ```typescript
        // Pattern: Route files export a router
        import { Router } from 'express';
        import { validateBody } from '../middleware/validate';
        import { schema } from '../schemas/resourceSchema';

        const router = Router();

        router.post('/',
          validateBody(schema),
          async (req, res, next) => {
            try {
              const result = await service.create(req.body);
              res.status(201).json(result);
            } catch (error) {
              next(error);
            }
          }
        );

        export default router;
        ```

        ### Conventions Found
        - Validation middleware before handlers
        - Async handlers with try/catch
        - Services handle business logic
        - 201 for creates, 200 for updates

        Should I create your new endpoint following this pattern?
```

---

### Example 10: Multi-Step Feature

```
You: /task Build a complete user profile feature with avatar upload

Claude: This is a multi-step feature. I'll break it down:

        ## Plan

        1. **Database**: Add profile fields to User model
        2. **Storage**: Set up file upload for avatars
        3. **API**: Create profile endpoints (GET/PATCH)
        4. **Validation**: Add profile update schema
        5. **Tests**: Write tests for new endpoints

        I'll update state as we complete each step.

        Starting with the database changes...

        [After completing step 1]

        ✓ Step 1 complete. Updated .claude/state/task.md

        Moving to step 2: Setting up avatar uploads...
```

---

## Structure

After init, your project has:

```
your-project/
├── CLAUDE.md              # Instructions for Claude
└── .claude/
    ├── .version           # Framework version
    ├── settings.json      # Permissions
    ├── commands/          # Slash commands
    │   ├── task.md
    │   ├── status.md
    │   ├── done.md
    │   └── analyze.md
    ├── skills/            # Reference guides
    │   ├── pattern-discovery.md
    │   ├── systematic-debugging.md
    │   └── testing-methodology.md
    └── state/
        └── task.md        # Current task state
```

## Commands

| Command | What it does |
|---------|-------------|
| `/task <desc>` | Start working on something |
| `/status` | Show current task |
| `/done` | Mark task complete |
| `/analyze <area>` | Deep dive into code |

## Skills

The framework includes methodology guides in `.claude/skills/`:

| Skill | Use When |
|-------|----------|
| **pattern-discovery.md** | Adding new code that should match existing patterns |
| **systematic-debugging.md** | Investigating bugs or unexpected behavior |
| **testing-methodology.md** | Writing tests or improving test coverage |

Claude references these when the situation calls for it.

## State Management

All state lives in `.claude/state/task.md`. Example:

```markdown
# Current Task

## Status: In Progress

**Task:** Add user authentication

## Context

Building JWT-based auth for the Express API.

## Next Steps

1. Create auth middleware
2. Add login endpoint
3. Test

## Decisions

- Using RS256 for JWT signing
- Refresh tokens in httpOnly cookies
- Access tokens expire in 15 minutes
```

When you resume a session, Claude reads this file and continues where you left off.

## Global .gitignore

Add `.claude/` to your global gitignore so it's ignored in all projects:

```bash
echo ".claude/" >> ~/.gitignore
git config --global core.excludesfile ~/.gitignore
```

## Permissions

The `settings.json` pre-approves common dev commands:

- **Git**: status, diff, log, add, commit, etc.
- **Package managers**: npm, yarn, pnpm, bun, pip, cargo
- **Build tools**: node, tsc, make, docker
- **Test runners**: jest, vitest
- **Linters**: eslint, prettier

Edit `.claude/settings.json` to customize for your stack.

## Troubleshooting

### Init script fails on macOS

The script is compatible with Bash 3.x (macOS default). If you see errors, check your bash version:

```bash
bash --version
```

### Commands not recognized

If `/task`, `/status`, etc. don't work:

1. Check that `.claude/commands/` exists in your project
2. Verify files have YAML frontmatter (lines starting with `---`)
3. Re-run init to refresh command files

### Settings keep resetting

The init script preserves your `settings.json` if it exists. If it's being overwritten:

1. Check you're not running from inside the framework folder
2. Verify `.claude/settings.json` exists before running init

### Claude doesn't read task state

Make sure `CLAUDE.md` exists in your project root. It tells Claude to check `.claude/state/task.md` on startup.

### Framework version

Check your installed version:

```bash
cat .claude/.version
```

## Tips

1. **Be specific with tasks** - "Add login endpoint" is better than "work on auth"
2. **Check status often** - `/status` helps you and Claude stay aligned
3. **Let Claude update state** - Don't manually edit `.claude/state/task.md`
4. **Use analyze for exploration** - `/analyze` before diving into unfamiliar code
5. **Complete tasks properly** - `/done` creates a clean break for the next task
