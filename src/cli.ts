/**
 * @module cli
 * @description Main CLI entry point for Claude Code Starter.
 *
 * This module orchestrates the entire CLI workflow:
 * 1. Parse command-line arguments
 * 2. Analyze the repository (via analyzer module)
 * 3. Prompt for preferences (new projects only)
 * 4. Write settings.json and ensure directories
 * 5. Spawn Claude CLI to generate all .claude/ content files
 * 6. Display summary
 *
 * CLI Options:
 * - `-h, --help` - Show help message
 * - `-v, --version` - Show version
 * - `-f, --force` - Force overwrite existing files
 * - `-y, --no-interactive` - Skip prompts, use defaults
 * - `-V, --verbose` - Show detailed output
 *
 * @example
 * // Run from command line:
 * npx claude-code-starter
 * npx claude-code-starter -y  // non-interactive
 */

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
import pc from "picocolors";
import prompts from "prompts";
import { analyzeRepository } from "./analyzer.js";
import { promptExtras } from "./extras.js";
import { ensureDirectories, writeSettings } from "./generator.js";
import { checkHealth } from "./health.js";
import { exportConfig, findProjectTemplate, importConfig, loadTemplate } from "./portability.js";
import type { ClaudeMdPromptOptions } from "./prompt.js";
import { getAnalysisPrompt } from "./prompt.js";
import type {
  Args,
  Formatter,
  Framework,
  Language,
  Linter,
  NewProjectPreferences,
  Profile,
  ProjectInfo,
} from "./types.js";
import { validateArtifacts } from "./validator.js";

// ============================================================================
// Constants
// ============================================================================

declare const __VERSION__: string | undefined;

let VERSION: string;
if (typeof __VERSION__ !== "undefined") {
  VERSION = __VERSION__;
} else {
  // Fallback for development (not built via tsup)
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    VERSION = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
    ).version;
  } catch {
    VERSION = "unknown";
  }
}

// ============================================================================
// Exported Functions (testable)
// ============================================================================

export function parseArgs(args: string[]): Args {
  const findValue = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return null;
  };

  const profileValue = findValue("--profile");
  const validProfiles = ["solo", "team", "ci"];

  const profile =
    profileValue && validProfiles.includes(profileValue) ? (profileValue as Profile) : null;

  // Profile overrides: ci forces non-interactive and skips memory seeding
  let interactive = !args.includes("--no-interactive") && !args.includes("-y");
  if (profile === "ci") interactive = false;

  return {
    help: args.includes("-h") || args.includes("--help"),
    version: args.includes("-v") || args.includes("--version"),
    force: args.includes("-f") || args.includes("--force"),
    interactive,
    verbose: args.includes("--verbose") || args.includes("-V"),
    refresh: args.includes("--refresh"),
    tune: args.includes("--tune"),
    check: args.includes("--check"),
    noMemory: args.includes("--no-memory") || profile === "ci",
    exportPath: findValue("--export"),
    importPath: findValue("--import"),
    template: findValue("--template"),
    profile,
  };
}

export function getVersion(): string {
  return VERSION;
}

/**
 * Compare two semver strings (major.minor.patch).
 * Returns true if `latest` is newer than `current`.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [cMajor, cMinor, cPatch] = parse(current);
  const [lMajor, lMinor, lPatch] = parse(latest);
  if (lMajor !== cMajor) return lMajor > cMajor;
  if (lMinor !== cMinor) return lMinor > cMinor;
  return lPatch > cPatch;
}

/**
 * Check npm registry for a newer version and print an update notice if found.
 * Silently ignores failures (network errors, timeouts).
 */
