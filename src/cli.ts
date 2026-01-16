import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";
import pc from "picocolors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
).version;

// ============================================================================
// Types
// ============================================================================

export interface Args {
  help: boolean;
  version: boolean;
  force: boolean;
}

export interface ProjectInfo {
  isExisting: boolean;
  techStack: string[];
  frameworks: string[];
  directories: string[];
  fileCount: number;
}

// ============================================================================
// Exported Functions (testable)
// ============================================================================

export function parseArgs(args: string[]): Args {
  return {
    help: args.includes("-h") || args.includes("--help"),
    version: args.includes("-v") || args.includes("--version"),
    force: args.includes("-f") || args.includes("--force"),
  };
}

export function detectProject(projectDir: string): ProjectInfo {
  const techStack: string[] = [];
  const frameworks: string[] = [];
  const directories: string[] = [];
  let isExisting = false;

  // Check for project files
  const checks: [string, string][] = [
    ["package.json", "Node.js"],
    ["tsconfig.json", "TypeScript"],
    ["requirements.txt", "Python"],
    ["pyproject.toml", "Python"],
    ["Cargo.toml", "Rust"],
    ["go.mod", "Go"],
    ["pom.xml", "Java"],
    ["build.gradle", "Java/Kotlin"],
    ["Gemfile", "Ruby"],
  ];

  for (const [file, tech] of checks) {
    if (fs.existsSync(path.join(projectDir, file))) {
      if (!techStack.includes(tech)) techStack.push(tech);
      isExisting = true;
    }
  }

  // Check for key directories
  const keyDirs = ["src", "lib", "app", "api", "components", "pages", "tests", "test"];
  for (const dir of keyDirs) {
    if (fs.existsSync(path.join(projectDir, dir))) {
      directories.push(dir);
      isExisting = true;
    }
  }

  // Detect frameworks from package.json
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = fs.readFileSync(pkgPath, "utf-8");
      const frameworkChecks: [string, string][] = [
        ['"react"', "React"],
        ['"next"', "Next.js"],
        ['"vue"', "Vue"],
        ['"express"', "Express"],
        ['"fastify"', "Fastify"],
        ['"@nestjs"', "NestJS"],
      ];
      for (const [pattern, name] of frameworkChecks) {
        if (pkg.includes(pattern)) frameworks.push(name);
      }
    } catch {
      // Ignore read errors
    }
  }

  // Count source files (simple approach)
  let fileCount = 0;
  const extensions = [".js", ".ts", ".tsx", ".py", ".go", ".rs", ".java", ".rb"];
  const ignoreDirs = ["node_modules", ".git", "dist", "build", ".claude"];

  function countFiles(dir: string, depth = 0): void {
    if (depth > 3) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoreDirs.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          countFiles(fullPath, depth + 1);
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          fileCount++;
          isExisting = true;
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  countFiles(projectDir);

  return { isExisting, techStack, frameworks, directories, fileCount };
}

export function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function copyFile(src: string, dest: string, force: boolean): "created" | "updated" | "skipped" {
  const exists = fs.existsSync(dest);
  if (!force && exists) {
    return "skipped";
  }
  fs.copyFileSync(src, dest);
  return exists ? "updated" : "created";
}

export function getVersion(): string {
  return VERSION;
}

export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}

// ============================================================================
// Internal Functions
// ============================================================================

function showHelp(): void {
  console.log(`
${pc.cyan("Claude Code Starter")} v${VERSION}

A lightweight starter kit for AI-assisted development with Claude Code.

${pc.bold("USAGE")}
  npx claude-code-starter [OPTIONS]

${pc.bold("OPTIONS")}
  -h, --help      Show this help message
  -v, --version   Show version number
  -f, --force     Force overwrite of CLAUDE.md and settings.json

${pc.bold("MORE INFO")}
  https://github.com/cassmtnr/claude-code-starter
`);
}

