import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRepository, detectTechStack, summarizeTechStack } from "./analyzer.js";
import {
  checkClaudeCli,
  formatFramework,
  formatLanguage,
  getVersion,
  mapFormatter,
  parseArgs,
  promptNewProject,
  showBanner,
  showHelp,
  showTechStack,
} from "./cli.js";
import { ensureDirectories, generateSettings, writeSettings } from "./generator.js";
import { installHook } from "./hooks.js";
import { getAnalysisPrompt } from "./prompt.js";
import {
  extractCommands,
  extractConventionFingerprints,
  separateFrontmatter,
  validateArtifacts,
} from "./validator.js";

// ============================================================================
// Test Utilities
// ============================================================================

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "claude-code-starter-test-"));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ============================================================================
// CLI Argument Parsing Tests
// ============================================================================

describe("parseArgs", () => {
  it("parses help flag -h", () => {
    const args = parseArgs(["-h"]);
    expect(args.help).toBe(true);
  });

  it("parses help flag --help", () => {
    const args = parseArgs(["--help"]);
    expect(args.help).toBe(true);
  });

  it("parses version flag -v", () => {
    const args = parseArgs(["-v"]);
    expect(args.version).toBe(true);
  });

  it("parses version flag --version", () => {
    const args = parseArgs(["--version"]);
    expect(args.version).toBe(true);
  });

  it("parses force flag -f", () => {
    const args = parseArgs(["-f"]);
    expect(args.force).toBe(true);
  });

  it("parses force flag --force", () => {
    const args = parseArgs(["--force"]);
    expect(args.force).toBe(true);
  });

  it("parses interactive flag -y (no-interactive)", () => {
    const args = parseArgs(["-y"]);
    expect(args.interactive).toBe(false);
  });

  it("parses interactive flag --no-interactive", () => {
    const args = parseArgs(["--no-interactive"]);
    expect(args.interactive).toBe(false);
  });

  it("defaults interactive to true", () => {
    const args = parseArgs([]);
    expect(args.interactive).toBe(true);
  });

  it("parses verbose flag -V", () => {
    const args = parseArgs(["-V"]);
    expect(args.verbose).toBe(true);
  });

  it("parses verbose flag --verbose", () => {
    const args = parseArgs(["--verbose"]);
    expect(args.verbose).toBe(true);
  });

  it("parses multiple flags", () => {
    const args = parseArgs(["-f", "-V", "-y"]);
    expect(args.force).toBe(true);
    expect(args.verbose).toBe(true);
    expect(args.interactive).toBe(false);
  });

  it("returns false for unprovided flags", () => {
    const args = parseArgs([]);
    expect(args.help).toBe(false);
    expect(args.version).toBe(false);
    expect(args.force).toBe(false);
    expect(args.verbose).toBe(false);
  });
});

