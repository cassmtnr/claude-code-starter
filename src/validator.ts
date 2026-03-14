/**
 * @module validator
 * @description Post-generation validation and deduplication for .claude/ artifacts.
 *
 * After Claude generates all .claude/ configuration files, this module performs
 * a deterministic pass to detect and remove content that duplicates CLAUDE.md
 * conventions or commands. This ensures the anti-redundancy rules are enforced
 * programmatically, not just by prompting.
 *
 * @example
 * import { validateArtifacts } from './validator.js';
 *
 * const result = validateArtifacts('/path/to/project');
 * console.log(`Removed ${result.duplicationsRemoved} redundancies`);
 */

import fs from "node:fs";
import path from "node:path";

// ============================================================================
// Types
// ============================================================================

export interface ValidationChange {
  file: string;
  original: string;
  replacement: string | null;
}

export interface ValidationResult {
  filesChecked: number;
  filesModified: number;
  duplicationsRemoved: number;
  changes: ValidationChange[];
}

// ============================================================================
// Extraction
// ============================================================================

/**
 * Extract command strings from CLAUDE.md's Common Commands code block.
 */
export function extractCommands(claudeMd: string): string[] {
  const commands: string[] = [];
  const match = claudeMd.match(/## Common Commands[\s\S]*?```(?:bash)?\n([\s\S]*?)```/);
  if (!match) return commands;

  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cmd = trimmed.split(/\s+#/)[0].trim();
    if (cmd.length > 3) commands.push(cmd);
  }
  return commands;
}

/**
 * Extract convention fingerprint keywords from CLAUDE.md's Code Conventions section.
 */
export function extractConventionFingerprints(claudeMd: string): string[] {
  const fingerprints: string[] = [];
  const startIdx = claudeMd.indexOf("## Code Conventions");
  if (startIdx === -1) return fingerprints;

  const rest = claudeMd.slice(startIdx + "## Code Conventions".length);
  const nextHeading = rest.match(/\n## [A-Z]/);
  const section = nextHeading
    ? claudeMd.slice(startIdx, startIdx + "## Code Conventions".length + nextHeading.index!)
    : claudeMd.slice(startIdx);

  for (const kw of ["camelCase", "PascalCase", "kebab-case", "snake_case"]) {
    if (section.includes(kw)) fingerprints.push(kw);
  }

  if (/\bnamed exports?\b/i.test(section)) fingerprints.push("named export");
  if (/\bdefault exports?\b/i.test(section)) fingerprints.push("default export");
  if (section.includes("import type")) fingerprints.push("import type");

  for (const kw of [".skip()", ".only()", "console.log"]) {
    if (section.includes(kw)) fingerprints.push(kw);
  }

  return fingerprints;
}

// ============================================================================
// Detection
// ============================================================================

const RULE_WORDS = /\b(verify|check|ensure|always|never|must|should|avoid)\b/i;

/**
 * Check if a line restates a convention already documented in CLAUDE.md.
 * Returns true for list items that contain convention fingerprints in a rule context.
 */
function isConventionDuplication(line: string, fingerprints: string[]): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.includes("CLAUDE.md")) return false;
  if (!/^[-*]\s/.test(trimmed)) return false;

  const matchCount = fingerprints.filter((fp) => trimmed.includes(fp)).length;

  if (matchCount >= 2) return true;
  if (matchCount === 1 && RULE_WORDS.test(trimmed)) return true;

  return false;
}

/**
 * Check if a line contains a literal command from CLAUDE.md's Common Commands.
 * Returns the matched command string, or null.
 */
function findLiteralCommand(line: string, commands: string[]): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.includes("CLAUDE.md")) return null;

  for (const cmd of commands) {
    if (trimmed.includes(cmd)) return cmd;
  }
  return null;
}

// ============================================================================
// File Processing
// ============================================================================

/**
 * Separate YAML frontmatter from markdown body.
 */
export function separateFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  if (!match) {
    return { frontmatter: "", body: content };
  }
  return {
    frontmatter: match[0],
    body: content.slice(match[0].length),
  };
}

/**
 * Process a single file: detect and fix convention/command duplication.
 */
function processFile(
  filePath: string,
  commands: string[],
  fingerprints: string[]
): ValidationChange[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = separateFrontmatter(content);

  const lines = body.split("\n");
  const changes: ValidationChange[] = [];
  const newLines: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      newLines.push(line);
      continue;
    }

    if (inCodeBlock) {
      newLines.push(line);
      continue;
    }

    if (isConventionDuplication(line, fingerprints)) {
      changes.push({ file: filePath, original: line.trim(), replacement: null });
      continue;
    }

    const cmd = findLiteralCommand(line, commands);
    if (cmd) {
      const newLine = line.replace(cmd, "see Common Commands in CLAUDE.md");
      changes.push({ file: filePath, original: line.trim(), replacement: newLine.trim() });
      newLines.push(newLine);
      continue;
    }

    newLines.push(line);
  }

  if (changes.length > 0) {
    fs.writeFileSync(filePath, frontmatter + newLines.join("\n"));
  }

  return changes;
}

// ============================================================================
// File Walking
// ============================================================================

function walkMdFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMdFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

// ============================================================================
// Main Validation
// ============================================================================

/**
 * Validate all .claude/ artifacts against CLAUDE.md for convention and command duplication.
 * Removes duplicated convention lines and replaces literal commands with cross-references.
 */
export function validateArtifacts(rootDir: string): ValidationResult {
  const result: ValidationResult = {
    filesChecked: 0,
    filesModified: 0,
    duplicationsRemoved: 0,
    changes: [],
  };

  const claudeMdPath = path.join(rootDir, ".claude", "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) return result;

  try {
    const claudeMd = fs.readFileSync(claudeMdPath, "utf-8");
    const commands = extractCommands(claudeMd);
    const fingerprints = extractConventionFingerprints(claudeMd);

    if (commands.length === 0 && fingerprints.length === 0) return result;

    const claudeDir = path.join(rootDir, ".claude");
    const files = walkMdFiles(claudeDir).filter((f) => !f.endsWith("CLAUDE.md"));

    for (const filePath of files) {
      result.filesChecked++;
      const changes = processFile(filePath, commands, fingerprints);

      if (changes.length > 0) {
        result.filesModified++;
        result.duplicationsRemoved += changes.length;
        for (const change of changes) {
          change.file = path.relative(rootDir, filePath);
        }
        result.changes.push(...changes);
      }
    }
  } catch {
    return result;
  }

  return result;
}
