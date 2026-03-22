/**
 * @module portability
 * @description Export, import, and template support for .claude/ configurations.
 *
 * Enables sharing configurations across repositories and teams via:
 * - Export: bundle .claude/ into a portable JSON archive
 * - Import: apply an exported configuration to a project
 * - Templates: bootstrap from a predefined template (local path or URL)
 *
 * @example
 * import { exportConfig, importConfig } from './portability.js';
 *
 * exportConfig('/path/to/project', '/tmp/config.json');
 * importConfig('/tmp/config.json', '/path/to/target');
 */

import fs from "node:fs";
import path from "node:path";
import type { ExportConfig } from "./types.js";

// ============================================================================
// Export
// ============================================================================

/**
 * Export the .claude/ directory as a portable JSON archive.
 */
export function exportConfig(projectDir: string, outputPath: string): ExportConfig {
  const claudeDir = path.join(projectDir, ".claude");

  const config: ExportConfig = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    projectName: path.basename(projectDir),
    techStack: {},
    claudeMd: readFileOrNull(path.join(claudeDir, "CLAUDE.md")),
    settings: readJsonOrNull(path.join(claudeDir, "settings.json")),
    skills: readDirFiles(path.join(claudeDir, "skills")),
    agents: readDirFiles(path.join(claudeDir, "agents")),
    rules: readDirFiles(path.join(claudeDir, "rules")),
    commands: readDirFiles(path.join(claudeDir, "commands")),
    hooks: readDirFiles(path.join(claudeDir, "hooks")),
  };

  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
  return config;
}

// ============================================================================
// Import
// ============================================================================

/**
 * Import a configuration archive into a project's .claude/ directory.
 * Returns the list of files written.
 */
export function importConfig(inputPath: string, projectDir: string, force = false): string[] {
  let config: ExportConfig;
  try {
    const content = fs.readFileSync(inputPath, "utf-8");
    config = JSON.parse(content);
  } catch {
    return [];
  }
  const written: string[] = [];

  const claudeDir = path.join(projectDir, ".claude");

  // Write CLAUDE.md
  if (config.claudeMd) {
    const dest = path.join(claudeDir, "CLAUDE.md");
    if (force || !fs.existsSync(dest)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(dest, config.claudeMd);
      written.push(".claude/CLAUDE.md");
    }
  }

  // Write settings.json
  if (config.settings) {
    const dest = path.join(claudeDir, "settings.json");
    if (force || !fs.existsSync(dest)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(dest, JSON.stringify(config.settings, null, 2));
      written.push(".claude/settings.json");
    }
  }

  // Write directory files (skills, agents, rules, commands, hooks)
  const dirs: [string, Record<string, string>][] = [
    ["skills", config.skills],
    ["agents", config.agents],
    ["rules", config.rules],
    ["commands", config.commands],
    ["hooks", config.hooks],
  ];

  for (const [dirName, files] of dirs) {
    if (!files || Object.keys(files).length === 0) continue;
    const dirPath = path.join(claudeDir, dirName);
    fs.mkdirSync(dirPath, { recursive: true });

    for (const [fileName, fileContent] of Object.entries(files)) {
      const dest = path.resolve(dirPath, fileName);
      // Path traversal guard — reject filenames that escape the target directory
      // path.resolve produces OS-native paths; path.sep matches the separator used
      if (!dest.startsWith(dirPath + path.sep) && dest !== dirPath) continue;
      if (force || !fs.existsSync(dest)) {
        fs.writeFileSync(dest, fileContent);
        written.push(`.claude/${dirName}/${fileName}`);
      }
    }
  }

  return written;
}

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load a template from a local path.
 * Returns the parsed ExportConfig or null if invalid.
 */
export function loadTemplate(templatePath: string): ExportConfig | null {
  try {
    if (!fs.existsSync(templatePath)) return null;
    const content = fs.readFileSync(templatePath, "utf-8");
    const config: ExportConfig = JSON.parse(content);
    // Basic validation
    if (!config.version || typeof config.skills !== "object") return null;
    return config;
  } catch {
    return null;
  }
}

/**
 * Check for a .claude-template.json in the project root (useful for monorepos).
 */
export function findProjectTemplate(projectDir: string): string | null {
  const templatePath = path.join(projectDir, ".claude-template.json");
  if (fs.existsSync(templatePath)) return templatePath;
  return null;
}

// ============================================================================
// Helpers
// ============================================================================

function readFileOrNull(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readJsonOrNull(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readDirFiles(dirPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(dirPath)) return result;

  try {
    for (const entry of fs.readdirSync(dirPath)) {
      try {
        const fullPath = path.join(dirPath, entry);
        if (fs.statSync(fullPath).isFile()) {
          result[entry] = fs.readFileSync(fullPath, "utf-8");
        }
      } catch {
        // Skip unreadable files (broken symlinks, permission errors)
      }
    }
  } catch {
    // Ignore directory read errors
  }

  return result;
}
