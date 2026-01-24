/**
 * @module analyzer
 * @description Repository analysis and tech stack detection.
 *
 * This module examines a project directory to detect:
 * - Programming languages (TypeScript, Python, Go, Rust, etc.)
 * - Web frameworks (Next.js, FastAPI, NestJS, etc.)
 * - Package managers (npm, yarn, pnpm, bun, pip, cargo)
 * - Testing frameworks (Jest, Vitest, Pytest, etc.)
 * - Linters and formatters
 * - CI/CD configurations
 *
 * Detection is based on:
 * - File extensions present in the project
 * - Configuration files (package.json, pyproject.toml, etc.)
 * - Lock files (bun.lockb, yarn.lock, etc.)
 * - Dependency declarations
 *
 * @example
 * import { analyzeRepository, detectTechStack } from './analyzer.js';
 *
 * const projectInfo = analyzeRepository('/path/to/project');
 * console.log(projectInfo.techStack.primaryLanguage); // 'typescript'
 */

import fs from "node:fs";
import path from "node:path";
import type {
  Bundler,
  CICDPlatform,
  Formatter,
  Framework,
  Language,
  Linter,
  PackageManager,
  ProjectInfo,
  TechStack,
  TestingFramework,
} from "./types.js";

// ============================================================================
// Tech Stack Analyzer
// ============================================================================

/**
 * Analyze a repository and detect its tech stack
 */
export function analyzeRepository(rootDir: string): ProjectInfo {
  const techStack = detectTechStack(rootDir);
  const fileCount = countSourceFiles(rootDir, techStack.languages);
  const packageJson = readPackageJson(rootDir);

  return {
    isExisting: fileCount > 0,
    fileCount,
    techStack,
    rootDir,
    name: (packageJson?.name as string) || path.basename(rootDir),
    description: (packageJson?.description as string) || null,
  };
}

/**
 * Detect the complete tech stack of a project
 */
export function detectTechStack(rootDir: string): TechStack {
  const packageJson = readPackageJson(rootDir);
  const files = listRootFiles(rootDir);

  // Detect languages
  const languages = detectLanguages(rootDir, files, packageJson);
  const primaryLanguage = languages[0] || null;

  // Detect frameworks
  const frameworks = detectFrameworks(packageJson, files, rootDir);
  const primaryFramework = frameworks[0] || null;

  // Detect tools
  const packageManager = detectPackageManager(files);
  const testingFramework = detectTestingFramework(packageJson, files);
  const linter = detectLinter(packageJson, files);
  const formatter = detectFormatter(packageJson, files);
  const bundler = detectBundler(packageJson, files);

  // Detect project characteristics
  const isMonorepo = detectMonorepo(rootDir, files, packageJson);
  const hasDocker =
    files.includes("Dockerfile") ||
    files.includes("docker-compose.yml") ||
    files.includes("docker-compose.yaml");
  const { hasCICD, cicdPlatform } = detectCICD(rootDir, files);

  // Check for existing Claude Code configuration
  const { hasClaudeConfig, existingClaudeFiles } = detectExistingClaudeConfig(rootDir);

  return {
    languages,
    primaryLanguage,
    frameworks,
    primaryFramework,
    packageManager,
    testingFramework,
    linter,
    formatter,
    bundler,
    isMonorepo,
    hasDocker,
    hasCICD,
    cicdPlatform,
    hasClaudeConfig,
    existingClaudeFiles,
  };
}

// ============================================================================
// Detection Functions
// ============================================================================

function readPackageJson(rootDir: string): Record<string, unknown> | null {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  } catch {
    return null;
  }
}

function listRootFiles(rootDir: string): string[] {
  try {
    return fs.readdirSync(rootDir);
  } catch {
    return [];
  }
}

