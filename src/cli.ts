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
import path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import prompts from "prompts";
import { analyzeRepository, summarizeTechStack } from "./analyzer.js";
import { ensureDirectories, writeSettings } from "./generator.js";
import { getAnalysisPrompt } from "./prompt.js";
import type {
  Args,
  Formatter,
  Framework,
  Language,
  Linter,
  NewProjectPreferences,
  ProjectInfo,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
).version;

// ============================================================================
// Exported Functions (testable)
// ============================================================================

export function parseArgs(args: string[]): Args {
  return {
    help: args.includes("-h") || args.includes("--help"),
    version: args.includes("-v") || args.includes("--version"),
    force: args.includes("-f") || args.includes("--force"),
    interactive: !args.includes("--no-interactive") && !args.includes("-y"),
    verbose: args.includes("--verbose") || args.includes("-V"),
  };
}

export function getVersion(): string {
  return VERSION;
}

// ============================================================================
// Internal Functions
// ============================================================================

export function showHelp(): void {
  console.log(`
${pc.cyan("Claude Code Starter")} v${VERSION}

Bootstrap intelligent Claude Code configurations for any repository.

${pc.bold("USAGE")}
  npx claude-code-starter [OPTIONS]

${pc.bold("OPTIONS")}
  -h, --help          Show this help message
  -v, --version       Show version number
  -f, --force         Force overwrite existing .claude files
  -y, --no-interactive  Skip interactive prompts (use defaults)
  -V, --verbose       Show detailed output

${pc.bold("WHAT IT DOES")}
  1. Analyzes your repository's tech stack
  2. Launches Claude CLI to deeply analyze your codebase
  3. Generates all .claude/ configuration files:
     - CLAUDE.md with project-specific instructions (via Claude analysis)
     - Skills for your frameworks and workflows
     - Agents for code review and testing
     - Rules matching your code style
     - Commands for task management

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
      { title: "ESLint", value: "eslint" },
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

export function createTaskFile(
  projectInfo: ProjectInfo,
  preferences: NewProjectPreferences | null
): void {
  const taskPath = path.join(projectInfo.rootDir, ".claude", "state", "task.md");

  // Create state directory
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });

  // Don't overwrite existing task file
  if (fs.existsSync(taskPath)) {
    return;
  }

  let content: string;

  if (projectInfo.isExisting) {
    content = `# Current Task

## Status: Ready

No active task. Start one with \`/task <description>\`.

## Project Summary

${projectInfo.name}${projectInfo.description ? ` - ${projectInfo.description}` : ""}

**Tech Stack:** ${summarizeTechStack(projectInfo.techStack)}

## Quick Commands

- \`/task\` - Start working on something
- \`/status\` - See current state
- \`/analyze\` - Deep dive into code
- \`/done\` - Mark task complete
`;
  } else {
    const description = preferences?.description || "Explore and set up project";
    content = `# Current Task

## Status: In Progress

**Task:** ${description}

## Context

New project - setting up from scratch.

${preferences?.framework ? `**Framework:** ${formatFramework(preferences.framework)}` : ""}
${preferences?.primaryLanguage ? `**Language:** ${formatLanguage(preferences.primaryLanguage)}` : ""}

## Next Steps

1. Define project structure
2. Set up development environment
3. Start implementation

## Decisions

(None yet - starting fresh)
`;
  }

  fs.writeFileSync(taskPath, content);
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
export function runClaudeAnalysis(projectDir: string, projectInfo: ProjectInfo): Promise<boolean> {
  return new Promise((resolve) => {
    const prompt = getAnalysisPrompt(projectInfo);

    console.log(pc.cyan("Launching Claude for deep project analysis..."));
    console.log(
      pc.gray("Claude will read your codebase and generate all .claude/ configuration files")
    );
    console.log();

    const child = spawn(
      "claude",
      [
        "-p",
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
        stdio: ["pipe", "inherit", "inherit"],
      }
    );

    child.stdin.write(prompt);
    child.stdin.end();

    child.on("error", (err) => {
      console.error(pc.red(`Failed to launch Claude CLI: ${err.message}`));
      resolve(false);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log();
        console.log(pc.green("Claude analysis complete!"));
        resolve(true);
      } else {
        console.error(pc.red(`Claude exited with code ${code}`));
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

  const projectDir = process.cwd();

  // Step 1: Analyze the repository
  console.log(pc.gray("Analyzing repository..."));
  console.log();

  const projectInfo = analyzeRepository(projectDir);

  // Show tech stack analysis
  showTechStack(projectInfo, args.verbose);

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

  // Step 3: Check for existing Claude configuration
  if (projectInfo.techStack.hasClaudeConfig && !args.force) {
    console.log(pc.yellow("Existing .claude/ configuration detected"));
    console.log();

    if (args.interactive) {
      const { proceed } = await prompts({
        type: "confirm",
        name: "proceed",
        message: "Update existing configuration? (preserves task state)",
        initial: true,
      });

      if (!proceed) {
        console.log(pc.gray("Cancelled. Use --force to overwrite."));
        process.exit(0);
      }
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

  writeSettings(projectDir, projectInfo.techStack);
  ensureDirectories(projectDir);

  console.log(pc.green("Created:"));
  console.log(pc.green("  + .claude/settings.json"));
  console.log();

  // Step 6: Create task file
  createTaskFile(projectInfo, preferences);

  // Step 7: Run Claude-powered deep analysis for all .claude/ content files
  const success = await runClaudeAnalysis(projectDir, projectInfo);

  if (!success) {
    console.error(pc.red("Claude analysis failed. Please try again."));
    process.exit(1);
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
