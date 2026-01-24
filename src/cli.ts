/**
 * @module cli
 * @description Main CLI entry point for Claude Code Starter.
 *
 * This module orchestrates the entire CLI workflow:
 * 1. Parse command-line arguments
 * 2. Analyze the repository (via analyzer module)
 * 3. Prompt for preferences (new projects only)
 * 4. Generate artifacts (via generator module)
 * 5. Write artifacts to disk
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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import prompts from "prompts";
import { analyzeRepository, summarizeTechStack } from "./analyzer.js";
import { generateArtifacts, writeArtifacts } from "./generator.js";
import type { Args, Framework, Language, NewProjectPreferences, ProjectInfo } from "./types.js";

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

function showHelp(): void {
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
  2. Detects frameworks, languages, and tools
  3. Generates tailored Claude Code configurations:
     - CLAUDE.md with project-specific instructions
     - Skills for your frameworks (Next.js, FastAPI, etc.)
     - Agents for code review and testing
     - Rules matching your code style

${pc.bold("MORE INFO")}
  https://github.com/cassmtnr/claude-code-starter
`);
}

function showBanner(): void {
  console.log(pc.cyan("╔═════════════════════════════════════════════════╗"));
  console.log(pc.cyan(`║   Claude Code Starter v${VERSION.padEnd(24)}║`));
  console.log(pc.cyan("║   Intelligent AI-Assisted Development Setup     ║"));
  console.log(pc.cyan("╚═════════════════════════════════════════════════╝"));
  console.log();
}

function showTechStack(projectInfo: ProjectInfo, verbose: boolean): void {
  const { techStack } = projectInfo;

  console.log(pc.blue("📊 Tech Stack Analysis"));
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

async function promptNewProject(args: Args): Promise<NewProjectPreferences | null> {
  if (!args.interactive) {
    return null;
  }

  console.log(pc.yellow("🆕 New project detected - let's set it up!"));
  console.log();

  const response = await prompts([
    {
      type: "text",
      name: "description",
      message: "What are you building?",
      initial: "A new project",
    },
    {
      type: "select",
      name: "primaryLanguage",
      message: "Primary language?",
      choices: [
        { title: "TypeScript", value: "typescript" },
        { title: "JavaScript", value: "javascript" },
        { title: "Python", value: "python" },
        { title: "Go", value: "go" },
        { title: "Rust", value: "rust" },
        { title: "Other", value: null },
      ],
    },
    {
      type: (prev) => (prev === "typescript" || prev === "javascript" ? "select" : null),
      name: "framework",
      message: "Framework?",
      choices: [
        { title: "Next.js", value: "nextjs" },
        { title: "React", value: "react" },
        { title: "Vue", value: "vue" },
        { title: "Svelte", value: "svelte" },
        { title: "Express", value: "express" },
        { title: "NestJS", value: "nestjs" },
        { title: "Hono", value: "hono" },
        { title: "None / Other", value: null },
      ],
    },
    {
      type: (_, values) => (values.primaryLanguage === "python" ? "select" : null),
      name: "framework",
      message: "Framework?",
      choices: [
        { title: "FastAPI", value: "fastapi" },
        { title: "Django", value: "django" },
        { title: "Flask", value: "flask" },
        { title: "None / Other", value: null },
      ],
    },
  ]);

  if (!response.description) {
    return null; // User cancelled
  }

  return {
    description: response.description,
    primaryLanguage: response.primaryLanguage || "typescript",
    framework: response.framework || null,
    includeTests: true,
    includeLinting: true,
  };
}

function createTaskFile(projectInfo: ProjectInfo, preferences: NewProjectPreferences | null): void {
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

function formatLanguage(lang: Language): string {
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

function formatFramework(fw: Framework): string {
  const names: Record<string, string> = {
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
    tailwind: "Tailwind CSS",
    shadcn: "shadcn/ui",
    chakra: "Chakra UI",
    mui: "Material UI",
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
  console.log(pc.blue("🔍 Analyzing repository..."));
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
      projectInfo.description = preferences.description;
    }
  } else {
    console.log(pc.green(`📁 Existing project · ${projectInfo.fileCount} source files`));
    console.log();
  }

  // Step 3: Check for existing Claude configuration
  if (projectInfo.techStack.hasClaudeConfig && !args.force) {
    console.log(pc.yellow("⚠️  Existing .claude/ configuration detected"));
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

  // Step 4: Generate artifacts
  console.log(pc.blue("⚙️  Generating Claude Code configuration..."));
  console.log();

  const result = generateArtifacts(projectInfo);

  // Step 5: Write artifacts to disk
  const { created, updated, skipped } = writeArtifacts(result.artifacts, projectDir, args.force);

  // Show results
  if (created.length > 0) {
    console.log(pc.green("  Created:"));
    for (const file of created) {
      console.log(pc.green(`    ✓ ${file}`));
    }
  }

  if (updated.length > 0) {
    console.log(pc.blue("  Updated:"));
    for (const file of updated) {
      console.log(pc.blue(`    ↻ ${file}`));
    }
  }

  if (skipped.length > 0 && args.verbose) {
    console.log(pc.gray("  Preserved:"));
    for (const file of skipped) {
      console.log(pc.gray(`    - ${file}`));
    }
  }

  console.log();

  // Step 6: Create task file
  createTaskFile(projectInfo, preferences);

  // Step 7: Show summary
  const totalFiles = created.length + updated.length;
  console.log(pc.green(`✅ Configuration complete! (${totalFiles} files)`));
  console.log();

  // Show what was generated
  console.log(pc.bold("Generated for your stack:"));

  const skills = result.artifacts.filter((a) => a.type === "skill");
  const agents = result.artifacts.filter((a) => a.type === "agent");
  const rules = result.artifacts.filter((a) => a.type === "rule");

  if (skills.length > 0) {
    console.log(
      `  📚 ${skills.length} skills (${skills.map((s) => path.basename(s.path, ".md")).join(", ")})`
    );
  }
  if (agents.length > 0) {
    console.log(
      `  🤖 ${agents.length} agents (${agents.map((a) => path.basename(a.path, ".md")).join(", ")})`
    );
  }
  if (rules.length > 0) {
    console.log(`  📏 ${rules.length} rules`);
  }

  console.log();
  console.log(`${pc.cyan("Next step:")} Run ${pc.bold("claude")} to start working!`);
  console.log();

  // Tips based on project state
  if (!projectInfo.isExisting) {
    console.log(pc.gray("💡 Tip: Use /task to define your first task"));
  } else {
    console.log(pc.gray("💡 Tip: Use /analyze to explore specific areas of your codebase"));
  }
}

main().catch((err) => {
  console.error(pc.red("Error:"), err.message);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