export function checkForUpdate(): void {
  try {
    const latest = execSync("npm view claude-code-starter version", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (latest && isNewerVersion(VERSION, latest)) {
      console.log(pc.yellow(`  Update available: ${VERSION} → ${latest}`));
      console.log(pc.yellow("  Run: npm install -g claude-code-starter@latest"));
      console.log();
    }
  } catch {
    // Network error or timeout — skip silently
  }
}

// ============================================================================
// Display & Utility Functions
// ============================================================================

export function showHelp(): void {
  console.log(`
${pc.cyan("Claude Code Starter")} v${VERSION}

Bootstrap intelligent Claude Code configurations for any repository.

${pc.bold("USAGE")}
  npx claude-code-starter [OPTIONS]

${pc.bold("OPTIONS")}
  -h, --help             Show this help message
  -v, --version          Show version number
  -f, --force            Force overwrite existing .claude files
  -y, --no-interactive   Skip interactive prompts (use defaults)
  -V, --verbose          Show detailed output
  --refresh              Refresh settings.json, hooks, and statusline without re-running Claude analysis
  --tune                 Re-analyze existing .claude/ setup and show health report
  --check                Audit .claude/ directory and exit with score (CI-friendly)
  --no-memory            Skip memory seeding during analysis
  --export <path>        Export .claude/ config as portable JSON archive
  --import <path>        Import a config archive into .claude/
  --template <path>      Bootstrap from a template file
  --profile <name>       Generation profile: solo, team, or ci

${pc.bold("WHAT IT DOES")}
  1. Analyzes your repository's tech stack
  2. Launches Claude CLI to deeply analyze your codebase
  3. Generates all .claude/ configuration files:
     - CLAUDE.md with project-specific instructions (via Claude analysis)
     - Skills for your frameworks and workflows
     - Agents for code review and testing
     - Rules matching your code style
     - Commands for analysis and code review

${pc.bold("REQUIREMENTS")}
  Claude CLI must be installed: https://claude.ai/download

${pc.bold("MORE INFO")}
  https://github.com/cassmtnr/claude-code-starter
`);
}

export function showBanner(): void {
  console.log();
  console.log(pc.bold("Claude Code Starter") + pc.gray(` v${VERSION}`));
  console.log(pc.gray("Intelligent AI-Assisted Development Setup"));
  console.log();
}

export function showTechStack(projectInfo: ProjectInfo, verbose: boolean): void {
  const { techStack } = projectInfo;

  console.log(pc.bold("Tech Stack"));
  console.log();

  if (techStack.primaryLanguage) {
    console.log(`  ${pc.bold("Language:")} ${formatLanguage(techStack.primaryLanguage)}`);
  }

  if (techStack.primaryFramework) {
    console.log(`  ${pc.bold("Framework:")} ${formatFramework(techStack.primaryFramework)}`);
  }

  if (techStack.packageManager) {
    console.log(`  ${pc.bold("Package Manager:")} ${techStack.packageManager}`);
  }

  if (techStack.testingFramework) {
    console.log(`  ${pc.bold("Testing:")} ${techStack.testingFramework}`);
  }

  if (verbose) {
    if (techStack.linter) {
      console.log(`  ${pc.bold("Linter:")} ${techStack.linter}`);
    }
    if (techStack.formatter) {
      console.log(`  ${pc.bold("Formatter:")} ${techStack.formatter}`);
    }
    if (techStack.bundler) {
      console.log(`  ${pc.bold("Bundler:")} ${techStack.bundler}`);
    }
    if (techStack.isMonorepo) {
      console.log(`  ${pc.bold("Monorepo:")} yes`);
    }
    if (techStack.hasDocker) {
      console.log(`  ${pc.bold("Docker:")} yes`);
    }
    if (techStack.hasCICD) {
      console.log(`  ${pc.bold("CI/CD:")} ${techStack.cicdPlatform}`);
    }
  }

  console.log();
}

// ============================================================================
// New Project Questionnaire
// ============================================================================

const frameworkChoices: Record<string, { title: string; value: Framework | null }[]> = {
  typescript: [
    { title: "Next.js", value: "nextjs" },
    { title: "React", value: "react" },
    { title: "Vue", value: "vue" },
    { title: "Svelte", value: "svelte" },
    { title: "Express", value: "express" },
    { title: "NestJS", value: "nestjs" },
    { title: "Fastify", value: "fastify" },
    { title: "Hono", value: "hono" },
    { title: "Astro", value: "astro" },
    { title: "None / Other", value: null },
  ],
  javascript: [
    { title: "Next.js", value: "nextjs" },
    { title: "React", value: "react" },
    { title: "Vue", value: "vue" },
    { title: "Svelte", value: "svelte" },
    { title: "Express", value: "express" },
    { title: "NestJS", value: "nestjs" },
    { title: "Fastify", value: "fastify" },
    { title: "Hono", value: "hono" },
    { title: "Astro", value: "astro" },
    { title: "None / Other", value: null },
  ],
  python: [
    { title: "FastAPI", value: "fastapi" },
    { title: "Django", value: "django" },
    { title: "Flask", value: "flask" },
    { title: "None / Other", value: null },
  ],
  go: [
    { title: "Gin", value: "gin" },
    { title: "Echo", value: "echo" },
    { title: "Fiber", value: "fiber" },
    { title: "None / Other", value: null },
  ],
  swift: [
    { title: "SwiftUI", value: "swiftui" },
    { title: "UIKit", value: "uikit" },
    { title: "Vapor", value: "vapor" },
    { title: "None / Other", value: null },
  ],
  kotlin: [
    { title: "Jetpack Compose", value: "jetpack-compose" },
    { title: "Android Views", value: "android-views" },
    { title: "Spring", value: "spring" },
    { title: "None / Other", value: null },
  ],
  java: [
    { title: "Spring", value: "spring" },
    { title: "Quarkus", value: "quarkus" },
    { title: "None / Other", value: null },
  ],
  ruby: [
    { title: "Rails", value: "rails" },
    { title: "Sinatra", value: "sinatra" },
    { title: "None / Other", value: null },
  ],
  rust: [
    { title: "Actix", value: "actix" },
    { title: "Axum", value: "axum" },
    { title: "Rocket", value: "rocket" },
    { title: "None / Other", value: null },
  ],
};

const defaultFrameworkChoices = [{ title: "None / Other", value: null as Framework | null }];

export async function promptNewProject(args: Args): Promise<NewProjectPreferences | null> {
  if (!args.interactive) {
    return null;
  }

  console.log(pc.yellow("New project detected - let's set it up!"));
  console.log();

  // Question 1: Project description
  const descResponse = await prompts({
    type: "text",
    name: "description",
    message: "What are you building?",
    initial: "A new project",
  });

  if (!descResponse.description) {
    return null; // User cancelled
  }

  // Question 2: Primary language
  const langResponse = await prompts({
    type: "select",
    name: "primaryLanguage",
    message: "Primary language?",
    choices: [
      { title: "TypeScript", value: "typescript" },
      { title: "JavaScript", value: "javascript" },
      { title: "Python", value: "python" },
      { title: "Go", value: "go" },
      { title: "Rust", value: "rust" },
      { title: "Swift", value: "swift" },
      { title: "Kotlin", value: "kotlin" },
      { title: "Java", value: "java" },
      { title: "Ruby", value: "ruby" },
      { title: "C#", value: "csharp" },
      { title: "PHP", value: "php" },
      { title: "C++", value: "cpp" },
    ],
  });

  const lang: string = langResponse.primaryLanguage || "typescript";

  // Question 3: Framework (filtered by language)
  const fwChoices = frameworkChoices[lang] || defaultFrameworkChoices;
  const fwResponse = await prompts({
    type: "select",
    name: "framework",
    message: "Framework?",
    choices: fwChoices,
  });

  // Question 4: Package manager (filtered by language)
  const pmChoices = getPackageManagerChoices(lang);
  const pmResponse = await prompts({
    type: "select",
    name: "packageManager",
    message: "Package manager?",
    choices: pmChoices,
  });

  // Question 5: Testing framework (filtered by language)
  const testChoices = getTestingFrameworkChoices(lang);
  const testResponse = await prompts({
    type: "select",
    name: "testingFramework",
    message: "Testing framework?",
    choices: testChoices,
  });

  // Question 6: Linter/Formatter (filtered by language)
  const lintChoices = getLinterFormatterChoices(lang);
  const lintResponse = await prompts({
    type: "select",
    name: "linter",
    message: "Linter/Formatter?",
    choices: lintChoices,
  });

  // Question 7: Project type
  const typeResponse = await prompts({
    type: "select",
    name: "projectType",
    message: "Project type?",
    choices: [
      { title: "Web App", value: "Web App" },
      { title: "API / Backend", value: "API/Backend" },
      { title: "CLI Tool", value: "CLI Tool" },
      { title: "Library / Package", value: "Library/Package" },
      { title: "Mobile App", value: "Mobile App" },
      { title: "Desktop App", value: "Desktop App" },
      { title: "Monorepo", value: "Monorepo" },
      { title: "Other", value: "Other" },
    ],
  });

  return {
    description: descResponse.description,
    primaryLanguage: (langResponse.primaryLanguage || "typescript") as Language,
    framework: fwResponse.framework || null,
    includeTests: true,
    includeLinting: true,
    packageManager: pmResponse.packageManager || null,
    testingFramework: testResponse.testingFramework || null,
    linter: lintResponse.linter || null,
    formatter: mapFormatter(lintResponse.linter || null),
    projectType: typeResponse.projectType || "Other",
  };
}

function getPackageManagerChoices(lang: string) {
  if (lang === "typescript" || lang === "javascript") {
    return [
      { title: "npm", value: "npm" },
      { title: "yarn", value: "yarn" },
      { title: "pnpm", value: "pnpm" },
      { title: "bun", value: "bun" },
    ];
  }
  if (lang === "python") {
    return [
      { title: "pip", value: "pip" },
      { title: "poetry", value: "poetry" },
    ];
  }
  if (lang === "rust") {
    return [{ title: "cargo", value: "cargo" }];
  }
  if (lang === "go") {
    return [{ title: "go modules", value: "go" }];
  }
  if (lang === "ruby") {
    return [{ title: "bundler", value: "bundler" }];
  }
  if (lang === "java" || lang === "kotlin") {
    return [
      { title: "Maven", value: "maven" },
      { title: "Gradle", value: "gradle" },
    ];
  }
  return [{ title: "None / Default", value: null }];
}

function getTestingFrameworkChoices(lang: string) {
  if (lang === "typescript" || lang === "javascript") {
    return [
      { title: "Vitest", value: "vitest" },
      { title: "Jest", value: "jest" },
      { title: "Bun Test", value: "bun-test" },
      { title: "Playwright", value: "playwright" },
      { title: "None / I'll set it up later", value: null },
    ];
  }
  if (lang === "python") {
    return [
      { title: "pytest", value: "pytest" },
      { title: "unittest", value: "unittest" },
      { title: "None / I'll set it up later", value: null },
    ];
  }
  if (lang === "go") {
    return [
      { title: "go test", value: "go-test" },
      { title: "None / I'll set it up later", value: null },
    ];
  }
  if (lang === "rust") {
    return [
      { title: "cargo test", value: "rust-test" },
      { title: "None / I'll set it up later", value: null },
    ];
  }
  if (lang === "ruby") {
    return [
      { title: "RSpec", value: "rspec" },
      { title: "None / I'll set it up later", value: null },
    ];
  }
  if (lang === "java" || lang === "kotlin") {
    return [
      { title: "JUnit", value: "junit" },
      { title: "None / I'll set it up later", value: null },
    ];
  }
  return [{ title: "None / I'll set it up later", value: null }];
}

function getLinterFormatterChoices(lang: string) {
  if (lang === "typescript" || lang === "javascript") {
    return [
      { title: "Biome", value: "biome" },
      { title: "ESLint + Prettier", value: "eslint" },
      { title: "None", value: null },
    ];
  }
  if (lang === "python") {
    return [
      { title: "Ruff", value: "ruff" },
      { title: "Flake8 + Black", value: "flake8" },
      { title: "Pylint", value: "pylint" },
      { title: "None", value: null },
    ];
  }
  if (lang === "go") {
    return [
      { title: "golangci-lint", value: "golangci-lint" },
      { title: "None", value: null },
    ];
  }
  if (lang === "rust") {
    return [
      { title: "Clippy", value: "clippy" },
      { title: "None", value: null },
    ];
  }
  if (lang === "ruby") {
    return [
      { title: "RuboCop", value: "rubocop" },
      { title: "None", value: null },
    ];
  }
  return [{ title: "None", value: null }];
}

export function mapFormatter(linter: Linter | null): Formatter | null {
  if (!linter) return null;
  const mapping: Partial<Record<Linter, Formatter>> = {
    eslint: "prettier",
    biome: "biome",
    ruff: "ruff",
    flake8: "black",
    pylint: "black",
    "golangci-lint": "gofmt",
    clippy: "rustfmt",
    rubocop: "rubocop",
  };
  return mapping[linter] ?? null;
}

export function formatLanguage(lang: Language): string {
  const names: Record<Language, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    python: "Python",
    go: "Go",
    rust: "Rust",
    java: "Java",
    ruby: "Ruby",
    csharp: "C#",
    swift: "Swift",
    kotlin: "Kotlin",
    php: "PHP",
    cpp: "C++",
  };
  return names[lang] || lang;
}

