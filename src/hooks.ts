/**
 * @module hooks
 * @description Optional extras for Claude Code projects: safety hooks and statusline.
 *
 * - Safety hook: PreToolUse hook that blocks dangerous Bash commands
 * - Statusline: Custom status bar showing project, branch, context, model
 *
 * @example
 * import { installHook, installStatusline } from './hooks.js';
 *
 * installHook('/path/to/project');
 * installStatusline('/path/to/project');
 */

import fs from "node:fs";
import path from "node:path";

// ============================================================================
// Hook Script Content
// ============================================================================

/* eslint-disable no-useless-escape */
const HOOK_SCRIPT = String.raw`#!/usr/bin/env node
/**
 * Block Dangerous Commands - PreToolUse Hook for Bash
 * Blocks dangerous patterns before execution.
 *
 * SAFETY_LEVEL: 'critical' | 'high' | 'strict'
 *   critical - Only catastrophic: rm -rf ~, dd to disk, fork bombs
 *   high     - + risky: force push main, secrets exposure, git reset --hard
 *   strict   - + cautionary: any force push, sudo rm, docker prune
 */

const fs = require('fs');
const path = require('path');

const SAFETY_LEVEL = 'high';

const PATTERNS = [
  // CRITICAL — Catastrophic, unrecoverable

  // Filesystem destruction
  { level: 'critical', id: 'rm-home',          regex: /\brm\s+(-.+\s+)*["']?~\/?["']?(\s|$|[;&|])/,                        reason: 'rm targeting home directory' },
  { level: 'critical', id: 'rm-home-var',      regex: /\brm\s+(-.+\s+)*["']?\$HOME["']?(\s|$|[;&|])/,                      reason: 'rm targeting $HOME' },
  { level: 'critical', id: 'rm-home-trailing', regex: /\brm\s+.+\s+["']?(~\/?|\$HOME)["']?(\s*$|[;&|])/,                   reason: 'rm with trailing ~/ or $HOME' },
  { level: 'critical', id: 'rm-root',          regex: /\brm\s+(-.+\s+)*\/(\*|\s|$|[;&|])/,                                 reason: 'rm targeting root filesystem' },
  { level: 'critical', id: 'rm-system',        regex: /\brm\s+(-.+\s+)*\/(etc|usr|var|bin|sbin|lib|boot|dev|proc|sys)(\/|\s|$)/, reason: 'rm targeting system directory' },
  { level: 'critical', id: 'rm-cwd',           regex: /\brm\s+(-.+\s+)*(\.\/?|\*|\.\/\*)(\s|$|[;&|])/,                     reason: 'rm deleting current directory contents' },

  // Disk operations
  { level: 'critical', id: 'dd-disk',          regex: /\bdd\b.+of=\/dev\/(sd[a-z]|nvme|hd[a-z]|vd[a-z]|xvd[a-z])/,         reason: 'dd writing to disk device' },
  { level: 'critical', id: 'mkfs',             regex: /\bmkfs(\.\w+)?\s+\/dev\/(sd[a-z]|nvme|hd[a-z]|vd[a-z])/,            reason: 'mkfs formatting disk' },
  { level: 'critical', id: 'fdisk',            regex: /\b(fdisk|wipefs|parted)\s+\/dev\//,                                   reason: 'disk partitioning/wiping operation' },

  // Shell exploits
  { level: 'critical', id: 'fork-bomb',        regex: /:\(\)\s*\{.*:\s*\|\s*:.*&/,                                         reason: 'fork bomb detected' },

  // Git — history destruction
  { level: 'critical', id: 'git-filter',       regex: /\bgit\s+(filter-branch|filter-repo)\b/,                              reason: 'git history rewriting blocked' },
  { level: 'critical', id: 'git-reflog-exp',   regex: /\bgit\s+(reflog\s+expire|gc\s+--prune|prune)\b/,                     reason: 'removes git recovery safety net' },

  // HIGH — Significant risk, data loss, security exposure

  // Remote code execution
  { level: 'high', id: 'curl-pipe-sh',         regex: /\b(curl|wget)\b.+\|\s*(ba)?sh\b/,                                   reason: 'piping URL to shell (RCE risk)' },

  // Git — destructive operations
  { level: 'high', id: 'git-force-main',       regex: /\bgit\s+push\b(?!.+--force-with-lease).+(--force|-f)\b.+\b(main|master)\b/, reason: 'force push to main/master' },
  { level: 'high', id: 'git-reset-hard',       regex: /\bgit\s+reset\s+--hard/,                                            reason: 'git reset --hard loses uncommitted work' },
  { level: 'high', id: 'git-clean-f',          regex: /\bgit\s+clean\s+(-\w*f|-f)/,                                        reason: 'git clean -f deletes untracked files' },
  { level: 'high', id: 'git-no-verify',        regex: /\bgit\b.+--no-verify/,                                              reason: '--no-verify skips safety hooks' },
  { level: 'high', id: 'git-stash-destruct',   regex: /\bgit\s+stash\s+(drop|clear|pop)\b/,                                reason: 'destructive git stash operation' },
  { level: 'high', id: 'git-branch-D',         regex: /\bgit\s+branch\s+(-D|--delete\s+--force)\b/,                        reason: 'git branch -D force-deletes branch' },
  { level: 'high', id: 'git-checkout-force',   regex: /\bgit\s+checkout\s+(-f|--\s+\.)/,                                   reason: 'git checkout -f/-- . discards changes' },
  { level: 'high', id: 'git-restore-destruct', regex: /\bgit\s+restore\s+(--staged\s+--worktree|\.)/,                      reason: 'git restore discards changes' },
  { level: 'high', id: 'git-update-ref',       regex: /\bgit\s+(update-ref|symbolic-ref|replace)\b/,                       reason: 'git ref manipulation blocked' },
  { level: 'high', id: 'git-config-global',    regex: /\bgit\s+config\s+--(global|system)\b/,                              reason: 'git global/system config blocked' },
  { level: 'high', id: 'git-tag-delete',       regex: /\bgit\s+tag\s+(-d|--delete)\b/,                                    reason: 'git tag deletion blocked' },

  // Git — write operations (user handles manually)
  { level: 'high', id: 'git-push',             regex: /\bgit\s+push\b/,                                                    reason: 'git push blocked — user handles manually' },
  { level: 'high', id: 'git-pull',             regex: /\bgit\s+pull\b/,                                                    reason: 'git pull blocked — user handles manually' },
  { level: 'high', id: 'git-fetch',            regex: /\bgit\s+fetch\b/,                                                   reason: 'git fetch blocked — user handles manually' },
  { level: 'high', id: 'git-clone',            regex: /\bgit\s+clone\b/,                                                   reason: 'git clone blocked — user handles manually' },
  { level: 'high', id: 'git-add',              regex: /\bgit\s+(add|stage)\b/,                                             reason: 'git add/stage blocked — user handles manually' },
  { level: 'high', id: 'git-commit',           regex: /\bgit\s+commit\b/,                                                  reason: 'git commit blocked — user handles manually' },
  { level: 'high', id: 'git-merge',            regex: /\bgit\s+merge\b/,                                                   reason: 'git merge blocked — user handles manually' },
  { level: 'high', id: 'git-rebase',           regex: /\bgit\s+rebase\b/,                                                  reason: 'git rebase blocked — user handles manually' },
  { level: 'high', id: 'git-reset',            regex: /\bgit\s+reset\b/,                                                   reason: 'git reset blocked — user handles manually' },
  { level: 'high', id: 'git-remote-mod',       regex: /\bgit\s+remote\s+(add|set-url|remove)\b/,                           reason: 'git remote modification blocked' },
  { level: 'high', id: 'git-submodule',        regex: /\bgit\s+submodule\s+(add|update)\b/,                                reason: 'git submodule operation blocked' },

  // Credentials & secrets
  { level: 'high', id: 'chmod-777',            regex: /\bchmod\b.+\b777\b/,                                                reason: 'chmod 777 is a security risk' },
  { level: 'high', id: 'cat-env',              regex: /\b(cat|less|head|tail|more)\s+\.env\b/,                             reason: 'reading .env file exposes secrets' },
  { level: 'high', id: 'cat-secrets',          regex: /\b(cat|less|head|tail|more)\b.+(credentials|secrets?|\.pem|\.key|id_rsa|id_ed25519)/i, reason: 'reading secrets file' },
  { level: 'high', id: 'env-dump',             regex: /\b(printenv|^env)\s*([;&|]|$)/,                                     reason: 'env dump may expose secrets' },
  { level: 'high', id: 'echo-secret',          regex: /\becho\b.+\$\w*(SECRET|KEY|TOKEN|PASSWORD|API_|PRIVATE)/i,          reason: 'echoing secret variable' },
  { level: 'high', id: 'rm-ssh',               regex: /\brm\b.+\.ssh\/(id_|authorized_keys|known_hosts)/,                  reason: 'deleting SSH keys' },
  { level: 'high', id: 'security-keychain',    regex: /\bsecurity\s+find-generic-password\b/,                              reason: 'keychain access blocked' },
  { level: 'high', id: 'gpg-export-secret',    regex: /\bgpg\s+--export-secret-keys\b/,                                   reason: 'GPG secret key export blocked' },
  { level: 'high', id: 'history-cmd',          regex: /\bhistory\b/,                                                       reason: 'history may expose secrets' },

  // Destructive system commands
  { level: 'high', id: 'elevated-priv',        regex: /\b(sudo|doas|pkexec)\b/,                                            reason: 'elevated privilege command blocked' },
  { level: 'high', id: 'su-cmd',               regex: /\bsu\b/,                                                            reason: 'su (switch user) blocked' },
  { level: 'high', id: 'chmod-R',              regex: /\bchmod\s+(-\w*R|-R)/,                                              reason: 'recursive chmod blocked' },
  { level: 'high', id: 'chown-R',              regex: /\bchown\s+(-\w*R|-R)/,                                              reason: 'recursive chown blocked' },
  { level: 'high', id: 'kill-all',             regex: /\bkill\s+-9\s+-1\b/,                                                reason: 'kill all processes blocked' },
  { level: 'high', id: 'killall',              regex: /\b(killall|pkill\s+-9)\b/,                                          reason: 'mass process killing blocked' },
  { level: 'high', id: 'truncate-zero',        regex: /\btruncate\s+-s\s*0\b/,                                             reason: 'truncating file to zero blocked' },
  { level: 'high', id: 'empty-file',           regex: /\bcat\s+\/dev\/null\s*>/,                                           reason: 'emptying file via /dev/null blocked' },
  { level: 'high', id: 'crontab-r',            regex: /\bcrontab\s+-r/,                                                    reason: 'removes all cron jobs' },

  // Docker
  { level: 'high', id: 'docker-vol-rm',        regex: /\bdocker\s+volume\s+(rm|prune)/,                                    reason: 'docker volume deletion loses data' },
  { level: 'high', id: 'docker-push',          regex: /\bdocker\s+push\b/,                                                 reason: 'docker push blocked' },
  { level: 'high', id: 'docker-rm-all',        regex: /\bdocker\s+rm\s+-f\b.+\$\(docker\s+ps/,                             reason: 'docker rm all containers blocked' },
  { level: 'high', id: 'docker-sys-prune-a',   regex: /\bdocker\s+system\s+prune\s+-a/,                                    reason: 'docker system prune -a blocked' },
  { level: 'high', id: 'docker-compose-destr', regex: /\bdocker[\s-]compose\s+down\s+(-v|--rmi)/,                           reason: 'docker-compose destructive down blocked' },

  // Publishing & deployment
  { level: 'high', id: 'npm-publish',          regex: /\bnpm\s+(publish|unpublish|deprecate)\b/,                            reason: 'npm publishing blocked' },
  { level: 'high', id: 'npm-audit-force',      regex: /\bnpm\s+audit\s+fix\s+--force\b/,                                   reason: 'npm audit fix --force can break deps' },
  { level: 'high', id: 'cargo-publish',        regex: /\bcargo\s+publish\b/,                                               reason: 'cargo publish blocked' },
  { level: 'high', id: 'pip-twine-upload',     regex: /\b(pip|twine)\s+upload\b/,                                          reason: 'Python package upload blocked' },
  { level: 'high', id: 'gem-push',             regex: /\bgem\s+push\b/,                                                    reason: 'gem push blocked' },
  { level: 'high', id: 'pod-push',             regex: /\bpod\s+trunk\s+push\b/,                                            reason: 'pod trunk push blocked' },
  { level: 'high', id: 'vercel-prod',          regex: /\bvercel\b.+--prod/,                                                reason: 'vercel production deploy blocked' },
  { level: 'high', id: 'netlify-prod',         regex: /\bnetlify\s+deploy\b.+--prod/,                                      reason: 'netlify production deploy blocked' },
  { level: 'high', id: 'fly-deploy',           regex: /\bfly\s+deploy\b/,                                                  reason: 'fly deploy blocked' },
  { level: 'high', id: 'firebase-deploy',      regex: /\bfirebase\s+deploy\b/,                                             reason: 'firebase deploy blocked' },
  { level: 'high', id: 'terraform',            regex: /\bterraform\s+(apply|destroy)\b/,                                   reason: 'terraform apply/destroy blocked' },
  { level: 'high', id: 'pulumi-cdktf',         regex: /\b(pulumi|cdktf)\s+destroy\b/,                                      reason: 'infrastructure destroy blocked' },
  { level: 'high', id: 'kubectl-mutate',       regex: /\bkubectl\s+(apply|delete|drain)\b/,                                reason: 'kubectl mutating operation blocked' },
  { level: 'high', id: 'kubectl-scale-zero',   regex: /\bkubectl\s+scale\b.+--replicas=0/,                                 reason: 'kubectl scale to zero blocked' },
  { level: 'high', id: 'helm-ops',             regex: /\bhelm\s+(install|uninstall|upgrade)\b/,                             reason: 'helm operation blocked' },
  { level: 'high', id: 'heroku',               regex: /\bheroku\b/,                                                        reason: 'heroku command blocked' },
  { level: 'high', id: 'eb-terminate',         regex: /\beb\s+terminate\b/,                                                reason: 'eb terminate blocked' },
  { level: 'high', id: 'serverless-remove',    regex: /\bserverless\s+remove\b/,                                           reason: 'serverless remove blocked' },
  { level: 'high', id: 'cap-prod-deploy',      regex: /\bcap\s+production\s+deploy\b/,                                     reason: 'production deploy blocked' },
  { level: 'high', id: 'cloud-delete',         regex: /\b(aws\s+cloudformation\s+delete-stack|gcloud\s+projects\s+delete|az\s+group\s+delete)\b/, reason: 'cloud resource deletion blocked' },

  // Network & infrastructure
  { level: 'high', id: 'curl-mutating',        regex: /\bcurl\b.+-X\s*(POST|PUT|DELETE|PATCH)\b/,                          reason: 'mutating HTTP request blocked' },
  { level: 'high', id: 'ssh-remote',           regex: /\bssh\s/,                                                           reason: 'SSH remote connection blocked' },
  { level: 'high', id: 'scp-remote',           regex: /\bscp\s/,                                                           reason: 'SCP remote copy blocked' },
  { level: 'high', id: 'rsync-delete',         regex: /\brsync\b.+--delete/,                                               reason: 'rsync --delete blocked' },
  { level: 'high', id: 'firewall',             regex: /\b(iptables\s+-F|ufw\s+disable)\b/,                                 reason: 'firewall manipulation blocked' },
  { level: 'high', id: 'network-kill',         regex: /\bifconfig\s+\w+\s+down\b/,                                         reason: 'network interface down blocked' },
  { level: 'high', id: 'route-delete',         regex: /\broute\s+del\s+default\b/,                                         reason: 'default route deletion blocked' },

  // Database
  { level: 'high', id: 'sql-drop',             regex: /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE\s+TABLE)\b/i,                   reason: 'SQL drop/truncate blocked' },
  { level: 'high', id: 'sql-mass-delete',      regex: /\bDELETE\s+FROM\b.+\bWHERE\s+1\s*=\s*1/i,                          reason: 'SQL mass delete blocked' },
  { level: 'high', id: 'redis-flush',          regex: /\bredis-cli\s+(FLUSHALL|FLUSHDB)\b/,                                reason: 'redis flush blocked' },
  { level: 'high', id: 'orm-reset',            regex: /\b(prisma\s+migrate\s+reset|rails\s+db:(drop|reset)|django\s+flush)\b/, reason: 'ORM database reset blocked' },
  { level: 'high', id: 'alembic-downgrade',    regex: /\balembic\s+downgrade\s+base\b/,                                    reason: 'alembic downgrade base blocked' },
  { level: 'high', id: 'mongo-drop',           regex: /\bmongosh\b.+dropDatabase/,                                         reason: 'MongoDB drop database blocked' },

  // STRICT — Cautionary, context-dependent
  { level: 'strict', id: 'git-checkout-dot',    regex: /\bgit\s+checkout\s+\./,                                             reason: 'git checkout . discards changes' },
  { level: 'strict', id: 'docker-prune',        regex: /\bdocker\s+(system|image)\s+prune/,                                 reason: 'docker prune removes images' },
];

const LEVELS = { critical: 1, high: 2, strict: 3 };
const EMOJIS = { critical: '\u{1F6A8}', high: '\u26D4', strict: '\u26A0\uFE0F' };
const LOG_DIR = path.join(process.env.HOME || '/tmp', '.claude', 'hooks-logs');

function log(data) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, new Date().toISOString().slice(0, 10) + '.jsonl');
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...data }) + '\n');
  } catch {}
}

function checkCommand(cmd, safetyLevel) {
  safetyLevel = safetyLevel || SAFETY_LEVEL;
  const threshold = LEVELS[safetyLevel] || 2;
  for (const p of PATTERNS) {
    if (LEVELS[p.level] <= threshold && p.regex.test(cmd)) {
      return { blocked: true, pattern: p };
    }
  }
  return { blocked: false, pattern: null };
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input, session_id, cwd, permission_mode } = data;
    if (tool_name !== 'Bash') return console.log('{}');

    const cmd = tool_input?.command || '';
    const result = checkCommand(cmd);

    if (result.blocked) {
      const p = result.pattern;
      log({ level: 'BLOCKED', id: p.id, priority: p.level, cmd, session_id, cwd, permission_mode });
      return console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: EMOJIS[p.level] + ' [' + p.id + '] ' + p.reason
        }
      }));
    }
    console.log('{}');
  } catch (e) {
    log({ level: 'ERROR', error: e.message });
    console.log('{}');
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = { PATTERNS, LEVELS, SAFETY_LEVEL, checkCommand };
}
`;

