/**
 * @module health
 * @description Health check and scoring for .claude/ configurations.
 *
 * Provides a completeness and quality score for an existing .claude/ directory.
 * Used by --tune and --check CLI flags.
 *
 * @example
 * import { checkHealth } from './health.js';
 *
 * const result = checkHealth('/path/to/project');
 * console.log(`Score: ${result.score}/${result.maxScore}`);
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { HealthCheckItem, HealthResult } from "./types.js";

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Run all health checks against a project's .claude/ directory.
 */
export function checkHealth(projectDir: string): HealthResult {
  const items: HealthCheckItem[] = [];

  items.push(checkClaudeMdExists(projectDir));
  items.push(checkClaudeMdLength(projectDir));
  items.push(checkClaudeMdReferences(projectDir));
  items.push(checkSettingsExists(projectDir));
  items.push(checkAgentsExist(projectDir));
  items.push(checkSkillsExist(projectDir));
  items.push(checkRulesHaveFilters(projectDir));
  items.push(checkCommandsExist(projectDir));
  items.push(checkSafetyHook(projectDir));
  items.push(checkNoDuplication(projectDir));

  const score = items.reduce((sum, item) => sum + item.score, 0);
  const maxScore = items.reduce((sum, item) => sum + item.maxScore, 0);

  return { score, maxScore, items };
}

// ============================================================================
// Individual Checks
// ============================================================================

function checkClaudeMdExists(projectDir: string): HealthCheckItem {
  const exists = fs.existsSync(path.join(projectDir, ".claude", "CLAUDE.md"));
  return {
    name: "CLAUDE.md exists",
    passed: exists,
    score: exists ? 10 : 0,
    maxScore: 10,
    message: exists
      ? "CLAUDE.md found"
      : "Missing .claude/CLAUDE.md — run claude-code-starter to generate",
  };
}

function checkClaudeMdLength(projectDir: string): HealthCheckItem {
  const claudeMdPath = path.join(projectDir, ".claude", "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) {
    return {
      name: "CLAUDE.md length",
      passed: false,
      score: 0,
      maxScore: 5,
      message: "CLAUDE.md not found",
    };
  }

  const lines = fs.readFileSync(claudeMdPath, "utf-8").split("\n").length;
  const ok = lines <= 120;
  return {
    name: "CLAUDE.md length",
    passed: ok,
    score: ok ? 5 : 2,
    maxScore: 5,
    message: ok
      ? `${lines} lines (within 120-line cap)`
      : `${lines} lines — exceeds 120-line cap, consider trimming`,
  };
}

function checkClaudeMdReferences(projectDir: string): HealthCheckItem {
  const claudeMdPath = path.join(projectDir, ".claude", "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) {
    return {
      name: "CLAUDE.md file references",
      passed: false,
      score: 0,
      maxScore: 10,
      message: "CLAUDE.md not found",
    };
  }

  const content = fs.readFileSync(claudeMdPath, "utf-8");
  // Extract file references like `path/to/file.ts` from markdown
  const fileRefs = content.match(/`([^`]+\.\w{1,5})`/g) || [];
  const uniqueRefs = [...new Set(fileRefs.map((r) => r.replace(/`/g, "").split(" ")[0]))];

  let valid = 0;
  let invalid = 0;
  const brokenRefs: string[] = [];

  for (const ref of uniqueRefs) {
    // Skip URLs, globs, and command-like references
    if (ref.includes("*") || ref.includes("://") || ref.startsWith("$") || ref.startsWith(".env"))
      continue;
    // Skip references with parentheses (function references like `file.ts (functionName)`)
    const filePart = ref.split("(")[0].trim();
    if (filePart.length === 0) continue;

    const fullPath = path.join(projectDir, filePart);
    if (fs.existsSync(fullPath)) {
      valid++;
    } else {
      invalid++;
      brokenRefs.push(filePart);
    }
  }

  const total = valid + invalid;
  if (total === 0) {
    return {
      name: "CLAUDE.md file references",
      passed: true,
      score: 10,
      maxScore: 10,
      message: "No file references to validate",
    };
  }

  const passed = invalid === 0;
  const score = total > 0 ? Math.round((valid / total) * 10) : 10;
  const message = passed
    ? `All ${valid} file references are valid`
    : `${invalid}/${total} file references are broken: ${brokenRefs.slice(0, 3).join(", ")}${brokenRefs.length > 3 ? "..." : ""}`;

  return { name: "CLAUDE.md file references", passed, score, maxScore: 10, message };
}

function checkSettingsExists(projectDir: string): HealthCheckItem {
  const settingsPath = path.join(projectDir, ".claude", "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return {
      name: "settings.json",
      passed: false,
      score: 0,
      maxScore: 5,
      message: "Missing .claude/settings.json",
    };
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const hasPermissions =
      Array.isArray(settings.permissions?.allow) && settings.permissions.allow.length > 0;
    return {
      name: "settings.json",
      passed: hasPermissions,
      score: hasPermissions ? 5 : 3,
      maxScore: 5,
      message: hasPermissions
        ? `${settings.permissions.allow.length} permissions configured`
        : "settings.json exists but no permissions configured",
    };
  } catch {
    return {
      name: "settings.json",
      passed: false,
      score: 1,
      maxScore: 5,
      message: "settings.json exists but is malformed",
    };
  }
}