describe("getVersion", () => {
  it("returns a valid version string", () => {
    const version = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("showHelp", () => {
  it("displays help without throwing", () => {
    expect(() => showHelp()).not.toThrow();
  });
});

describe("showBanner", () => {
  it("displays banner without throwing", () => {
    expect(() => showBanner()).not.toThrow();
  });
});

describe("promptNewProject", () => {
  it("returns null when not interactive", async () => {
    const args = {
      help: false,
      version: false,
      force: false,
      interactive: false,
      verbose: false,
    };
    const result = await promptNewProject(args);
    expect(result).toBeNull();
  });

  it("returns preferences when user completes prompts", async () => {
    // Mock the prompts module
    mock.module("prompts", () => {
      return {
        default: async () => ({
          description: "Build an API",
          primaryLanguage: "typescript",
          framework: "nextjs",
          packageManager: "bun",
          testingFramework: "vitest",
          linter: "biome",
          projectType: "Web App",
        }),
      };
    });

    // Re-import to get mocked version
    const { promptNewProject: mockedPrompt } = await import("./cli.js");

    const args = {
      help: false,
      version: false,
      force: false,
      interactive: true,
      verbose: false,
    };

    const result = await mockedPrompt(args);
    expect(result).not.toBeNull();
    expect(result?.description).toBe("Build an API");
    expect(result?.primaryLanguage).toBe("typescript");
    expect(result?.framework).toBe("nextjs");
  });

  it("returns null when user cancels", async () => {
    // Mock prompts to return empty (user cancelled)
    mock.module("prompts", () => {
      return {
        default: async () => ({
          description: undefined, // User cancelled
        }),
      };
    });

    const { promptNewProject: mockedPrompt } = await import("./cli.js");

    const args = {
      help: false,
      version: false,
      force: false,
      interactive: true,
      verbose: false,
    };

    const result = await mockedPrompt(args);
    expect(result).toBeNull();
  });

  it("uses default language when not provided", async () => {
    mock.module("prompts", () => {
      return {
        default: async () => ({
          description: "My project",
          primaryLanguage: null, // No language selected
          framework: null,
          packageManager: null,
          testingFramework: null,
          linter: null,
          projectType: "Other",
        }),
      };
    });

    const { promptNewProject: mockedPrompt } = await import("./cli.js");

    const args = {
      help: false,
      version: false,
      force: false,
      interactive: true,
      verbose: false,
    };

    const result = await mockedPrompt(args);
    expect(result).not.toBeNull();
    expect(result?.primaryLanguage).toBe("typescript"); // Default
  });

  it("handles Python framework selection", async () => {
    mock.module("prompts", () => {
      return {
        default: async () => ({
          description: "Python API",
          primaryLanguage: "python",
          framework: "fastapi",
          packageManager: "pip",
          testingFramework: "pytest",
          linter: "ruff",
          projectType: "API/Backend",
        }),
      };
    });

    const { promptNewProject: mockedPrompt } = await import("./cli.js");

    const args = {
      help: false,
      version: false,
      force: false,
      interactive: true,
      verbose: false,
    };

    const result = await mockedPrompt(args);
    expect(result?.primaryLanguage).toBe("python");
    expect(result?.framework).toBe("fastapi");
  });
});

describe("formatLanguage", () => {
  it("formats TypeScript correctly", () => {
    expect(formatLanguage("typescript")).toBe("TypeScript");
  });

  it("formats JavaScript correctly", () => {
    expect(formatLanguage("javascript")).toBe("JavaScript");
  });

  it("formats Python correctly", () => {
    expect(formatLanguage("python")).toBe("Python");
  });

  it("formats Go correctly", () => {
    expect(formatLanguage("go")).toBe("Go");
  });

  it("formats Rust correctly", () => {
    expect(formatLanguage("rust")).toBe("Rust");
  });

  it("formats Swift correctly", () => {
    expect(formatLanguage("swift")).toBe("Swift");
  });

  it("formats Kotlin correctly", () => {
    expect(formatLanguage("kotlin")).toBe("Kotlin");
  });

  it("formats C# correctly", () => {
    expect(formatLanguage("csharp")).toBe("C#");
  });

  it("formats C++ correctly", () => {
    expect(formatLanguage("cpp")).toBe("C++");
  });

  it("formats Java correctly", () => {
    expect(formatLanguage("java")).toBe("Java");
  });

  it("formats Ruby correctly", () => {
    expect(formatLanguage("ruby")).toBe("Ruby");
  });

  it("formats PHP correctly", () => {
    expect(formatLanguage("php")).toBe("PHP");
  });
});

describe("formatFramework", () => {
  it("formats Next.js correctly", () => {
    expect(formatFramework("nextjs")).toBe("Next.js");
  });

  it("formats React correctly", () => {
    expect(formatFramework("react")).toBe("React");
  });

  it("formats Vue.js correctly", () => {
    expect(formatFramework("vue")).toBe("Vue.js");
  });

  it("formats FastAPI correctly", () => {
    expect(formatFramework("fastapi")).toBe("FastAPI");
  });

  it("formats NestJS correctly", () => {
    expect(formatFramework("nestjs")).toBe("NestJS");
  });

  it("formats Express correctly", () => {
    expect(formatFramework("express")).toBe("Express");
  });

  it("formats Prisma correctly", () => {
    expect(formatFramework("prisma")).toBe("Prisma");
  });

  it("formats Tailwind correctly", () => {
    expect(formatFramework("tailwind")).toBe("Tailwind CSS");
  });

  it("formats shadcn correctly", () => {
    expect(formatFramework("shadcn")).toBe("shadcn/ui");
  });

  it("returns framework name if not in lookup", () => {
    // @ts-expect-error Testing unknown framework
    expect(formatFramework("unknown-framework")).toBe("unknown-framework");
  });

  // Swift/iOS frameworks
  it("formats SwiftUI correctly", () => {
    expect(formatFramework("swiftui")).toBe("SwiftUI");
  });

  it("formats UIKit correctly", () => {
    expect(formatFramework("uikit")).toBe("UIKit");
  });

  it("formats Vapor correctly", () => {
    expect(formatFramework("vapor")).toBe("Vapor");
  });

  it("formats SwiftData correctly", () => {
    expect(formatFramework("swiftdata")).toBe("SwiftData");
  });

  it("formats Combine correctly", () => {
    expect(formatFramework("combine")).toBe("Combine");
  });

  // Android frameworks
  it("formats Jetpack Compose correctly", () => {
    expect(formatFramework("jetpack-compose")).toBe("Jetpack Compose");
  });

  it("formats Android Views correctly", () => {
    expect(formatFramework("android-views")).toBe("Android Views");
  });

  it("formats Room correctly", () => {
    expect(formatFramework("room")).toBe("Room");
  });

  it("formats Hilt correctly", () => {
    expect(formatFramework("hilt")).toBe("Hilt");
  });

  it("formats Ktor correctly", () => {
    expect(formatFramework("ktor-android")).toBe("Ktor");
  });
});

// ============================================================================
// mapFormatter Tests
// ============================================================================

describe("mapFormatter", () => {
  it("maps eslint to prettier", () => {
    expect(mapFormatter("eslint")).toBe("prettier");
  });

  it("maps biome to biome", () => {
    expect(mapFormatter("biome")).toBe("biome");
  });

  it("maps ruff to ruff", () => {
    expect(mapFormatter("ruff")).toBe("ruff");
  });

  it("maps flake8 to black", () => {
    expect(mapFormatter("flake8")).toBe("black");
  });

  it("maps clippy to rustfmt", () => {
    expect(mapFormatter("clippy")).toBe("rustfmt");
  });

  it("maps rubocop to rubocop", () => {
    expect(mapFormatter("rubocop")).toBe("rubocop");
  });

  it("maps golangci-lint to gofmt", () => {
    expect(mapFormatter("golangci-lint")).toBe("gofmt");
  });

  it("maps null to null", () => {
    expect(mapFormatter(null)).toBeNull();
  });
});

// ============================================================================
// showTechStack Tests
// ============================================================================

describe("showTechStack", () => {
  it("handles basic tech stack without errors", () => {
    const projectInfo = {
      isExisting: true,
      fileCount: 10,
      techStack: {
        languages: ["typescript" as const],
        primaryLanguage: "typescript" as const,
        frameworks: ["nextjs" as const],
        primaryFramework: "nextjs" as const,
        packageManager: "bun" as const,
        testingFramework: "vitest" as const,
        linter: null,
        formatter: null,
        bundler: null,
        isMonorepo: false,
        hasDocker: false,
        hasCICD: false,
        cicdPlatform: null,
        hasClaudeConfig: false,
        existingClaudeFiles: [],
      },
      rootDir: "/tmp/test",
      name: "test-project",
      description: null,
    };

    expect(() => showTechStack(projectInfo, false)).not.toThrow();
  });

  it("handles verbose mode with all fields populated", () => {
    const projectInfo = {
      isExisting: true,
      fileCount: 100,
      techStack: {
        languages: ["typescript" as const, "python" as const],
        primaryLanguage: "typescript" as const,
        frameworks: ["nextjs" as const, "fastapi" as const],
        primaryFramework: "nextjs" as const,
        packageManager: "pnpm" as const,
        testingFramework: "vitest" as const,
        linter: "eslint" as const,
        formatter: "prettier" as const,
        bundler: "vite" as const,
        isMonorepo: true,
        hasDocker: true,
        hasCICD: true,
        cicdPlatform: "github-actions" as const,
        hasClaudeConfig: true,
        existingClaudeFiles: [".claude/CLAUDE.md"],
      },
      rootDir: "/tmp/test",
      name: "full-project",
      description: "A project with everything",
    };

    expect(() => showTechStack(projectInfo, true)).not.toThrow();
  });

  it("handles minimal tech stack", () => {
    const projectInfo = {
      isExisting: false,
      fileCount: 0,
      techStack: {
        languages: [],
        primaryLanguage: null,
        frameworks: [],
        primaryFramework: null,
        packageManager: null,
        testingFramework: null,
        linter: null,
        formatter: null,
        bundler: null,
        isMonorepo: false,
        hasDocker: false,
        hasCICD: false,
        cicdPlatform: null,
        hasClaudeConfig: false,
        existingClaudeFiles: [],
      },
      rootDir: "/tmp/empty",
      name: "empty-project",
      description: null,
    };

    expect(() => showTechStack(projectInfo, false)).not.toThrow();
    expect(() => showTechStack(projectInfo, true)).not.toThrow();
  });

  it("handles Swift/iOS project in verbose mode", () => {
    const projectInfo = {
      isExisting: true,
      fileCount: 50,
      techStack: {
        languages: ["swift" as const],
        primaryLanguage: "swift" as const,
        frameworks: ["swiftui" as const, "combine" as const],
        primaryFramework: "swiftui" as const,
        packageManager: null,
        testingFramework: null,
        linter: null,
        formatter: null,
        bundler: null,
        isMonorepo: false,
        hasDocker: false,
        hasCICD: true,
        cicdPlatform: "github-actions" as const,
        hasClaudeConfig: false,
        existingClaudeFiles: [],
      },
      rootDir: "/tmp/ios-app",
      name: "ios-app",
      description: "An iOS app",
    };

    expect(() => showTechStack(projectInfo, true)).not.toThrow();
  });

  it("handles Android/Kotlin project in verbose mode", () => {
    const projectInfo = {
      isExisting: true,
      fileCount: 80,
      techStack: {
        languages: ["kotlin" as const],
        primaryLanguage: "kotlin" as const,
        frameworks: ["jetpack-compose" as const, "room" as const, "hilt" as const],
        primaryFramework: "jetpack-compose" as const,
        packageManager: "gradle" as const,
        testingFramework: null,
        linter: null,
        formatter: null,
        bundler: null,
        isMonorepo: false,
        hasDocker: false,
        hasCICD: true,
        cicdPlatform: "github-actions" as const,
        hasClaudeConfig: false,
        existingClaudeFiles: [],
      },
      rootDir: "/tmp/android-app",
      name: "android-app",
      description: "An Android app",
    };

    expect(() => showTechStack(projectInfo, true)).not.toThrow();
  });
});

// ============================================================================
// Tech Stack Detection Tests
// ============================================================================

describe("detectTechStack", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("detects TypeScript from tsconfig.json", () => {
    fs.writeFileSync(path.join(tempDir, "tsconfig.json"), "{}");
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("typescript");
    expect(stack.primaryLanguage).toBe("typescript");
  });

  it("detects JavaScript from package.json", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), '{"name": "test"}');
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("javascript");
  });

  it("detects Python from requirements.txt", () => {
    fs.writeFileSync(path.join(tempDir, "requirements.txt"), "fastapi==0.100.0");
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("python");
  });

  it("detects Go from go.mod", () => {
    fs.writeFileSync(path.join(tempDir, "go.mod"), "module example.com/test");
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("go");
  });

  it("detects Rust from Cargo.toml", () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "test"');
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("rust");
  });

  it("detects Swift from Package.swift", () => {
    fs.writeFileSync(path.join(tempDir, "Package.swift"), "import PackageDescription");
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("swift");
  });

  it("detects Swift from .swift files", () => {
    fs.writeFileSync(path.join(tempDir, "main.swift"), 'print("Hello")');
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("swift");
  });

  it("detects Kotlin from .kt files", () => {
    fs.writeFileSync(path.join(tempDir, "Main.kt"), "fun main() {}");
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("kotlin");
  });

  it("detects Kotlin from .kts files", () => {
    fs.writeFileSync(path.join(tempDir, "build.gradle.kts"), "plugins {}");
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("kotlin");
  });

  it("detects Next.js framework", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { next: "14.0.0" } })
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("nextjs");
    expect(stack.primaryFramework).toBe("nextjs");
  });

  it("detects React framework", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { react: "18.0.0" } })
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("react");
  });

  it("detects FastAPI framework", () => {
    fs.writeFileSync(path.join(tempDir, "requirements.txt"), "fastapi==0.100.0\nuvicorn");
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("fastapi");
  });

  it("detects SwiftUI framework from ContentView file", () => {
    fs.writeFileSync(path.join(tempDir, "ContentView.swift"), "import SwiftUI");
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("swiftui");
  });

  it("detects UIKit framework from ViewController file", () => {
    fs.writeFileSync(path.join(tempDir, "MainViewController.swift"), "import UIKit");
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("uikit");
  });

  it("detects Vapor framework from Package.swift", () => {
    fs.writeFileSync(
      path.join(tempDir, "Package.swift"),
      'import PackageDescription\nlet package = Package(dependencies: [.package(url: "vapor/vapor")])'
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("vapor");
  });

  it("detects Jetpack Compose from build.gradle.kts", () => {
    fs.writeFileSync(
      path.join(tempDir, "build.gradle.kts"),
      `plugins { id("com.android.application") }
android {
  buildFeatures { compose = true }
}
dependencies {
  implementation("androidx.compose.ui:ui")
}`
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("jetpack-compose");
  });

  it("detects Android Views when no Compose", () => {
    fs.writeFileSync(
      path.join(tempDir, "build.gradle"),
      `plugins { id 'com.android.application' }
android {
  compileSdk 34
}`
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("android-views");
  });

  it("detects Room database from build.gradle", () => {
    fs.writeFileSync(
      path.join(tempDir, "build.gradle.kts"),
      `plugins { id("com.android.application") }
android { }
dependencies {
  implementation("androidx.room:room-runtime")
}`
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("room");
  });

  it("detects Hilt dependency injection from build.gradle", () => {
    fs.writeFileSync(
      path.join(tempDir, "build.gradle.kts"),
      `plugins { id("com.android.application") }
android { }
dependencies {
  implementation("com.google.dagger:hilt-android")
}`
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("hilt");
  });

  it("detects gradle package manager from build.gradle", () => {
    fs.writeFileSync(path.join(tempDir, "build.gradle"), "plugins {}");
    const stack = detectTechStack(tempDir);
    expect(stack.packageManager).toBe("gradle");
  });

  it("detects bun package manager", () => {
    fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
    const stack = detectTechStack(tempDir);
    expect(stack.packageManager).toBe("bun");
  });

  it("detects pnpm package manager", () => {
    fs.writeFileSync(path.join(tempDir, "pnpm-lock.yaml"), "");
    const stack = detectTechStack(tempDir);
    expect(stack.packageManager).toBe("pnpm");
  });

  it("detects npm package manager", () => {
    fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
    const stack = detectTechStack(tempDir);
    expect(stack.packageManager).toBe("npm");
  });

  it("detects vitest testing framework", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { vitest: "1.0.0" } })
    );
    const stack = detectTechStack(tempDir);
    expect(stack.testingFramework).toBe("vitest");
  });

  it("detects jest testing framework", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { jest: "29.0.0" } })
    );
    const stack = detectTechStack(tempDir);
    expect(stack.testingFramework).toBe("jest");
  });

  it("detects eslint linter from config file", () => {
    fs.writeFileSync(path.join(tempDir, "eslint.config.js"), "export default {};");
    const stack = detectTechStack(tempDir);
    expect(stack.linter).toBe("eslint");
  });

  it("detects prettier formatter", () => {
    fs.writeFileSync(path.join(tempDir, ".prettierrc"), "{}");
    const stack = detectTechStack(tempDir);
    expect(stack.formatter).toBe("prettier");
  });

  it("detects vite bundler", () => {
    fs.writeFileSync(path.join(tempDir, "vite.config.ts"), "export default {};");
    const stack = detectTechStack(tempDir);
    expect(stack.bundler).toBe("vite");
  });

  it("detects monorepo from pnpm-workspace.yaml", () => {
    fs.writeFileSync(path.join(tempDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*");
    const stack = detectTechStack(tempDir);
    expect(stack.isMonorepo).toBe(true);
  });

  it("detects Docker presence", () => {
    fs.writeFileSync(path.join(tempDir, "Dockerfile"), "FROM node:18");
    const stack = detectTechStack(tempDir);
    expect(stack.hasDocker).toBe(true);
  });

  it("detects GitHub Actions CI/CD", () => {
    const workflowDir = path.join(tempDir, ".github", "workflows");
    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(path.join(workflowDir, "ci.yml"), "name: CI");
    const stack = detectTechStack(tempDir);
    expect(stack.hasCICD).toBe(true);
    expect(stack.cicdPlatform).toBe("github-actions");
  });

  it("detects existing Claude configuration", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "CLAUDE.md"), "# Project");
    const stack = detectTechStack(tempDir);
    expect(stack.hasClaudeConfig).toBe(true);
    expect(stack.existingClaudeFiles).toContain(".claude/CLAUDE.md");
  });
});