// ============================================================================
// Hook Installation
// ============================================================================

import type { InstallStatus } from "./types.js";

/**
 * Check if the safety hook is already installed at project and global level.
 */
export function checkHookStatus(rootDir: string): InstallStatus {
  const homeDir = process.env.HOME || "";
  const projectScriptPath = path.join(rootDir, ".claude", "hooks", "block-dangerous-commands.js");
  const globalScriptPath = path.join(homeDir, ".claude", "hooks", "block-dangerous-commands.js");

  const result: InstallStatus = {
    projectInstalled: false,
    globalInstalled: false,
    projectMatchesOurs: false,
    globalMatchesOurs: false,
  };

  // Check project-level
  if (fs.existsSync(projectScriptPath)) {
    result.projectInstalled = true;
    try {
      const content = fs.readFileSync(projectScriptPath, "utf-8");
      result.projectMatchesOurs = content.trim() === HOOK_SCRIPT.trim();
    } catch {
      // Ignore read errors (race condition, permissions)
    }
  }

  // Check global-level
  if (fs.existsSync(globalScriptPath)) {
    result.globalInstalled = true;
    try {
      const content = fs.readFileSync(globalScriptPath, "utf-8");
      result.globalMatchesOurs = content.trim() === HOOK_SCRIPT.trim();
    } catch {
      // Ignore read errors (race condition, permissions)
    }
  }

  return result;
}