export function formatFramework(fw: Framework): string {
  const names: Partial<Record<Framework, string>> = {
    nextjs: "Next.js",
    react: "React",
    vue: "Vue.js",
    nuxt: "Nuxt",
    svelte: "Svelte",
    sveltekit: "SvelteKit",
    angular: "Angular",
    astro: "Astro",
    remix: "Remix",
    gatsby: "Gatsby",
    solid: "Solid.js",
    express: "Express",
    nestjs: "NestJS",
    fastify: "Fastify",
    hono: "Hono",
    elysia: "Elysia",
    koa: "Koa",
    fastapi: "FastAPI",
    django: "Django",
    flask: "Flask",
    starlette: "Starlette",
    gin: "Gin",
    echo: "Echo",
    fiber: "Fiber",
    actix: "Actix",
    axum: "Axum",
    rocket: "Rocket",
    rails: "Rails",
    sinatra: "Sinatra",
    spring: "Spring",
    quarkus: "Quarkus",
    // Swift/iOS
    swiftui: "SwiftUI",
    uikit: "UIKit",
    vapor: "Vapor",
    swiftdata: "SwiftData",
    combine: "Combine",
    // Android
    "jetpack-compose": "Jetpack Compose",
    "android-views": "Android Views",
    room: "Room",
    hilt: "Hilt",
    "ktor-android": "Ktor",
    // CSS/UI
    tailwind: "Tailwind CSS",
    shadcn: "shadcn/ui",
    chakra: "Chakra UI",
    mui: "Material UI",
    // Database/ORM
    prisma: "Prisma",
    drizzle: "Drizzle",
    typeorm: "TypeORM",
    sequelize: "Sequelize",
    mongoose: "Mongoose",
    sqlalchemy: "SQLAlchemy",
  };
  return names[fw] || fw;
}

