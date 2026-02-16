import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRepository, detectTechStack, summarizeTechStack } from "./analyzer.js";
import {
  checkClaudeCli,
  createTaskFile,
  formatFramework,
  formatLanguage,
  getVersion,
  parseArgs,
  promptNewProject,
  showBanner,
  showHelp,
  showTechStack,
} from "./cli.js";
import { ensureDirectories, generateSettings, writeSettings } from "./generator.js";
import { getAnalysisPrompt } from "./prompt.js";

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
  it("formats swiftui correctly", () => {
    expect(formatFramework("swiftui")).toBe("swiftui");
  });

  it("formats uikit correctly", () => {
    expect(formatFramework("uikit")).toBe("uikit");
  });

  // Android frameworks
  it("formats jetpack-compose correctly", () => {
    expect(formatFramework("jetpack-compose")).toBe("jetpack-compose");
  });

  it("formats android-views correctly", () => {
    expect(formatFramework("android-views")).toBe("android-views");
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
// createTaskFile Tests
// ============================================================================

describe("createTaskFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("creates task file for existing project", () => {
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
      rootDir: tempDir,
      name: "test-project",
      description: "A test project",
    };

    createTaskFile(projectInfo, null);

    const taskPath = path.join(tempDir, ".claude", "state", "task.md");
    expect(fs.existsSync(taskPath)).toBe(true);

    const content = fs.readFileSync(taskPath, "utf-8");
    expect(content).toContain("# Current Task");
    expect(content).toContain("## Status: Ready");
    expect(content).toContain("test-project");
    expect(content).toContain("A test project");
  });

  it("creates task file for new project with preferences", () => {
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
      rootDir: tempDir,
      name: "new-project",
      description: null,
    };

    const preferences = {
      description: "Build a new API",
      primaryLanguage: "typescript" as const,
      framework: "fastapi" as const,
      includeTests: true,
      includeLinting: true,
      packageManager: null,
      testingFramework: null,
      linter: null,
      formatter: null,
      projectType: "API/Backend",
    };

    createTaskFile(projectInfo, preferences);

    const taskPath = path.join(tempDir, ".claude", "state", "task.md");
    expect(fs.existsSync(taskPath)).toBe(true);

    const content = fs.readFileSync(taskPath, "utf-8");
    expect(content).toContain("# Current Task");
    expect(content).toContain("## Status: In Progress");
    expect(content).toContain("Build a new API");
    expect(content).toContain("FastAPI");
    expect(content).toContain("TypeScript");
  });

  it("does not overwrite existing task file", () => {
    // Create existing task file
    const taskDir = path.join(tempDir, ".claude", "state");
    fs.mkdirSync(taskDir, { recursive: true });
    const taskPath = path.join(taskDir, "task.md");
    fs.writeFileSync(taskPath, "# Important work in progress");

    const projectInfo = {
      isExisting: true,
      fileCount: 10,
      techStack: {
        languages: ["typescript" as const],
        primaryLanguage: "typescript" as const,
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
      rootDir: tempDir,
      name: "test",
      description: null,
    };

    createTaskFile(projectInfo, null);

    // Should not be overwritten
    const content = fs.readFileSync(taskPath, "utf-8");
    expect(content).toBe("# Important work in progress");
  });

  it("creates task file for new project without preferences", () => {
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
      rootDir: tempDir,
      name: "new-project",
      description: null,
    };

    createTaskFile(projectInfo, null);

    const taskPath = path.join(tempDir, ".claude", "state", "task.md");
    expect(fs.existsSync(taskPath)).toBe(true);

    const content = fs.readFileSync(taskPath, "utf-8");
    expect(content).toContain("Explore and set up project");
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
    expect(fs.existsSync(path.join(tempDir, ".claude", "state"))).toBe(true);
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
    expect(prompt).toContain("pattern-discovery");
    expect(prompt).toContain("systematic-debugging");
    expect(prompt).toContain("testing-methodology");
    expect(prompt).toContain("iterative-development");
    expect(prompt).toContain("commit-hygiene");
    expect(prompt).toContain("code-deduplication");
    expect(prompt).toContain("simplicity-rules");
    expect(prompt).toContain("security");
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
    expect(prompt).toContain("code-style");
    expect(prompt).toContain("typescript.md");
    expect(prompt).toContain("python.md");
  });

  it("includes commands generation instructions", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).toContain("Phase 7");
    expect(prompt).toContain("task.md");
    expect(prompt).toContain("status.md");
    expect(prompt).toContain("done.md");
    expect(prompt).toContain("analyze.md");
    expect(prompt).toContain("code-review.md");
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
});