/**
 * Install the dangerous command hook into a project's .claude/ directory.
 * Creates the hook script and patches settings.json with the hook configuration.
 */
export function installHook(rootDir: string): void {
  const hooksDir = path.join(rootDir, ".claude", "hooks");
  const hookPath = path.join(hooksDir, "block-dangerous-commands.js");
  const settingsPath = path.join(rootDir, ".claude", "settings.json");

  // Write hook script
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, HOOK_SCRIPT);
  fs.chmodSync(hookPath, 0o755);

  // Patch settings.json with hook configuration
  try {
    const existing = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      : {};

    const newEntry = {
      matcher: "Bash",
      hooks: [
        {
          type: "command",
          command: "node .claude/hooks/block-dangerous-commands.js",
        },
      ],
    };

    const existingPreToolUse = Array.isArray(existing.hooks?.PreToolUse)
      ? existing.hooks.PreToolUse
      : [];

    const alreadyInstalled = existingPreToolUse.some(
      (e: { hooks?: { command?: string }[] }) =>
        Array.isArray(e.hooks) &&
        e.hooks.some((h) => h.command?.includes("block-dangerous-commands.js"))
    );

    existing.hooks = {
      ...existing.hooks,
      PreToolUse: alreadyInstalled ? existingPreToolUse : [...existingPreToolUse, newEntry],
    };

    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`  Warning: could not patch settings.json (${msg}) — add hook config manually`);
  }
}