function detectLanguages(
  _rootDir: string,
  files: string[],
  packageJson: Record<string, unknown> | null
): Language[] {
  const languages: Language[] = [];
  const seen = new Set<Language>();

  const add = (lang: Language) => {
    if (!seen.has(lang)) {
      seen.add(lang);
      languages.push(lang);
    }
  };

  // TypeScript detection (prioritize over JS)
  if (
    files.includes("tsconfig.json") ||
    files.includes("tsconfig.base.json") ||
    hasDevDep(packageJson, "typescript") ||
    files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  ) {
    add("typescript");
  }

  // JavaScript detection
  if (
    packageJson ||
    files.some((f) => f.endsWith(".js") || f.endsWith(".mjs") || f.endsWith(".cjs"))
  ) {
    if (!seen.has("typescript")) {
      add("javascript");
    }
  }

  // Python detection
  if (
    files.includes("pyproject.toml") ||
    files.includes("setup.py") ||
    files.includes("requirements.txt") ||
    files.includes("Pipfile") ||
    files.some((f) => f.endsWith(".py"))
  ) {
    add("python");
  }

  // Go detection
  if (files.includes("go.mod") || files.includes("go.sum")) {
    add("go");
  }

  // Rust detection
  if (files.includes("Cargo.toml") || files.includes("Cargo.lock")) {
    add("rust");
  }

  // Ruby detection
  if (files.includes("Gemfile") || files.includes("Gemfile.lock")) {
    add("ruby");
  }

  // Java detection
  if (
    files.includes("pom.xml") ||
    files.includes("build.gradle") ||
    files.includes("build.gradle.kts")
  ) {
    add("java");
  }

  // Kotlin detection
  if (files.some((f) => f.endsWith(".kt") || f.endsWith(".kts"))) {
    add("kotlin");
  }

  // C# detection
  if (files.some((f) => f.endsWith(".csproj") || f.endsWith(".sln"))) {
    add("csharp");
  }

  // Swift detection
  if (files.includes("Package.swift") || files.some((f) => f.endsWith(".swift"))) {
    add("swift");
  }

  // PHP detection
  if (files.includes("composer.json") || files.some((f) => f.endsWith(".php"))) {
    add("php");
  }

  return languages;
}

function detectFrameworks(
  packageJson: Record<string, unknown> | null,
  files: string[],
  rootDir: string
): Framework[] {
  const frameworks: Framework[] = [];
  const seen = new Set<Framework>();

  const add = (fw: Framework) => {
    if (!seen.has(fw)) {
      seen.add(fw);
      frameworks.push(fw);
    }
  };

  if (!packageJson) {
    // Check Python frameworks
    const requirementsPath = path.join(rootDir, "requirements.txt");
    const pyprojectPath = path.join(rootDir, "pyproject.toml");

    let pythonDeps = "";
    if (fs.existsSync(requirementsPath)) {
      pythonDeps = fs.readFileSync(requirementsPath, "utf-8").toLowerCase();
    }
    if (fs.existsSync(pyprojectPath)) {
      pythonDeps += fs.readFileSync(pyprojectPath, "utf-8").toLowerCase();
    }

    if (pythonDeps.includes("fastapi")) add("fastapi");
    if (pythonDeps.includes("django")) add("django");
    if (pythonDeps.includes("flask")) add("flask");
    if (pythonDeps.includes("starlette")) add("starlette");
    if (pythonDeps.includes("sqlalchemy")) add("sqlalchemy");

    // Check Ruby frameworks
    const gemfilePath = path.join(rootDir, "Gemfile");
    if (fs.existsSync(gemfilePath)) {
      const gemfile = fs.readFileSync(gemfilePath, "utf-8").toLowerCase();
      if (gemfile.includes("rails")) add("rails");
      if (gemfile.includes("sinatra")) add("sinatra");
    }

    // Check Go frameworks
    const goModPath = path.join(rootDir, "go.mod");
    if (fs.existsSync(goModPath)) {
      const goMod = fs.readFileSync(goModPath, "utf-8").toLowerCase();
      if (goMod.includes("gin-gonic")) add("gin");
      if (goMod.includes("labstack/echo")) add("echo");
      if (goMod.includes("gofiber")) add("fiber");
    }

    // Check Rust frameworks
    const cargoPath = path.join(rootDir, "Cargo.toml");
    if (fs.existsSync(cargoPath)) {
      const cargo = fs.readFileSync(cargoPath, "utf-8").toLowerCase();
      if (cargo.includes("actix")) add("actix");
      if (cargo.includes("axum")) add("axum");
      if (cargo.includes("rocket")) add("rocket");
    }

    return frameworks;
  }

  const allDeps = {
    ...((packageJson.dependencies as Record<string, string>) || {}),
    ...((packageJson.devDependencies as Record<string, string>) || {}),
  };

  // Frontend frameworks (order matters - more specific first)
  if (allDeps.next) add("nextjs");
  else if (allDeps.nuxt || allDeps.nuxt3) add("nuxt");
  else if (allDeps["@sveltejs/kit"]) add("sveltekit");
  else if (allDeps.svelte) add("svelte");
  else if (allDeps.astro) add("astro");
  else if (allDeps["@remix-run/react"]) add("remix");
  else if (allDeps.gatsby) add("gatsby");
  else if (allDeps["solid-js"]) add("solid");
  else if (allDeps["@angular/core"]) add("angular");
  else if (allDeps.vue) add("vue");
  else if (allDeps.react) add("react");

  // Backend frameworks
  if (allDeps["@nestjs/core"]) add("nestjs");
  if (allDeps.express) add("express");
  if (allDeps.fastify) add("fastify");
  if (allDeps.hono) add("hono");
  if (allDeps.elysia) add("elysia");
  if (allDeps.koa) add("koa");

  // CSS/UI frameworks
  if (allDeps.tailwindcss) add("tailwind");
  if (files.includes("components.json")) add("shadcn"); // shadcn/ui indicator
  if (allDeps["@chakra-ui/react"]) add("chakra");
  if (allDeps["@mui/material"]) add("mui");

  // Database/ORM
  if (allDeps.prisma || allDeps["@prisma/client"]) add("prisma");
  if (allDeps["drizzle-orm"]) add("drizzle");
  if (allDeps.typeorm) add("typeorm");
  if (allDeps.sequelize) add("sequelize");
  if (allDeps.mongoose) add("mongoose");

  return frameworks;
}