describe("summarizeTechStack", () => {
  it("summarizes a TypeScript/Next.js stack", () => {
    const tempDir = createTempDir();
    try {
      const stack = detectTechStack(tempDir);
      const testStack = {
        ...stack,
        primaryLanguage: "typescript" as const,
        primaryFramework: "nextjs" as const,
        packageManager: "bun" as const,
        testingFramework: "vitest" as const,
      };
      const summary = summarizeTechStack(testStack);
      expect(summary).toContain("typescript");
      expect(summary).toContain("nextjs");
      expect(summary).toContain("bun");
      expect(summary).toContain("vitest");
    } finally {
      removeTempDir(tempDir);
    }
  });
});

// ============================================================================
// Repository Analysis Tests
// ============================================================================

describe("analyzeRepository", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("detects empty directory as new project", () => {
    const info = analyzeRepository(tempDir);
    expect(info.isExisting).toBe(false);
    expect(info.fileCount).toBe(0);
  });

  it("detects directory with source files as existing project", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), '{"name": "test"}');
    fs.writeFileSync(path.join(tempDir, "index.ts"), "export const x = 1;");
    const info = analyzeRepository(tempDir);
    expect(info.isExisting).toBe(true);
    expect(info.fileCount).toBeGreaterThan(0);
  });

  it("extracts project name from package.json", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), '{"name": "my-project"}');
    const info = analyzeRepository(tempDir);
    expect(info.name).toBe("my-project");
  });

  it("falls back to directory name when no package.json", () => {
    const info = analyzeRepository(tempDir);
    expect(info.name).toBe(path.basename(tempDir));
  });

  it("extracts description from package.json", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      '{"name": "test", "description": "A test project"}'
    );
    const info = analyzeRepository(tempDir);
    expect(info.description).toBe("A test project");
  });

  it("respects .gitignore patterns", () => {
    fs.writeFileSync(path.join(tempDir, ".gitignore"), "ignored/\nnode_modules/");
    fs.mkdirSync(path.join(tempDir, "ignored"));
    fs.mkdirSync(path.join(tempDir, "node_modules"));
    fs.mkdirSync(path.join(tempDir, "src"));
    fs.writeFileSync(path.join(tempDir, "ignored", "file.ts"), "");
    fs.writeFileSync(path.join(tempDir, "node_modules", "dep.js"), "");
    fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "");
    fs.writeFileSync(path.join(tempDir, "package.json"), '{"name": "test"}');

    const info = analyzeRepository(tempDir);
    expect(info.fileCount).toBe(1);
  });
});