// ============================================================================
// Claude CLI Integration
// ============================================================================

/**
 * Check if the Claude CLI is installed and accessible
 */
export function checkClaudeCli(): boolean {
  try {
    execSync("claude --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Claude-powered deep project analysis.
 * Spawns the claude CLI with the analysis prompt to generate all .claude/ content files.
 */
export function runClaudeAnalysis(
  projectDir: string,
  projectInfo: ProjectInfo,
  options: ClaudeMdPromptOptions = { claudeMdMode: "replace", existingClaudeMd: null }
): Promise<boolean> {
  return new Promise((resolve) => {
    const prompt = getAnalysisPrompt(projectInfo, options);

    console.log(pc.cyan("Launching Claude for deep project analysis..."));
    console.log(
      pc.gray("Claude will read your codebase and generate all .claude/ configuration files")
    );
    console.log();

    const spinner = ora({
      text: "Claude is analyzing your project...",
      spinner: {
        interval: 200,
        frames: ["·", "✢", "✳", "✶", "✳", "✢"],
      },
      color: "cyan",
    }).start();

    const child = spawn(
      "claude",
      [
        "-p",
        "--verbose",
        "--output-format=stream-json",
        // Append (not replace) so Claude Code's default agentic-loop guidance is preserved.
        // The override exists because user global CLAUDE.md files often forbid writing to
        // `.claude/`, which contradicts this tool's entire purpose.
        "--append-system-prompt",
        "You are a senior software architect. Your task is to analyze a codebase and generate configuration files. Use only the tools provided: Read, Glob, Grep, Write, Edit. Write all generated files to the `.claude/` directory in the current project root. Do NOT create alternative directories. Do NOT invoke any skills, commands, or agents. Focus exclusively on the task described in the user message.",
        "--allowedTools",
        "Read",
        "--allowedTools",
        "Glob",
        "--allowedTools",
        "Grep",
        "--allowedTools",
        "Write",
        "--allowedTools",
        "Edit",
      ],
      {
        cwd: projectDir,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    // Signal handling — kill child process on Ctrl+C
    const cleanup = () => {
      child.kill("SIGTERM");
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Parse streaming JSON to update spinner with tool activity
    let stdoutBuffer = "";
    let lastResultMessage = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          // Capture result message for error reporting
          if (event.type === "result" && event.result) {
            lastResultMessage = event.result;
          }

          // Tool events are in message.content[] with type "tool_use"
          if (event.type === "assistant" && Array.isArray(event.message?.content)) {
            for (const block of event.message.content) {
              if (block.type === "tool_use" && block.name && block.input) {
                const toolName = block.name;
                const toolInput = block.input;
                const filePath = toolInput.file_path || toolInput.path || toolInput.pattern || "";
                const shortPath = filePath.split("/").slice(-2).join("/");
                const action = toolName === "Write" || toolName === "Edit" ? "Writing" : "Reading";
                if (shortPath) {
                  spinner.text = `${action} ${shortPath}...`;
                } else {
                  spinner.text = `Using ${toolName}...`;
                }
              }
            }
          }
        } catch {
          // Not valid JSON or not a tool event — ignore
        }
      }
    });

    child.stdin.on("error", () => {
      // Ignore EPIPE — handled by child.on("close")
    });
    child.stdin.write(prompt);
    child.stdin.end();

    let stderrOutput = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    child.on("error", (err) => {
      spinner.fail(`Failed to launch Claude CLI: ${err.message}`);
      resolve(false);
    });

    child.on("close", (code) => {
      process.off("SIGINT", cleanup);
      process.off("SIGTERM", cleanup);

      if (code === 0) {
        spinner.succeed("Claude analysis complete!");
        resolve(true);
      } else {
        spinner.fail(`Claude exited with code ${code}`);
        if (lastResultMessage) {
          console.error(pc.yellow(lastResultMessage));
        }
        if (stderrOutput.trim()) {
          console.error(pc.gray(stderrOutput.trim()));
        }
        resolve(false);
      }
    });
  });
}

/**
 * Verify which .claude/ files were actually created by Claude.
 */
function getGeneratedFiles(projectDir: string): string[] {
  const claudeDir = path.join(projectDir, ".claude");
  const files: string[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(path.relative(projectDir, fullPath));
      }
    }
  }

  walk(claudeDir);
  return files;
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
  checkForUpdate();

  const projectDir = process.cwd();

  // --- Subcommand: --check (health audit, exit with score) ---
  if (args.check) {
    const claudeDir = path.join(projectDir, ".claude");
    if (!fs.existsSync(claudeDir)) {
      console.error(pc.red("No .claude/ directory found. Run claude-code-starter first."));
      process.exit(1);
    }

    const result = checkHealth(projectDir);
    console.log(pc.bold("Health Check"));
    console.log();

    for (const item of result.items) {
      const icon = item.passed ? pc.green("PASS") : pc.red("FAIL");
      console.log(`  ${icon} ${item.name} (${item.score}/${item.maxScore})`);
      console.log(pc.gray(`       ${item.message}`));
    }

    console.log();
    const pct = Math.round((result.score / result.maxScore) * 100);
    const scoreColor = pct >= 70 ? pc.green : pct >= 40 ? pc.yellow : pc.red;
    console.log(scoreColor(`Score: ${result.score}/${result.maxScore} (${pct}%)`));

    process.exit(pct >= 60 ? 0 : 1);
  }

  // --- Subcommand: --tune (health report + suggestions) ---
  if (args.tune) {
    const claudeDir = path.join(projectDir, ".claude");
    if (!fs.existsSync(claudeDir)) {
      console.error(pc.red("No .claude/ directory found. Run claude-code-starter first."));
      process.exit(1);
    }

    console.log(pc.gray("Analyzing existing .claude/ configuration..."));
    console.log();

    const projectInfo = analyzeRepository(projectDir);
    showTechStack(projectInfo, args.verbose);

    const result = checkHealth(projectDir);
    console.log(pc.bold("Configuration Health"));
    console.log();

    for (const item of result.items) {
      const icon = item.passed ? pc.green("PASS") : pc.yellow("WARN");
      console.log(`  ${icon} ${item.name} (${item.score}/${item.maxScore})`);
      console.log(pc.gray(`       ${item.message}`));
    }

    console.log();
    const pct = Math.round((result.score / result.maxScore) * 100);
    const scoreColor = pct >= 70 ? pc.green : pct >= 40 ? pc.yellow : pc.red;
    console.log(scoreColor(`Score: ${result.score}/${result.maxScore} (${pct}%)`));

    const failing = result.items.filter((i) => !i.passed);
    if (failing.length > 0) {
      console.log();
      console.log(pc.bold("Suggestions:"));
      for (const item of failing) {
        console.log(`  - ${item.message}`);
      }
      console.log();
      console.log(
        pc.gray("Run claude-code-starter again to regenerate, or --refresh for settings only")
      );
    }

    return;
  }

  // --- Subcommand: --export ---
  if (args.exportPath) {
    const claudeDir = path.join(projectDir, ".claude");
    if (!fs.existsSync(claudeDir)) {
      console.error(pc.red("No .claude/ directory found. Nothing to export."));
      process.exit(1);
    }

    const config = exportConfig(projectDir, args.exportPath);
    const fileCount =
      Object.keys(config.skills).length +
      Object.keys(config.agents).length +
      Object.keys(config.rules).length +
      Object.keys(config.commands).length +
      Object.keys(config.hooks).length +
      (config.claudeMd ? 1 : 0) +
      (config.settings ? 1 : 0);
    console.log(pc.green(`Exported ${fileCount} files to ${args.exportPath}`));
    return;
  }

  // --- Subcommand: --import ---
  if (args.importPath) {
    if (!fs.existsSync(args.importPath)) {
      console.error(pc.red(`File not found: ${args.importPath}`));
      process.exit(1);
    }

    const written = importConfig(args.importPath, projectDir, args.force);
    if (written.length === 0) {
      console.log(pc.yellow("No files written (all already exist). Use -f to overwrite."));
    } else {
      console.log(pc.green(`Imported ${written.length} files:`));
      for (const file of written) {
        console.log(pc.green(`  + ${file}`));
      }
    }
    return;
  }

  // --- Subcommand: --template (explicit or auto-detected .claude-template.json) ---
  const templatePath = args.template || findProjectTemplate(projectDir);
  if (templatePath) {
    const template = loadTemplate(templatePath);
    if (!template) {
      console.error(pc.red(`Invalid or missing template: ${templatePath}`));
      process.exit(1);
    }

    // Write template to a temp file in os.tmpdir and import it
    const tmpPath = path.join(os.tmpdir(), `.claude-template-import-${Date.now()}.json`);
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(template, null, 2));
      const written = importConfig(tmpPath, projectDir, args.force);
      console.log(pc.green(`Applied template: ${written.length} files written`));
      for (const file of written) {
        console.log(pc.green(`  + ${file}`));
      }
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Cleanup silently
      }
    }
    return;
  }

  // Step 1: Analyze the repository
  console.log(pc.gray("Analyzing repository..."));
  console.log();

  const projectInfo = analyzeRepository(projectDir);

  // Show tech stack analysis
  showTechStack(projectInfo, args.verbose);

  // Tools-only mode: write settings + extras, skip Claude analysis
  if (args.refresh) {
    console.log(pc.gray("Setting up .claude/ directory structure..."));
    console.log();

    writeSettings(projectDir, projectInfo.techStack);
    ensureDirectories(projectDir);

    console.log(pc.green("Updated:"));
    console.log(pc.green("  + .claude/settings.json"));
    console.log();

    await promptExtras(projectDir);

    console.log();
    console.log(pc.green("Done!"));
    console.log();
    return;
  }

  // Step 2: Handle new projects
  let preferences: NewProjectPreferences | null = null;

  if (!projectInfo.isExisting) {
    preferences = await promptNewProject(args);

    if (preferences) {
      // Update tech stack with user preferences
      projectInfo.techStack.primaryLanguage = preferences.primaryLanguage;
      if (preferences.framework) {
        projectInfo.techStack.primaryFramework = preferences.framework;
        projectInfo.techStack.frameworks = [preferences.framework];
      }
      if (preferences.packageManager) {
        projectInfo.techStack.packageManager = preferences.packageManager;
      }
      if (preferences.testingFramework) {
        projectInfo.techStack.testingFramework = preferences.testingFramework;
      }
      if (preferences.linter) {
        projectInfo.techStack.linter = preferences.linter;
      }
      if (preferences.formatter) {
        projectInfo.techStack.formatter = preferences.formatter;
      }
      projectInfo.description = preferences.description;
    }
  } else {
    console.log(pc.gray(`Existing project with ${projectInfo.fileCount} source files`));
    console.log();
  }

  // Step 3: Check for existing CLAUDE.md and decide mode
  let claudeMdMode: "keep" | "improve" | "replace" = "replace";
  let existingClaudeMd: string | null = null;

  const claudeMdPath = path.join(projectDir, ".claude", "CLAUDE.md");
  if (fs.existsSync(claudeMdPath)) {
    existingClaudeMd = fs.readFileSync(claudeMdPath, "utf-8");

    if (args.force) {
      claudeMdMode = "replace";
    } else if (args.interactive) {
      console.log(pc.yellow("Existing CLAUDE.md detected"));
      console.log();

      const { mode } = await prompts({
        type: "select",
        name: "mode",
        message: "How should we handle the existing CLAUDE.md?",
        choices: [
          { title: "Improve — scan and enhance the existing file", value: "improve" },
          { title: "Replace — generate a new one from scratch", value: "replace" },
          { title: "Keep — leave CLAUDE.md as-is, regenerate other files", value: "keep" },
        ],
        initial: 0,
      });

      if (mode === undefined) {
        console.log(pc.gray("Cancelled."));
        process.exit(0);
      }

      claudeMdMode = mode;
    }
    console.log();
  }

  // Step 4: Require Claude CLI
  if (!checkClaudeCli()) {
    console.error(pc.red("Claude CLI is required but not found."));
    console.error(pc.gray("Install it from: https://claude.ai/download"));
    process.exit(1);
  }

  // Step 5: Write settings.json and ensure directories
  console.log(pc.gray("Setting up .claude/ directory structure..."));
  console.log();

  writeSettings(projectDir, projectInfo.techStack, args.force);
  ensureDirectories(projectDir);

  console.log(pc.green("Created:"));
  console.log(pc.green("  + .claude/settings.json"));
  console.log();

  // Step 6: Run Claude-powered deep analysis for all .claude/ content files
  const success = await runClaudeAnalysis(projectDir, projectInfo, {
    claudeMdMode,
    existingClaudeMd: claudeMdMode === "improve" ? existingClaudeMd : null,
    noMemory: args.noMemory,
  });

  if (!success) {
    console.error(pc.red("Claude analysis failed. Please try again."));
    process.exit(1);
  }

  // Step 7: Validate and deduplicate artifacts
  const validation = validateArtifacts(projectDir);
  if (validation.duplicationsRemoved > 0) {
    console.log(
      pc.gray(
        `  Deduplication: removed ${validation.duplicationsRemoved} redundancies from ${validation.filesModified} files`
      )
    );
  }

  // Step 8: Show summary
  const generatedFiles = getGeneratedFiles(projectDir);
  console.log();
  console.log(pc.green(`Done! (${generatedFiles.length} files)`));
  console.log();

  console.log(pc.bold("Generated for your stack:"));
  const skills = generatedFiles.filter((f) => f.includes("/skills/"));
  const agents = generatedFiles.filter((f) => f.includes("/agents/"));
  const rules = generatedFiles.filter((f) => f.includes("/rules/"));
  const commands = generatedFiles.filter((f) => f.includes("/commands/"));

  if (generatedFiles.some((f) => f.endsWith("CLAUDE.md"))) {
    console.log(pc.cyan("  CLAUDE.md (deep analysis by Claude)"));
  }
  if (skills.length > 0) {
    console.log(
      `  ${skills.length} skills (${skills.map((s) => path.basename(s, ".md")).join(", ")})`
    );
  }
  if (agents.length > 0) {
    console.log(
      `  ${agents.length} agents (${agents.map((a) => path.basename(a, ".md")).join(", ")})`
    );
  }
  if (rules.length > 0) {
    console.log(`  ${rules.length} rules`);
  }
  if (commands.length > 0) {
    console.log(`  ${commands.length} commands`);
  }

  console.log();
  // Step 9: Offer optional extras (safety hook, statusline, etc.)
  if (args.interactive) {
    console.log();
    await promptExtras(projectDir);
  }

  console.log();
  console.log(`${pc.cyan("Next step:")} Run ${pc.bold("claude")} to start working!`);
  console.log();
  console.log(
    pc.gray(
      "Your .claude/ files were generated by deep analysis - review them with: ls -la .claude/"
    )
  );
}

// Only run when executed directly, not when imported by tests
// Use realpathSync to resolve symlinks (e.g., global npm installs link bin/ -> dist/cli.js)
try {
  const isMain =
    process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  if (isMain) {
    main().catch((err) => {
      console.error(pc.red("Error:"), err.message);
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
      process.exit(1);
    });
  }
} catch {
  // Ignore errors from realpathSync (e.g., when argv[1] is undefined)
}