function detectPackageManager(files: string[]): PackageManager | null {
  // Order matters - check lock files first
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("package-lock.json")) return "npm";

  // Python
  if (files.includes("poetry.lock")) return "poetry";
  if (files.includes("Pipfile.lock") || files.includes("requirements.txt")) return "pip";

  // Others
  if (files.includes("Cargo.lock")) return "cargo";
  if (files.includes("go.sum")) return "go";
  if (files.includes("Gemfile.lock")) return "bundler";
  if (files.includes("pom.xml")) return "maven";
  if (files.includes("build.gradle") || files.includes("build.gradle.kts")) return "gradle";

  return null;
}

function detectTestingFramework(
  packageJson: Record<string, unknown> | null,
  files: string[]
): TestingFramework | null {
  if (packageJson) {
    const allDeps = {
      ...((packageJson.dependencies as Record<string, string>) || {}),
      ...((packageJson.devDependencies as Record<string, string>) || {}),
    };

    if (allDeps.vitest) return "vitest";
    if (allDeps.jest) return "jest";
    if (allDeps.mocha) return "mocha";
    if (allDeps["@playwright/test"]) return "playwright";
    if (allDeps.cypress) return "cypress";

    // Check if using bun's built-in test
    const scripts = (packageJson.scripts as Record<string, string>) || {};
    if (scripts.test?.includes("bun test")) return "bun-test";
  }

  // Check for pytest
  if (files.includes("pytest.ini") || files.includes("conftest.py")) return "pytest";
  if (files.includes("go.mod")) return "go-test";
  if (files.includes("Cargo.toml")) return "rust-test";
  if (files.includes("Gemfile")) return "rspec"; // Assume RSpec for Ruby

  return null;
}