// ============================================================================
// Generator Tests (settings, directories)
// ============================================================================

describe("generateSettings", () => {
  it("generates settings with basic permissions", () => {
    const stack = detectTechStack(createTempDir());
    const result = generateSettings(stack);
    expect(result.path).toBe(".claude/settings.json");
    expect(result.content).toContain("permissions");
    expect(result.content).toContain("Read(**)");
  });

  it("includes Python permissions for Python projects", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, "requirements.txt"), "fastapi");
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("python");
      expect(result.content).toContain("pytest");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("includes Go permissions for Go projects", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, "go.mod"), "module test");
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("Bash(go:*)");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("includes Rust permissions for Rust projects", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "test"');
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("cargo");
      expect(result.content).toContain("rustc");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("includes Docker permissions when Docker is present", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, "Dockerfile"), "FROM node:18");
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("docker");
    } finally {
      removeTempDir(tempDir);
    }
  });
});

describe("ensureDirectories", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("creates all required .claude/ subdirectories", () => {
    ensureDirectories(tempDir);

    expect(fs.existsSync(path.join(tempDir, ".claude"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".claude", "skills"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".claude", "agents"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".claude", "rules"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".claude", "commands"))).toBe(true);
  });

  it("is idempotent — running twice doesn't error", () => {
    ensureDirectories(tempDir);
    expect(() => ensureDirectories(tempDir)).not.toThrow();
  });
});