/**
 * Install the dangerous command hook globally (~/.claude/).
 */
export function installHookGlobal(): void {
  const homeDir = process.env.HOME || "";
  const hooksDir = path.join(homeDir, ".claude", "hooks");
  const hookPath = path.join(hooksDir, "block-dangerous-commands.js");
  const settingsPath = path.join(homeDir, ".claude", "settings.json");

  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, HOOK_SCRIPT);
  fs.chmodSync(hookPath, 0o755);

  try {
    const existing = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      : {};

    const newEntry = {
      matcher: "Bash",
      hooks: [{ type: "command", command: "node ~/.claude/hooks/block-dangerous-commands.js" }],
    };

    const existingPreToolUse = Array.isArray(existing.hooks?.PreToolUse)
      ? existing.hooks.PreToolUse
      : [];

    const alreadyInstalled = existingPreToolUse.some(
      (e: { hooks?: { command?: string }[] }) =>
        Array.isArray(e.hooks) &&
        e.hooks.some((h) => h.command?.includes("block-dangerous-commands.js"))
    );

    existing.hooks = {
      ...existing.hooks,
      PreToolUse: alreadyInstalled ? existingPreToolUse : [...existingPreToolUse, newEntry],
    };

    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`  Warning: could not patch settings.json (${msg}) — add hook config manually`);
  }
}

