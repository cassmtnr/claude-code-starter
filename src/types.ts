/**
 * @module types
 * @description Core type definitions for Claude Code Starter.
 *
 * This module defines all TypeScript interfaces and types used across the application:
 * - CLI argument types
 * - Tech stack detection types (languages, frameworks, tools)
 * - Project analysis types
 * - Artifact generation types
 *
 * @example
 * import type { TechStack, ProjectInfo } from './types.js';
 */

// ============================================================================
// Core Types for Claude Code Starter
// ============================================================================

/**
 * CLI Arguments
 */
export interface Args {
  help: boolean;
  version: boolean;
  force: boolean;
  interactive: boolean; // New: enable/disable interactive mode
  verbose: boolean; // New: show detailed output
}

/**
 * Detected technology stack information
 */
export interface TechStack {
  // Languages detected
  languages: Language[];
  primaryLanguage: Language | null;

  // Frameworks and libraries
  frameworks: Framework[];
  primaryFramework: Framework | null;

  // Development tools
  packageManager: PackageManager | null;
  testingFramework: TestingFramework | null;
  linter: Linter | null;
  formatter: Formatter | null;
  bundler: Bundler | null;

  // Project characteristics
  isMonorepo: boolean;
  hasDocker: boolean;
  hasCICD: boolean;
  cicdPlatform: CICDPlatform | null;

  // Existing Claude Code configuration
  hasClaudeConfig: boolean;
  existingClaudeFiles: string[];
}

/**
 * Programming languages
 */
export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "ruby"
  | "csharp"
  | "swift"
  | "kotlin"
  | "php"
  | "cpp";

/**
 * Frameworks and libraries
 */
export type Framework =
  // JavaScript/TypeScript Frontend
  | "nextjs"
  | "react"
  | "vue"
  | "nuxt"
  | "svelte"
  | "sveltekit"
  | "angular"
  | "astro"
  | "remix"
  | "gatsby"
  | "solid"
  // JavaScript/TypeScript Backend
  | "express"
  | "nestjs"
  | "fastify"
  | "hono"
  | "elysia"
  | "koa"
  // Python
  | "fastapi"
  | "django"
  | "flask"
  | "starlette"
  // Go
  | "gin"
  | "echo"
  | "fiber"
  // Rust
  | "actix"
  | "axum"
  | "rocket"
  // Ruby
  | "rails"
  | "sinatra"
  // Java/Kotlin
  | "spring"
  | "quarkus"
  // CSS/UI
  | "tailwind"
  | "shadcn"
  | "chakra"
  | "mui"
  // Database/ORM
  | "prisma"
  | "drizzle"
  | "typeorm"
  | "sequelize"
  | "mongoose"
  | "sqlalchemy";

/**
 * Package managers
 */
export type PackageManager =
  | "npm"
  | "yarn"
  | "pnpm"
  | "bun"
  | "pip"
  | "poetry"
  | "cargo"
  | "go"
  | "bundler"
  | "maven"
  | "gradle";

/**
 * Testing frameworks
 */
export type TestingFramework =
  | "jest"
  | "vitest"
  | "mocha"
  | "bun-test"
  | "playwright"
  | "cypress"
  | "pytest"
  | "unittest"
  | "go-test"
  | "rust-test"
  | "rspec"
  | "junit";

/**
 * Linters
 */
export type Linter =
  | "eslint"
  | "biome"
  | "pylint"
  | "flake8"
  | "ruff"
  | "golangci-lint"
  | "clippy"
  | "rubocop";

/**
 * Formatters
 */
export type Formatter = "prettier" | "biome" | "black" | "ruff" | "gofmt" | "rustfmt" | "rubocop";

/**
 * Bundlers
 */
export type Bundler =
  | "webpack"
  | "vite"
  | "esbuild"
  | "tsup"
  | "rollup"
  | "parcel"
  | "turbopack"
  | "rspack";

/**
 * CI/CD platforms
 */
export type CICDPlatform =
  | "github-actions"
  | "gitlab-ci"
  | "circleci"
  | "jenkins"
  | "travis"
  | "azure-devops";

/**
 * Project information from analysis
 */
export interface ProjectInfo {
  isExisting: boolean;
  fileCount: number;
  techStack: TechStack;
  rootDir: string;
  name: string;
  description: string | null;
}

/**
 * User preferences for new projects
 */
export interface NewProjectPreferences {
  description: string;
  primaryLanguage: Language;
  framework: Framework | null;
  includeTests: boolean;
  includeLinting: boolean;
}

/**
 * Generated artifact
 */
export interface GeneratedArtifact {
  type: "skill" | "agent" | "rule" | "command" | "claude-md" | "settings";
  path: string;
  content: string;
  isNew: boolean; // true if creating new, false if merging
}

/**
 * Generation result
 */
export interface GenerationResult {
  artifacts: GeneratedArtifact[];
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
}

/**
 * Skill definition template
 */
export interface SkillTemplate {
  name: string;
  description: string;
  globs: string[];
  content: string;
  appliesTo: {
    languages?: Language[];
    frameworks?: Framework[];
  };
}

/**
 * Agent definition template
 */
export interface AgentTemplate {
  name: string;
  description: string;
  tools: string[];
  disallowedTools?: string[];
  model?: "sonnet" | "opus" | "haiku";
  content: string;
  appliesTo: {
    languages?: Language[];
    frameworks?: Framework[];
  };
}

/**
 * Rule definition template
 */
export interface RuleTemplate {
  name: string;
  paths?: string[];
  content: string;
  appliesTo: {
    languages?: Language[];
    frameworks?: Framework[];
  };
}