describe("writeSettings", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("writes settings.json to .claude/ directory", () => {
    const stack = detectTechStack(tempDir);
    writeSettings(tempDir, stack);

    const settingsPath = path.join(tempDir, ".claude", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);

    const content = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.permissions).toBeDefined();
    expect(parsed.permissions.allow).toBeInstanceOf(Array);
  });
});

// ============================================================================
// Claude CLI Integration Tests
// ============================================================================

describe("checkClaudeCli", () => {
  it("returns a boolean", () => {
    const result = checkClaudeCli();
    expect(typeof result).toBe("boolean");
  });
});

describe("parseArgs - no static flag", () => {
  it("does not have a static property", () => {
    const args = parseArgs([]);
    expect("static" in args).toBe(false);
  });
});

// ============================================================================
// Analysis Prompt Tests
// ============================================================================

describe("getAnalysisPrompt", () => {
  const projectInfo = {
    isExisting: true,
    fileCount: 10,
    techStack: {
      languages: ["typescript" as const],
      primaryLanguage: "typescript" as const,
      frameworks: ["nextjs" as const],
      primaryFramework: "nextjs" as const,
      packageManager: "bun" as const,
      testingFramework: "vitest" as const,
      linter: "biome" as const,
      formatter: "biome" as const,
      bundler: "tsup" as const,
      isMonorepo: false,
      hasDocker: false,
      hasCICD: false,
      cicdPlatform: null,
      hasClaudeConfig: false,
      existingClaudeFiles: [],
    },
    rootDir: "/tmp/test",
    name: "my-test-project",
    description: "A test project for analysis",
  };

  it("returns a string containing the project name and tech stack context", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(typeof prompt).toBe("string");
    expect(prompt).toContain("my-test-project");
    expect(prompt).toContain("typescript");
    expect(prompt).toContain("nextjs");
    expect(prompt).toContain("A test project for analysis");
    expect(prompt).toContain("Phase 1");
    expect(prompt).toContain("CLAUDE.md");
  });

  it("includes skills generation instructions", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Phase 4");
    expect(prompt).toContain("iterative-development");
    expect(prompt).toContain("code-deduplication");
    expect(prompt).toContain("security");
    expect(prompt).toContain("testing-methodology");
    // Removed skills should NOT be present as standalone skill files
    expect(prompt).not.toContain("`.claude/skills/pattern-discovery.md`");
    expect(prompt).not.toContain("`.claude/skills/systematic-debugging.md`");
    expect(prompt).not.toContain("`.claude/skills/commit-hygiene.md`");
    expect(prompt).not.toContain("`.claude/skills/simplicity-rules.md`");
  });

  it("includes agents generation instructions", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Phase 5");
    expect(prompt).toContain("code-reviewer");
    expect(prompt).toContain("test-writer");
  });

  it("includes rules generation instructions", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Phase 6");
    expect(prompt).toContain("typescript.md");
    expect(prompt).toContain("python.md");
    // Should prohibit unfiltered rules, not generate a code-style rule
    expect(prompt).not.toContain("`.claude/rules/code-style.md`");
  });

  it("includes commands generation instructions", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Phase 7");
    expect(prompt).toContain("analyze.md");
    expect(prompt).toContain("code-review.md");
    // Task management commands should NOT be generated (Claude Code has built-in task tools)
    expect(prompt).not.toContain("### `.claude/commands/task.md`");
    expect(prompt).not.toContain("### `.claude/commands/status.md`");
    expect(prompt).not.toContain("### `.claude/commands/done.md`");
  });

  it("includes template variables", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("detected_testing_framework");
    expect(prompt).toContain("vitest");
    expect(prompt).toContain("test_command");
    expect(prompt).toContain("lint_command");
    expect(prompt).toContain("detected_languages");
    expect(prompt).toContain("source_glob_patterns");
  });

  it("includes framework-specific skill instructions", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Next.js detected");
    expect(prompt).toContain("nextjs-patterns");
    expect(prompt).toContain("FastAPI detected");
    expect(prompt).toContain("SwiftUI detected");
  });

  it("includes correct test command for bun projects", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    // vitest is detected, so the test command should be npx vitest
    expect(prompt).toContain("npx vitest");
  });

  it("includes correct lint command for biome", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("npx biome check");
  });

  it("instructs Claude to write ALL files", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Execute Phase 4");
    expect(prompt).toContain("Execute Phase 5");
    expect(prompt).toContain("Execute Phase 6");
    expect(prompt).toContain("Execute Phase 7");
    expect(prompt).toContain("Write all files to disk using the Write tool");
  });

  it("includes artifact architecture guidance", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Artifact Architecture");
    expect(prompt).toContain("single source of truth");
    expect(prompt).toContain("Anti-Redundancy");
  });

  it("prohibits rules without paths filter", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("NEVER generate rules without");
  });

  it("instructs function-name references instead of line numbers", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("(functionName)");
    expect(prompt).toContain("NOT line numbers");
  });

  it("instructs code-review command to delegate to agent", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("delegates to the code-reviewer agent");
  });

  it("instructs skills to cross-reference CLAUDE.md", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Cross-reference, don't copy");
  });

  it("enforces CLAUDE.md line limit", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("MUST NOT exceed 120 lines");
  });

  it("prohibits command duplication in skills", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Forbidden Duplication List");
    expect(prompt).toContain("MUST NOT appear in skills, agents, rules, or commands");
  });

  it("instructs test-writer agent to not duplicate testing-methodology skill", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Do NOT duplicate the testing-methodology skill content");
  });

  it("excludes task management commands", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Do NOT generate task management commands");
    expect(prompt).toContain("built-in TaskCreate/TaskUpdate/TaskList");
  });
});