// ============================================================================
// Statusline Script Content
// ============================================================================

// Statusline as a line array — avoids bash ${VAR} conflicting with JS template literals
const STATUSLINE_SCRIPT = [
  "#!/usr/bin/env bash",
  "# Claude Code statusline \u2014 portable, no runtime dependency beyond jq",
  "",
  "set -euo pipefail",
  "",
  "# Colors (using $'...' so escapes resolve at assignment, not at output time)",
  "RST=$'\\033[0m'",
  "CYAN=$'\\033[36m'",
  "MAGENTA=$'\\033[35m'",
  "BLUE=$'\\033[34m'",
  "GREEN=$'\\033[32m'",
  "YELLOW=$'\\033[33m'",
  "RED=$'\\033[31m'",
  "",
  "# Read JSON from stdin (Claude Code pipes session data)",
  'INPUT="$(cat)"',
  "",
  "# Parse fields with jq",
  'CWD="$(echo "$INPUT" | jq -r \'.workspace.current_dir // .cwd // ""\')"',
  'PROJECT="$(basename "$CWD")"',
  'SESSION_ID="$(echo "$INPUT" | jq -r \'.session_id // empty\')"',
  'SESSION_NAME="$(echo "$INPUT" | jq -r \'.session_name // empty\')"',
  'REMAINING="$(echo "$INPUT" | jq -r \'.context_window.remaining_percentage // empty\')"',
  'MODEL="$(echo "$INPUT" | jq -r \'.model.display_name // empty\')"',
  "",
  "# Line 1: [user] project [on branch]",
  'LINE1=""',
  'if [[ -n "${SSH_CONNECTION:-}" ]]; then',
  '    LINE1+="${BLUE}$(whoami)${RST} "',
  "fi",
  'LINE1+="${CYAN}${PROJECT}${RST}"',
  "",
  'BRANCH="$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || true)"',
  'if [[ -n "$BRANCH" ]]; then',
  '    LINE1+=" on ${MAGENTA}\u{1F331} ${BRANCH}${RST}"',
  "fi",
  "",
  "# Line 2: session + context + model",
  'PARTS=""',
  'if [[ -n "$SESSION_ID" ]]; then',
  '    if [[ -n "$SESSION_NAME" ]]; then',
  '        PARTS+="${MAGENTA}${SESSION_NAME} \u00B7 sid: ${SESSION_ID}${RST}"',
  "    else",
  '        PARTS+="${MAGENTA}sid: ${SESSION_ID}${RST}"',
  "    fi",
  "fi",
  "",
  'if [[ -n "$REMAINING" ]]; then',
  '    RND="${REMAINING%%.*}"',
  "    if (( RND < 20 )); then",
  '        CTX_COLOR="$RED"',
  "    elif (( RND < 50 )); then",
  '        CTX_COLOR="$YELLOW"',
  "    else",
  '        CTX_COLOR="$GREEN"',
  "    fi",
  '    [[ -n "$PARTS" ]] && PARTS+=" "',
  '    PARTS+="${CTX_COLOR}[ctx: ${RND}%]${RST}"',
  "fi",
  "",
  'if [[ -n "$MODEL" ]]; then',
  '    [[ -n "$PARTS" ]] && PARTS+=" "',
  '    PARTS+="[${CYAN}${MODEL}${RST}]"',
  "fi",
  "",
  'echo "$LINE1"',
  'echo "$PARTS"',
].join("\n");