function detectLinter(packageJson: Record<string, unknown> | null, files: string[]): Linter | null {
  // Check config files first
  if (
    files.some(
      (f) => f.startsWith("eslint.config") || f === ".eslintrc" || f.startsWith(".eslintrc.")
    )
  ) {
    return "eslint";
  }
  if (files.includes("biome.json") || files.includes("biome.jsonc")) return "biome";

  if (packageJson) {
    const allDeps = {
      ...((packageJson.dependencies as Record<string, string>) || {}),
      ...((packageJson.devDependencies as Record<string, string>) || {}),
    };

    if (allDeps.eslint) return "eslint";
    if (allDeps["@biomejs/biome"]) return "biome";
  }

  // Python linters
  if (files.includes("ruff.toml") || files.includes(".ruff.toml")) return "ruff";
  if (files.includes(".flake8") || files.includes("setup.cfg")) return "flake8";

  return null;
}

function detectFormatter(
  packageJson: Record<string, unknown> | null,
  files: string[]
): Formatter | null {
  if (
    files.some(
      (f) =>
        f.startsWith(".prettierrc") || f === "prettier.config.js" || f === "prettier.config.mjs"
    )
  ) {
    return "prettier";
  }
  if (files.includes("biome.json") || files.includes("biome.jsonc")) return "biome";

  if (packageJson) {
    const allDeps = {
      ...((packageJson.dependencies as Record<string, string>) || {}),
      ...((packageJson.devDependencies as Record<string, string>) || {}),
    };

    if (allDeps.prettier) return "prettier";
    if (allDeps["@biomejs/biome"]) return "biome";
  }

  // Python formatters
  if (files.includes("pyproject.toml")) {
    // Could check for black/ruff in pyproject.toml
    return "black";
  }

  return null;
}

function detectBundler(
  packageJson: Record<string, unknown> | null,
  files: string[]
): Bundler | null {
  if (files.some((f) => f.startsWith("vite.config"))) return "vite";
  if (files.some((f) => f.startsWith("webpack.config"))) return "webpack";
  if (files.includes("tsup.config.ts") || files.includes("tsup.config.js")) return "tsup";
  if (files.some((f) => f.startsWith("rollup.config"))) return "rollup";
  if (files.some((f) => f.startsWith("esbuild"))) return "esbuild";

  if (packageJson) {
    const allDeps = {
      ...((packageJson.dependencies as Record<string, string>) || {}),
      ...((packageJson.devDependencies as Record<string, string>) || {}),
    };

    if (allDeps.vite) return "vite";
    if (allDeps.webpack) return "webpack";
    if (allDeps.tsup) return "tsup";
    if (allDeps.esbuild) return "esbuild";
    if (allDeps.rollup) return "rollup";
    if (allDeps.parcel) return "parcel";
    if (allDeps["@vercel/turbopack"]) return "turbopack";
    if (allDeps["@rspack/core"]) return "rspack";
  }

  return null;
}

function detectMonorepo(
  rootDir: string,
  files: string[],
  packageJson: Record<string, unknown> | null
): boolean {
  // Check for monorepo config files
  if (files.includes("pnpm-workspace.yaml")) return true;
  if (files.includes("lerna.json")) return true;
  if (files.includes("nx.json")) return true;
  if (files.includes("turbo.json")) return true;

  // Check package.json workspaces
  if (packageJson?.workspaces) return true;

  // Check for packages or apps directory
  const packagesDir = path.join(rootDir, "packages");
  const appsDir = path.join(rootDir, "apps");
  if (fs.existsSync(packagesDir) && fs.statSync(packagesDir).isDirectory()) return true;
  if (fs.existsSync(appsDir) && fs.statSync(appsDir).isDirectory()) return true;

  return false;
}

function detectCICD(
  rootDir: string,
  files: string[]
): { hasCICD: boolean; cicdPlatform: CICDPlatform | null } {
  // GitHub Actions
  const githubDir = path.join(rootDir, ".github", "workflows");
  if (fs.existsSync(githubDir)) {
    return { hasCICD: true, cicdPlatform: "github-actions" };
  }

  // GitLab CI
  if (files.includes(".gitlab-ci.yml")) {
    return { hasCICD: true, cicdPlatform: "gitlab-ci" };
  }

  // CircleCI
  const circleDir = path.join(rootDir, ".circleci");
  if (fs.existsSync(circleDir)) {
    return { hasCICD: true, cicdPlatform: "circleci" };
  }

  // Travis CI
  if (files.includes(".travis.yml")) {
    return { hasCICD: true, cicdPlatform: "travis" };
  }

  // Azure DevOps
  if (files.includes("azure-pipelines.yml")) {
    return { hasCICD: true, cicdPlatform: "azure-devops" };
  }

  // Jenkinsfile
  if (files.includes("Jenkinsfile")) {
    return { hasCICD: true, cicdPlatform: "jenkins" };
  }

  return { hasCICD: false, cicdPlatform: null };
}