// ============================================================================
// Validator Tests
// ============================================================================

describe("extractCommands", () => {
  it("extracts commands from Common Commands code block", () => {
    const claudeMd =
      "## Common Commands\n\n```bash\nbun test src/cli.test.ts  # Unit tests\nbun run build  # Build\n```\n";
    const commands = extractCommands(claudeMd);
    expect(commands).toContain("bun test src/cli.test.ts");
    expect(commands).toContain("bun run build");
  });

  it("returns empty array when no Common Commands section", () => {
    const commands = extractCommands("# Project\n\n## Overview\nSome text.");
    expect(commands).toEqual([]);
  });

  it("skips comment-only lines", () => {
    const claudeMd = "## Common Commands\n\n```bash\n# This is a comment\nbun test\n```\n";
    const commands = extractCommands(claudeMd);
    expect(commands).toContain("bun test");
    expect(commands).toHaveLength(1);
  });
});

describe("extractConventionFingerprints", () => {
  it("extracts naming convention keywords", () => {
    const claudeMd =
      "## Code Conventions\n\n### Naming\n- camelCase for functions\n- PascalCase for types\n\n## Testing\n";
    const fps = extractConventionFingerprints(claudeMd);
    expect(fps).toContain("camelCase");
    expect(fps).toContain("PascalCase");
  });

  it("extracts anti-pattern keywords", () => {
    const skip = ".sk" + "ip()";
    const only = ".on" + "ly()";
    const claudeMd = `## Code Conventions\n\n### Anti-Patterns\n- No ${skip} or ${only}\n- No console.log\n\n## Testing\n`;
    const fps = extractConventionFingerprints(claudeMd);
    expect(fps).toContain(skip);
    expect(fps).toContain(only);
    expect(fps).toContain("console.log");
  });

  it("extracts export and import conventions", () => {
    const claudeMd =
      "## Code Conventions\n\n- Named exports only\n- Use import type for types\n\n## Testing\n";
    const fps = extractConventionFingerprints(claudeMd);
    expect(fps).toContain("named export");
    expect(fps).toContain("import type");
  });

  it("returns empty array when no Code Conventions section", () => {
    const fps = extractConventionFingerprints("# Project\n\n## Overview\n");
    expect(fps).toEqual([]);
  });
});