function showBanner(): void {
  console.log(pc.cyan("╔═════════════════════════════════════╗"));
  console.log(pc.cyan(`║   Claude Code Starter v${VERSION.padEnd(13)}║`));
  console.log(pc.cyan("╚═════════════════════════════════════╝"));
  console.log();
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log(`claude-code-starter v${VERSION}`);
    process.exit(0);
  }

  showBanner();

  const projectDir = process.cwd();

  // Validate templates exist
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error(pc.red("Error: Templates directory not found."));
    console.error("The installation appears to be incomplete.");
    process.exit(1);
  }

  // Create directory structure
  fs.mkdirSync(path.join(projectDir, ".claude", "state"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, ".claude", "commands"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, ".claude", "skills"), { recursive: true });

  console.log(pc.blue("Setting up framework files..."));

  // Copy CLAUDE.md
  const claudeMdResult = copyFile(
    path.join(TEMPLATES_DIR, "CLAUDE.md"),
    path.join(projectDir, "CLAUDE.md"),
    args.force
  );
  if (claudeMdResult === "skipped") {
    console.log("  CLAUDE.md exists (use --force to overwrite)");
  } else {
    console.log(`  ${claudeMdResult === "updated" ? "Updated" : "Created"} CLAUDE.md`);
  }

  // Copy settings.json
  const settingsResult = copyFile(
    path.join(TEMPLATES_DIR, "settings.json"),
    path.join(projectDir, ".claude", "settings.json"),
    args.force
  );
  if (settingsResult === "skipped") {
    console.log("  settings.json exists (use --force to overwrite)");
  } else {
    console.log(`  ${settingsResult === "updated" ? "Updated" : "Created"} .claude/settings.json`);
  }

  // Copy commands and skills (always update)
  copyDir(path.join(TEMPLATES_DIR, "commands"), path.join(projectDir, ".claude", "commands"));
  console.log("  Updated .claude/commands/");

  copyDir(path.join(TEMPLATES_DIR, "skills"), path.join(projectDir, ".claude", "skills"));
  console.log("  Updated .claude/skills/");

  // Write version file
  fs.writeFileSync(path.join(projectDir, ".claude", ".version"), VERSION);

  console.log();

  // Detect project type
  const project = detectProject(projectDir);

  if (project.isExisting) {
    console.log(pc.green("Detected existing project"));
    if (project.techStack.length > 0) {
      console.log(`Tech stack: ${pc.cyan(project.techStack.join(" "))}`);
    }
    console.log();

    console.log(pc.blue("Analyzing codebase..."));
    console.log();
    console.log(`  Files: ${project.fileCount} source files`);
    if (project.directories.length > 0) {
      console.log(`  Directories: ${project.directories.map((d) => d + "/").join(" ")}`);
    }
    if (project.frameworks.length > 0) {
      console.log(`  Frameworks: ${project.frameworks.join(" ")}`);
    }
    console.log();

    // Create task file if it doesn't exist
    const taskPath = path.join(projectDir, ".claude", "state", "task.md");
    if (!fs.existsSync(taskPath)) {
      fs.writeFileSync(
        taskPath,
        `# Current Task

## Status: Ready

No active task. Start one with \`/task <description>\`.

## Project Summary

This is an existing codebase. Use \`/analyze\` to explore specific areas.

## Quick Commands

- \`/task\` - Start working on something
- \`/status\` - See current state
- \`/analyze\` - Deep dive into code
- \`/done\` - Mark task complete
`
      );
      console.log("  Created .claude/state/task.md");
    } else {
      console.log("  Task state preserved (.claude/state/task.md)");
    }

    console.log();
    console.log(`${pc.green("Ready!")} Run ${pc.cyan("claude")} to start.`);
  } else {
    console.log(pc.yellow("New project detected"));
    console.log();

    const taskPath = path.join(projectDir, ".claude", "state", "task.md");
    if (!fs.existsSync(taskPath)) {
      const response = await prompts({
        type: "text",
        name: "task",
        message: "What are you building?",
        initial: "Explore and set up project",
      });

      const task = response.task || "Explore and set up project";

      fs.writeFileSync(
        taskPath,
        `# Current Task

## Status: In Progress

**Task:** ${task}

## Context

New project - no existing code yet.

## Next Steps

1. Define project structure
2. Set up development environment
3. Start implementation

## Decisions

(None yet - starting fresh)
`
      );

      console.log();
      console.log(`${pc.green("Ready!")} Run ${pc.cyan("claude")} to start working on: ${task}`);
    } else {
      console.log("  Task state preserved (.claude/state/task.md)");
      console.log();
      console.log(`${pc.green("Ready!")} Run ${pc.cyan("claude")} to continue.`);
    }
  }

  console.log();
  console.log(`${pc.blue("Tip:")} Add ${pc.cyan(".claude/")} to your global .gitignore`);
}

main().catch((err) => {
  console.error(pc.red("Error:"), err.message);
  process.exit(1);
});