function checkAgentsExist(projectDir: string): HealthCheckItem {
  const agentsDir = path.join(projectDir, ".claude", "agents");
  const agents = listMdFiles(agentsDir);
  const passed = agents.length >= 2;
  return {
    name: "Agents",
    passed,
    score: Math.min(agents.length * 2, 10),
    maxScore: 10,
    message:
      agents.length > 0
        ? `${agents.length} agents: ${agents.map((a) => path.basename(a, ".md")).join(", ")}`
        : "No agents found — run claude-code-starter to generate",
  };
}

function checkSkillsExist(projectDir: string): HealthCheckItem {
  const skillsDir = path.join(projectDir, ".claude", "skills");
  const skills = listMdFiles(skillsDir);
  const passed = skills.length >= 4;
  return {
    name: "Skills",
    passed,
    score: Math.min(skills.length, 5),
    maxScore: 5,
    message:
      skills.length > 0
        ? `${skills.length} skills found`
        : "No skills found — run claude-code-starter to generate",
  };
}

function checkRulesHaveFilters(projectDir: string): HealthCheckItem {
  const rulesDir = path.join(projectDir, ".claude", "rules");
  const rules = listMdFiles(rulesDir);

  if (rules.length === 0) {
    return {
      name: "Rules have paths filters",
      passed: true,
      score: 5,
      maxScore: 5,
      message: "No rules to check",
    };
  }

  let withFilter = 0;
  let withoutFilter = 0;

  for (const rule of rules) {
    try {
      const content = fs.readFileSync(rule, "utf-8");
      if (content.includes("paths:")) {
        withFilter++;
      } else {
        withoutFilter++;
      }
    } catch {
      withoutFilter++;
    }
  }

  const passed = withoutFilter === 0;
  return {
    name: "Rules have paths filters",
    passed,
    score: passed ? 5 : Math.round((withFilter / rules.length) * 5),
    maxScore: 5,
    message: passed
      ? `All ${withFilter} rules have paths: filters`
      : `${withoutFilter}/${rules.length} rules missing paths: filter — they load every session`,
  };
}

function checkCommandsExist(projectDir: string): HealthCheckItem {
  const commandsDir = path.join(projectDir, ".claude", "commands");
  const commands = listMdFiles(commandsDir);
  const passed = commands.length >= 2;
  return {
    name: "Commands",
    passed,
    score: Math.min(commands.length * 2, 5),
    maxScore: 5,
    message:
      commands.length > 0
        ? `${commands.length} commands: ${commands.map((c) => `/${path.basename(c, ".md")}`).join(", ")}`
        : "No commands found",
  };
}

function checkSafetyHook(projectDir: string): HealthCheckItem {
  const hookPath = path.join(projectDir, ".claude", "hooks", "block-dangerous-commands.js");
  const globalHookPath = path.join(
    process.env.HOME || os.homedir(),
    ".claude",
    "hooks",
    "block-dangerous-commands.js"
  );
  const installed = fs.existsSync(hookPath) || fs.existsSync(globalHookPath);
  return {
    name: "Safety hook",
    passed: installed,
    score: installed ? 5 : 0,
    maxScore: 5,
    message: installed
      ? "Safety hook installed"
      : "No safety hook — consider installing via --refresh",
  };
}

function checkNoDuplication(projectDir: string): HealthCheckItem {
  const claudeMdPath = path.join(projectDir, ".claude", "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) {
    return {
      name: "No duplication",
      passed: true,
      score: 10,
      maxScore: 10,
      message: "CLAUDE.md not found — nothing to check",
    };
  }

  // Simplified check — see validator.ts extractConventionFingerprints for the full fingerprint set
  const claudeMd = fs.readFileSync(claudeMdPath, "utf-8");
  const conventionSection = claudeMd.indexOf("## Code Conventions");
  if (conventionSection === -1) {
    return {
      name: "No duplication",
      passed: true,
      score: 10,
      maxScore: 10,
      message: "No conventions section to check",
    };
  }

  // Simple check: look for convention keywords in other files
  const keywords = ["camelCase", "PascalCase", "named export", "default export", "import type"];
  const claudeDir = path.join(projectDir, ".claude");
  const files = walkMdFiles(claudeDir).filter((f) => !f.endsWith("CLAUDE.md"));
  let duplications = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      for (const kw of keywords) {
        if (claudeMd.includes(kw) && content.includes(kw)) {
          duplications++;
          break;
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  const passed = duplications === 0;
  return {
    name: "No duplication",
    passed,
    score: passed ? 10 : Math.max(0, 10 - duplications * 2),
    maxScore: 10,
    message: passed
      ? "No convention duplication detected"
      : `${duplications} files duplicate conventions from CLAUDE.md — run validation`,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Shallow — reads top-level .md files only; nested files are not expected in these directories. */
function listMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Recursively walk a directory for .md files.
 */
function walkMdFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walkMdFiles(fullPath));
      } else if (entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore read errors
  }
  return files;
}