describe("separateFrontmatter", () => {
  it("separates YAML frontmatter from body", () => {
    const content = "---\nname: test\n---\n\n# Body";
    const { frontmatter, body } = separateFrontmatter(content);
    expect(frontmatter).toBe("---\nname: test\n---\n");
    expect(body).toBe("\n# Body");
  });

  it("returns empty frontmatter when none present", () => {
    const content = "# Body\n\nSome text";
    const { frontmatter, body } = separateFrontmatter(content);
    expect(frontmatter).toBe("");
    expect(body).toBe(content);
  });

  it("handles frontmatter at end of file", () => {
    const content = "---\nname: test\n---";
    const { frontmatter, body } = separateFrontmatter(content);
    expect(frontmatter).toBe("---\nname: test\n---");
    expect(body).toBe("");
  });
});

describe("validateArtifacts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("removes convention duplication from non-CLAUDE.md files", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Code Conventions\n\n### Naming\n- camelCase for functions\n- PascalCase for types\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "agents", "reviewer.md"),
      "---\nname: reviewer\n---\n\n# Review\n\n- Check camelCase and PascalCase naming\n- Check imports\n"
    );

    const result = validateArtifacts(tempDir);
    expect(result.duplicationsRemoved).toBeGreaterThan(0);
    expect(result.filesModified).toBe(1);

    const modified = fs.readFileSync(path.join(claudeDir, "agents", "reviewer.md"), "utf-8");
    expect(modified).not.toContain("camelCase and PascalCase");
    expect(modified).toContain("Check imports");
  });

  it("replaces literal commands with cross-references", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Common Commands\n\n```bash\nnpx biome check .  # Lint\n```\n\n## Code Conventions\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "agents", "reviewer.md"),
      "---\nname: reviewer\n---\n\n# Review\n\n- Run lint: `npx biome check .`\n"
    );

    const result = validateArtifacts(tempDir);
    expect(result.duplicationsRemoved).toBeGreaterThan(0);

    const modified = fs.readFileSync(path.join(claudeDir, "agents", "reviewer.md"), "utf-8");
    expect(modified).toContain("Common Commands in CLAUDE.md");
    expect(modified).not.toContain("npx biome check .");
  });

  it("does not modify CLAUDE.md itself", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const original =
      "## Code Conventions\n\n- camelCase\n- PascalCase\n\n## Common Commands\n\n```bash\nbun test\n```\n\n## Testing\n";
    fs.writeFileSync(path.join(claudeDir, "CLAUDE.md"), original);

    validateArtifacts(tempDir);

    const content = fs.readFileSync(path.join(claudeDir, "CLAUDE.md"), "utf-8");
    expect(content).toBe(original);
  });

  it("does not modify content inside code blocks", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Code Conventions\n\n- camelCase for functions\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "skills", "test.md"),
      "---\nname: test\n---\n\n# Test\n\n```typescript\n- Check camelCase naming\n```\n"
    );

    const result = validateArtifacts(tempDir);
    expect(result.duplicationsRemoved).toBe(0);
  });

  it("does not modify YAML frontmatter", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Common Commands\n\n```bash\nnpx biome check .\n```\n\n## Code Conventions\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "agents", "reviewer.md"),
      '---\nname: reviewer\ntools:\n  - "Bash(npx biome check .)"\n---\n\n# Review\n\n- Check stuff\n'
    );

    validateArtifacts(tempDir);

    const modified = fs.readFileSync(path.join(claudeDir, "agents", "reviewer.md"), "utf-8");
    expect(modified).toContain('"Bash(npx biome check .)"');
  });

  it("returns empty result when no CLAUDE.md exists", () => {
    const result = validateArtifacts(tempDir);
    expect(result.filesChecked).toBe(0);
    expect(result.filesModified).toBe(0);
    expect(result.duplicationsRemoved).toBe(0);
  });

  it("skips lines already containing CLAUDE.md cross-reference", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Code Conventions\n\n- camelCase\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "skills", "dev.md"),
      "---\nname: dev\n---\n\n# Dev\n\n- Follow conventions in CLAUDE.md\n"
    );

    const result = validateArtifacts(tempDir);
    expect(result.duplicationsRemoved).toBe(0);
  });

  it("only removes list items, not headings or prose", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Code Conventions\n\n- camelCase for functions\n- PascalCase for types\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "agents", "reviewer.md"),
      "---\nname: reviewer\n---\n\n# Naming Section\n\nThis describes naming.\n\n- Verify camelCase and PascalCase conventions\n"
    );

    const result = validateArtifacts(tempDir);
    expect(result.duplicationsRemoved).toBe(1);

    const modified = fs.readFileSync(path.join(claudeDir, "agents", "reviewer.md"), "utf-8");
    expect(modified).toContain("# Naming Section");
    expect(modified).toContain("This describes naming.");
    expect(modified).not.toContain("camelCase and PascalCase");
  });
});