function detectExistingClaudeConfig(rootDir: string): {
  hasClaudeConfig: boolean;
  existingClaudeFiles: string[];
} {
  const claudeDir = path.join(rootDir, ".claude");
  const existingClaudeFiles: string[] = [];

  if (!fs.existsSync(claudeDir)) {
    // Check for root CLAUDE.md
    if (fs.existsSync(path.join(rootDir, "CLAUDE.md"))) {
      existingClaudeFiles.push("CLAUDE.md");
    }
    return { hasClaudeConfig: existingClaudeFiles.length > 0, existingClaudeFiles };
  }

  // Recursively find all files in .claude directory
  function findFiles(dir: string, prefix = ".claude"): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        findFiles(path.join(dir, entry.name), relativePath);
      } else {
        existingClaudeFiles.push(relativePath);
      }
    }
  }

  findFiles(claudeDir);
  return { hasClaudeConfig: true, existingClaudeFiles };
}

// ============================================================================
// Helper Functions
// ============================================================================

function hasDevDep(packageJson: Record<string, unknown> | null, dep: string): boolean {
  if (!packageJson) return false;
  const devDeps = (packageJson.devDependencies as Record<string, string>) || {};
  const deps = (packageJson.dependencies as Record<string, string>) || {};
  return dep in devDeps || dep in deps;
}

function countSourceFiles(rootDir: string, _languages: Language[]): number {
  // Always count all common source file extensions
  // This ensures we detect existing projects regardless of config file detection
  const extensions = [
    // JavaScript/TypeScript
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    // Python
    ".py",
    // Go
    ".go",
    // Rust
    ".rs",
    // Java/Kotlin
    ".java",
    ".kt",
    ".kts",
    // Ruby
    ".rb",
    // C#
    ".cs",
    // Swift
    ".swift",
    // PHP
    ".php",
    // C/C++
    ".c",
    ".cpp",
    ".cc",
    ".cxx",
    ".h",
    ".hpp",
  ];

  // Read .gitignore patterns
  const ignorePatterns = [
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "target",
    "dist",
    "build",
  ];
  const gitignorePath = path.join(rootDir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const lines = fs.readFileSync(gitignorePath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        ignorePatterns.push(trimmed.replace(/\/$/, ""));
      }
    }
  }

  function shouldIgnore(name: string): boolean {
    return ignorePatterns.some((pattern) => name === pattern || name.startsWith(`${pattern}/`));
  }

  let count = 0;
  function countFiles(dir: string, depth = 0): void {
    if (depth > 5) return; // Increased depth for more accurate count
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (shouldIgnore(entry.name)) continue;
        if (entry.isDirectory()) {
          countFiles(path.join(dir, entry.name), depth + 1);
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          count++;
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  countFiles(rootDir);
  return count;
}

/**
 * Generate a human-readable summary of the tech stack
 */
export function summarizeTechStack(stack: TechStack): string {
  const parts: string[] = [];

  if (stack.primaryLanguage) {
    parts.push(`Language: ${stack.primaryLanguage}`);
  }

  if (stack.primaryFramework) {
    parts.push(`Framework: ${stack.primaryFramework}`);
  }

  if (stack.packageManager) {
    parts.push(`Package Manager: ${stack.packageManager}`);
  }

  if (stack.testingFramework) {
    parts.push(`Testing: ${stack.testingFramework}`);
  }

  if (stack.isMonorepo) {
    parts.push("Monorepo: yes");
  }

  return parts.join(" | ");
}