// ============================================================================
// Statusline Installation
// ============================================================================

/**
 * Check if a statusline is already installed at project and global level.
 * Compares the script content to determine if it matches our version.
 */
export function checkStatuslineStatus(rootDir: string): InstallStatus {
  const homeDir = process.env.HOME || "";
  const projectScriptPath = path.join(rootDir, ".claude", "config", "statusline-command.sh");
  const globalScriptPath = path.join(homeDir, ".claude", "config", "statusline-command.sh");
  const projectSettingsPath = path.join(rootDir, ".claude", "settings.json");
  const globalSettingsPath = path.join(homeDir, ".claude", "settings.json");

  const result: InstallStatus = {
    projectInstalled: false,
    globalInstalled: false,
    projectMatchesOurs: false,
    globalMatchesOurs: false,
  };

  // Check project-level
  try {
    if (fs.existsSync(projectSettingsPath)) {
      const settings = JSON.parse(fs.readFileSync(projectSettingsPath, "utf-8"));
      if (settings.statusLine?.command) {
        result.projectInstalled = true;
        if (fs.existsSync(projectScriptPath)) {
          const content = fs.readFileSync(projectScriptPath, "utf-8");
          result.projectMatchesOurs = content.trim() === STATUSLINE_SCRIPT.trim();
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Check global-level
  try {
    if (fs.existsSync(globalSettingsPath)) {
      const settings = JSON.parse(fs.readFileSync(globalSettingsPath, "utf-8"));
      if (settings.statusLine?.command) {
        result.globalInstalled = true;
        if (fs.existsSync(globalScriptPath)) {
          const content = fs.readFileSync(globalScriptPath, "utf-8");
          result.globalMatchesOurs = content.trim() === STATUSLINE_SCRIPT.trim();
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return result;
}

/**
 * Install the statusline script into a project's .claude/ directory.
 * Creates the script and patches settings.json with the statusLine configuration.
 */
export function installStatusline(rootDir: string): void {
  const configDir = path.join(rootDir, ".claude", "config");
  const scriptPath = path.join(configDir, "statusline-command.sh");
  const settingsPath = path.join(rootDir, ".claude", "settings.json");

  // Write statusline script
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(scriptPath, STATUSLINE_SCRIPT);
  fs.chmodSync(scriptPath, 0o755);

  // Patch settings.json with statusLine configuration
  patchSettings(settingsPath, {
    statusLine: { type: "command", command: "bash .claude/config/statusline-command.sh" },
  });
}

/**
 * Install the statusline script globally (~/.claude/).
 * Creates the script and patches ~/.claude/settings.json.
 */
export function installStatuslineGlobal(): void {
  const homeDir = process.env.HOME || "";
  const configDir = path.join(homeDir, ".claude", "config");
  const scriptPath = path.join(configDir, "statusline-command.sh");
  const settingsPath = path.join(homeDir, ".claude", "settings.json");

  // Write statusline script
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(scriptPath, STATUSLINE_SCRIPT);
  fs.chmodSync(scriptPath, 0o755);

  // Patch settings.json with statusLine configuration
  patchSettings(settingsPath, {
    statusLine: { type: "command", command: "bash ~/.claude/config/statusline-command.sh" },
  });
}

// ============================================================================
// Sensitive File Protection Hook
// ============================================================================

const SENSITIVE_FILES_HOOK = String.raw`#!/usr/bin/env node
/**
 * Protect Sensitive Files - PreToolUse Hook for Write/Edit
 * Warns before modifying sensitive files (migrations, env, credentials, lock files).
 */

const path = require('path');

const SENSITIVE_PATTERNS = [
  { pattern: /\/migrations?\//i, reason: 'migration file — changes may affect database schema' },
  { pattern: /\.env(\.\w+)?$/, reason: 'environment file — may contain secrets' },
  { pattern: /\/secrets?\//i, reason: 'secrets directory — may contain credentials' },
  { pattern: /\/credentials?\//i, reason: 'credentials directory' },
  { pattern: /\.(pem|key|cert|crt)$/, reason: 'certificate/key file' },
  { pattern: /package-lock\.json$/, reason: 'lock file — should be managed by package manager' },
  { pattern: /yarn\.lock$/, reason: 'lock file — should be managed by package manager' },
  { pattern: /pnpm-lock\.yaml$/, reason: 'lock file — should be managed by package manager' },
  { pattern: /bun\.lock$/, reason: 'lock file — should be managed by package manager' },
  { pattern: /Cargo\.lock$/, reason: 'lock file — should be managed by cargo' },
  { pattern: /poetry\.lock$/, reason: 'lock file — should be managed by poetry' },
];

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input } = data;

    if (tool_name !== 'Write' && tool_name !== 'Edit') {
      return console.log('{}');
    }

    const filePath = tool_input?.file_path || tool_input?.path || '';
    const normalized = filePath.replace(/\\/g, '/');

    for (const { pattern, reason } of SENSITIVE_PATTERNS) {
      if (pattern.test(normalized)) {
        return console.log(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'ask',
            permissionDecisionReason: '\u26A0\uFE0F Sensitive file: ' + reason + ' (' + path.basename(filePath) + ')'
          }
        }));
      }
    }

    console.log('{}');
  } catch {
    console.log('{}');
  }
}

if (require.main === module) main();
`;

/**
 * Check sensitive files hook status
 */
export function checkSensitiveHookStatus(rootDir: string): InstallStatus {
  const homeDir = process.env.HOME || "";
  const projectPath = path.join(rootDir, ".claude", "hooks", "protect-sensitive-files.js");
  const globalPath = path.join(homeDir, ".claude", "hooks", "protect-sensitive-files.js");

  const result: InstallStatus = {
    projectInstalled: false,
    globalInstalled: false,
    projectMatchesOurs: false,
    globalMatchesOurs: false,
  };

  if (fs.existsSync(projectPath)) {
    result.projectInstalled = true;
    try {
      result.projectMatchesOurs =
        fs.readFileSync(projectPath, "utf-8").trim() === SENSITIVE_FILES_HOOK.trim();
    } catch {
      // Ignore read errors
    }
  }

  if (fs.existsSync(globalPath)) {
    result.globalInstalled = true;
    try {
      result.globalMatchesOurs =
        fs.readFileSync(globalPath, "utf-8").trim() === SENSITIVE_FILES_HOOK.trim();
    } catch {
      // Ignore read errors
    }
  }

  return result;
}

/**
 * Install sensitive files hook at project level
 */
export function installSensitiveHook(rootDir: string): void {
  const hooksDir = path.join(rootDir, ".claude", "hooks");
  const hookPath = path.join(hooksDir, "protect-sensitive-files.js");
  const settingsPath = path.join(rootDir, ".claude", "settings.json");

  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, SENSITIVE_FILES_HOOK);
  fs.chmodSync(hookPath, 0o755);

  patchHook(settingsPath, "Write", "node .claude/hooks/protect-sensitive-files.js");
  patchHook(settingsPath, "Edit", "node .claude/hooks/protect-sensitive-files.js");
}

/**
 * Install sensitive files hook globally
 */
export function installSensitiveHookGlobal(): void {
  const homeDir = process.env.HOME || "";
  const hooksDir = path.join(homeDir, ".claude", "hooks");
  const hookPath = path.join(hooksDir, "protect-sensitive-files.js");
  const settingsPath = path.join(homeDir, ".claude", "settings.json");

  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, SENSITIVE_FILES_HOOK);
  fs.chmodSync(hookPath, 0o755);

  patchHook(settingsPath, "Write", "node ~/.claude/hooks/protect-sensitive-files.js");
  patchHook(settingsPath, "Edit", "node ~/.claude/hooks/protect-sensitive-files.js");
}

// ============================================================================
// Settings Patching Helpers
// ============================================================================

/**
 * Add a PreToolUse hook entry to settings.json for a specific matcher.
 */
function patchHook(settingsPath: string, matcher: string, command: string): void {
  try {
    const existing = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      : {};

    const newEntry = {
      matcher,
      hooks: [{ type: "command", command }],
    };

    const existingPreToolUse = Array.isArray(existing.hooks?.PreToolUse)
      ? existing.hooks.PreToolUse
      : [];

    const alreadyInstalled = existingPreToolUse.some(
      (e: { matcher?: string; hooks?: { command?: string }[] }) =>
        e.matcher === matcher &&
        Array.isArray(e.hooks) &&
        e.hooks.some((h) => h.command === command)
    );

    if (!alreadyInstalled) {
      existing.hooks = {
        ...existing.hooks,
        PreToolUse: [...existingPreToolUse, newEntry],
      };
      fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`  Warning: could not patch settings.json (${msg}) — add hook config manually`);
  }
}

/**
 * Patch a settings.json file by merging the given keys.
 */
function patchSettings(settingsPath: string, patch: Record<string, unknown>): void {
  try {
    const existing = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      : {};

    Object.assign(existing, patch);

    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(
      `  Warning: could not patch settings.json (${msg}) — add statusLine config manually`
    );
  }
}