// ============================================================================
// Hooks Tests
// ============================================================================

describe("installHook", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("creates hook script file", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installHook(tempDir);

    const hookPath = path.join(tempDir, ".claude", "hooks", "block-dangerous-commands.js");
    expect(fs.existsSync(hookPath)).toBe(true);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("#!/usr/bin/env node");
    expect(content).toContain("PATTERNS");
    expect(content).toContain("checkCommand");
  });

  it("makes hook script executable", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installHook(tempDir);

    const hookPath = path.join(tempDir, ".claude", "hooks", "block-dangerous-commands.js");
    const stats = fs.statSync(hookPath);
    // Check executable bit is set (owner)
    expect(stats.mode & 0o100).toBeTruthy();
  });

  it("patches settings.json with hook configuration", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".claude", "settings.json"),
      JSON.stringify({ permissions: { allow: [] } })
    );

    installHook(tempDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".claude", "settings.json"), "utf-8")
    );
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.PreToolUse).toBeInstanceOf(Array);
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Bash");
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain("block-dangerous-commands.js");
    // Preserves existing settings
    expect(settings.permissions).toBeDefined();
  });

  it("creates settings.json if it does not exist", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installHook(tempDir);

    const settingsPath = path.join(tempDir, ".claude", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks.PreToolUse).toBeDefined();
  });

  it("creates hooks directory when it does not exist", () => {
    installHook(tempDir);

    const hooksDir = path.join(tempDir, ".claude", "hooks");
    expect(fs.existsSync(hooksDir)).toBe(true);
  });

  it("generated script contains safety patterns for critical and high levels", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installHook(tempDir);

    const hookPath = path.join(tempDir, ".claude", "hooks", "block-dangerous-commands.js");
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("rm-root");
    expect(content).toContain("git-force-main");
    expect(content).toContain("npm-publish");
    expect(content).toContain("curl-pipe-sh");
  });
});
