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
  isNewerVersion,
  mapFormatter,
  parseArgs,
  promptNewProject,
  showBanner,
  showHelp,
  showTechStack,
} from "./cli.js";
import { applyAction, EXTRAS } from "./extras.js";
import { ensureDirectories, generateSettings, writeSettings } from "./generator.js";
import { checkHealth } from "./health.js";
import {
  checkHookStatus,
  checkSensitiveHookStatus,
  checkStatuslineStatus,
  installHook,
  installSensitiveHook,
  installStatusline,
} from "./hooks.js";
import { exportConfig, importConfig, loadTemplate } from "./portability.js";
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

function makeArgs(overrides: Partial<import("./types.js").Args> = {}): import("./types.js").Args {
  return {
    help: false,
    version: false,
    force: false,
    interactive: true,
    verbose: false,
    refresh: false,
    tune: false,
    check: false,
    noMemory: false,
    exportPath: null,
    importPath: null,
    template: null,
    profile: null,
    ...overrides,
  };
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

describe("isNewerVersion", () => {
  it("detects newer major version", () => {
    expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);
  });

  it("detects newer minor version", () => {
    expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
  });

  it("detects newer patch version", () => {
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
  });

  it("returns false for equal versions", () => {
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false for older version", () => {
    expect(isNewerVersion("2.0.0", "1.0.0")).toBe(false);
  });

  it("handles v-prefixed versions", () => {
    expect(isNewerVersion("v1.0.0", "v1.0.1")).toBe(true);
    expect(isNewerVersion("v2.0.0", "v1.0.0")).toBe(false);
  });

  it("handles major precedence over minor", () => {
    expect(isNewerVersion("1.9.9", "2.0.0")).toBe(true);
  });

  it("handles minor precedence over patch", () => {
    expect(isNewerVersion("1.0.9", "1.1.0")).toBe(true);
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
    const args = makeArgs({ interactive: false });
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

    const args = makeArgs();

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

    const args = makeArgs();

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

    const args = makeArgs();

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

    const args = makeArgs();

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

  it("detects multiple languages in a single project", () => {
    fs.writeFileSync(path.join(tempDir, "tsconfig.json"), "{}");
    fs.writeFileSync(path.join(tempDir, "requirements.txt"), "fastapi");
    fs.writeFileSync(path.join(tempDir, "go.mod"), "module test");
    const stack = detectTechStack(tempDir);
    expect(stack.languages).toContain("typescript");
    expect(stack.languages).toContain("python");
    expect(stack.languages).toContain("go");
    expect(stack.languages.length).toBeGreaterThanOrEqual(3);
  });

  it("sets first detected framework as primary", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { next: "14.0.0", tailwindcss: "3.0.0" } })
    );
    const stack = detectTechStack(tempDir);
    expect(stack.frameworks).toContain("nextjs");
    expect(stack.frameworks).toContain("tailwind");
    expect(stack.primaryFramework).toBe("nextjs");
  });

  it("prefers bun lock file when multiple lock files exist", () => {
    fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
    fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
    fs.writeFileSync(path.join(tempDir, "yarn.lock"), "");
    const stack = detectTechStack(tempDir);
    expect(stack.packageManager).toBe("bun");
  });

  it("detects yarn when only yarn.lock exists", () => {
    fs.writeFileSync(path.join(tempDir, "yarn.lock"), "");
    const stack = detectTechStack(tempDir);
    expect(stack.packageManager).toBe("yarn");
  });

  it("prioritizes GitHub Actions over other CI/CD platforms", () => {
    const workflowDir = path.join(tempDir, ".github", "workflows");
    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(path.join(workflowDir, "ci.yml"), "name: CI");
    fs.writeFileSync(path.join(tempDir, ".gitlab-ci.yml"), "stages: [build]");
    const stack = detectTechStack(tempDir);
    expect(stack.cicdPlatform).toBe("github-actions");
  });

  it("detects GitLab CI when no GitHub Actions", () => {
    fs.writeFileSync(path.join(tempDir, ".gitlab-ci.yml"), "stages: [build]");
    const stack = detectTechStack(tempDir);
    expect(stack.hasCICD).toBe(true);
    expect(stack.cicdPlatform).toBe("gitlab-ci");
  });

  it("detects biome as both linter and formatter", () => {
    fs.writeFileSync(path.join(tempDir, "biome.json"), "{}");
    const stack = detectTechStack(tempDir);
    expect(stack.linter).toBe("biome");
    expect(stack.formatter).toBe("biome");
  });

  it("handles corrupted package.json gracefully", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), "{ invalid json");
    expect(() => detectTechStack(tempDir)).not.toThrow();
    const stack = detectTechStack(tempDir);
    expect(stack.primaryFramework).toBeNull();
  });

  it("detects rspec from .rspec file", () => {
    fs.writeFileSync(path.join(tempDir, ".rspec"), "--color");
    const stack = detectTechStack(tempDir);
    expect(stack.testingFramework).toBe("rspec");
  });

  it("detects rspec from Gemfile + spec directory", () => {
    fs.writeFileSync(path.join(tempDir, "Gemfile"), 'source "https://rubygems.org"');
    fs.mkdirSync(path.join(tempDir, "spec"));
    const stack = detectTechStack(tempDir);
    expect(stack.testingFramework).toBe("rspec");
  });

  it("does not detect rspec from spec directory without Gemfile", () => {
    fs.mkdirSync(path.join(tempDir, "spec"));
    const stack = detectTechStack(tempDir);
    expect(stack.testingFramework).not.toBe("rspec");
  });

  it("detects playwright testing framework", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { "@playwright/test": "1.0.0" } })
    );
    const stack = detectTechStack(tempDir);
    expect(stack.testingFramework).toBe("playwright");
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

  it("summarizes a minimal stack with no framework or tools", () => {
    const tempDir = createTempDir();
    try {
      const stack = detectTechStack(tempDir);
      const testStack = {
        ...stack,
        languages: ["python" as const],
        primaryLanguage: "python" as const,
        primaryFramework: null,
        packageManager: null,
        testingFramework: null,
      };
      const summary = summarizeTechStack(testStack);
      expect(summary).toContain("python");
      expect(summary).not.toContain("undefined");
      expect(summary).not.toContain("null");
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

  it("includes TypeScript/JavaScript permissions", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, "tsconfig.json"), "{}");
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("node");
      expect(result.content).toContain("tsc");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("includes Ruby permissions for Ruby projects", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, "Gemfile"), 'source "https://rubygems.org"');
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("ruby");
      expect(result.content).toContain("bundle");
      expect(result.content).toContain("rails");
      expect(result.content).toContain("rake");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("includes testing framework permissions for playwright", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ devDependencies: { "@playwright/test": "1.0.0" } })
      );
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("playwright");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("includes linter and formatter permissions", () => {
    const tempDir = createTempDir();
    try {
      fs.writeFileSync(path.join(tempDir, "eslint.config.js"), "export default {};");
      fs.writeFileSync(path.join(tempDir, ".prettierrc"), "{}");
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      expect(result.content).toContain("eslint");
      expect(result.content).toContain("prettier");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("deduplicates permissions", () => {
    const tempDir = createTempDir();
    try {
      const stack = detectTechStack(tempDir);
      const result = generateSettings(stack);
      const parsed = JSON.parse(result.content);
      const uniqueCount = new Set(parsed.permissions.allow).size;
      expect(parsed.permissions.allow.length).toBe(uniqueCount);
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
// CLI Interactive Prompts Integration Tests
// ============================================================================

describe("CLI interactive prompts wiring", () => {
  const cliSource = fs.readFileSync(path.join(__dirname, "cli.ts"), "utf-8");

  it("delegates extras to promptExtras in interactive mode", () => {
    expect(cliSource).toContain("promptExtras(projectDir)");
    expect(cliSource).toContain("if (args.interactive)");
  });

  it("prompts for CLAUDE.md mode when existing config detected", () => {
    expect(cliSource).toContain("How should we handle the existing CLAUDE.md?");
    expect(cliSource).toContain("Improve");
    expect(cliSource).toContain("Replace");
    expect(cliSource).toContain("Keep");
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

  it("defaults to replace mode with no extra instructions", () => {
    const prompt = getAnalysisPrompt(projectInfo);
    expect(prompt).not.toContain("Mode: KEEP");
    expect(prompt).not.toContain("Mode: IMPROVE");
    expect(prompt).toContain("generate the CLAUDE.md (max 120 lines)");
  });

  it("includes keep mode instructions when mode is keep", () => {
    const prompt = getAnalysisPrompt(projectInfo, {
      claudeMdMode: "keep",
      existingClaudeMd: null,
    });
    expect(prompt).toContain("Mode: KEEP");
    expect(prompt).toContain("Do NOT read, modify, or overwrite");
    expect(prompt).toContain("Skip CLAUDE.md generation");
    expect(prompt).toContain("Skip writing CLAUDE.md");
  });

  it("includes improve mode instructions with existing content", () => {
    const existing = "# My Project\n\n## Overview\n\nCustom content here.\n";
    const prompt = getAnalysisPrompt(projectInfo, {
      claudeMdMode: "improve",
      existingClaudeMd: existing,
    });
    expect(prompt).toContain("Mode: IMPROVE");
    expect(prompt).toContain("Custom content here.");
    expect(prompt).toContain("Preserve all manually-added content");
    expect(prompt).toContain("IMPROVE the existing CLAUDE.md");
  });

  it("falls back to no extra instructions when improve mode has null content", () => {
    const prompt = getAnalysisPrompt(projectInfo, {
      claudeMdMode: "improve",
      existingClaudeMd: null,
    });
    expect(prompt).not.toContain("Mode: IMPROVE");
    expect(prompt).not.toContain("Mode: KEEP");
  });

  it("includes multi-language context in prompt", () => {
    const multiLangProject = {
      ...projectInfo,
      techStack: {
        ...projectInfo.techStack,
        languages: ["typescript" as const, "python" as const, "go" as const],
      },
    };
    const prompt = getAnalysisPrompt(multiLangProject);
    expect(prompt).toContain("python");
    expect(prompt).toContain("go");
    expect(prompt).toContain("Other Languages");
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

  it("strips inline comments from commands", () => {
    const claudeMd = "## Common Commands\n\n```bash\nbun test src/cli.test.ts  # Unit tests\n```\n";
    const commands = extractCommands(claudeMd);
    expect(commands).toContain("bun test src/cli.test.ts");
    expect(commands).not.toContain("# Unit tests");
  });

  it("handles empty code block", () => {
    const claudeMd = "## Common Commands\n\n```bash\n```\n";
    const commands = extractCommands(claudeMd);
    expect(commands).toEqual([]);
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

  it("processes files in nested subdirectories", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Code Conventions\n\n- camelCase for functions\n- PascalCase for types\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "skills", "dev.md"),
      "---\nname: dev\n---\n\n# Dev\n\n- Ensure camelCase and PascalCase naming\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "agents", "reviewer.md"),
      "---\nname: reviewer\n---\n\n# Review\n\n- Check camelCase and PascalCase conventions\n"
    );

    const result = validateArtifacts(tempDir);
    expect(result.duplicationsRemoved).toBe(2);
    expect(result.filesModified).toBe(2);
  });

  it("handles files with no list items to remove", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "## Code Conventions\n\n- camelCase for functions\n\n## Testing\n"
    );

    fs.writeFileSync(
      path.join(claudeDir, "skills", "dev.md"),
      "---\nname: dev\n---\n\n# Dev\n\nThis skill helps with development.\n"
    );

    const result = validateArtifacts(tempDir);
    expect(result.duplicationsRemoved).toBe(0);
    expect(result.filesModified).toBe(0);
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

  it("preserves existing non-hook settings when patching", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".claude", "settings.json"),
      JSON.stringify({
        permissions: { allow: ["Read(**)"] },
        model: "sonnet",
      })
    );

    installHook(tempDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".claude", "settings.json"), "utf-8")
    );
    expect(settings.permissions.allow).toContain("Read(**)");
    expect(settings.model).toBe("sonnet");
    expect(settings.hooks.PreToolUse).toBeDefined();
  });

  it("does not duplicate PreToolUse entry on repeated installation", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installHook(tempDir);
    installHook(tempDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".claude", "settings.json"), "utf-8")
    );
    expect(settings.hooks.PreToolUse).toHaveLength(1);
  });

  it("overwrites hook script on repeated installation", () => {
    fs.mkdirSync(path.join(tempDir, ".claude", "hooks"), { recursive: true });
    const hookPath = path.join(tempDir, ".claude", "hooks", "block-dangerous-commands.js");
    fs.writeFileSync(hookPath, "// old content");

    installHook(tempDir);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).not.toContain("// old content");
    expect(content).toContain("PATTERNS");
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

// ============================================================================
// Statusline Tests
// ============================================================================

describe("installStatusline", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("creates statusline script file", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installStatusline(tempDir);

    const scriptPath = path.join(tempDir, ".claude", "config", "statusline-command.sh");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const content = fs.readFileSync(scriptPath, "utf-8");
    expect(content).toContain("#!/usr/bin/env bash");
    expect(content).toContain("jq");
    expect(content).toContain("SESSION_ID");
    expect(content).toContain("REMAINING");
  });

  it("makes statusline script executable", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installStatusline(tempDir);

    const scriptPath = path.join(tempDir, ".claude", "config", "statusline-command.sh");
    const stats = fs.statSync(scriptPath);
    expect(stats.mode & 0o100).toBeTruthy();
  });

  it("patches settings.json with statusLine configuration", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".claude", "settings.json"),
      JSON.stringify({ permissions: { allow: [] } })
    );

    installStatusline(tempDir);

    const settings = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".claude", "settings.json"), "utf-8")
    );
    expect(settings.statusLine).toBeDefined();
    expect(settings.statusLine.type).toBe("command");
    expect(settings.statusLine.command).toContain("statusline-command.sh");
    expect(settings.permissions).toBeDefined();
  });

  it("creates settings.json if it does not exist", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installStatusline(tempDir);

    const settingsPath = path.join(tempDir, ".claude", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(settings.statusLine).toBeDefined();
  });

  it("creates config directory when it does not exist", () => {
    installStatusline(tempDir);

    const configDir = path.join(tempDir, ".claude", "config");
    expect(fs.existsSync(configDir)).toBe(true);
  });

  it("generated script parses git branch and context percentage", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    installStatusline(tempDir);

    const scriptPath = path.join(tempDir, ".claude", "config", "statusline-command.sh");
    const content = fs.readFileSync(scriptPath, "utf-8");
    expect(content).toContain("git branch --show-current");
    expect(content).toContain("remaining_percentage");
    expect(content).toContain("display_name");
  });
});

// ============================================================================
// Statusline Status Detection Tests
// ============================================================================

describe("checkStatuslineStatus", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("returns all false when no statusline is configured", () => {
    const status = checkStatuslineStatus(tempDir);
    expect(status.projectInstalled).toBe(false);
    expect(status.projectMatchesOurs).toBe(false);
  });

  it("detects project-level statusline that matches ours", () => {
    installStatusline(tempDir);
    const status = checkStatuslineStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(true);
  });

  it("detects project-level statusline with different content", () => {
    const claudeDir = path.join(tempDir, ".claude");
    const configDir = path.join(claudeDir, "config");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "statusline-command.sh"), "#!/bin/bash\necho custom");
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({
        statusLine: { type: "command", command: "bash .claude/config/statusline-command.sh" },
      })
    );

    const status = checkStatuslineStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(false);
  });

  it("detects settings with statusLine but missing script file", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ statusLine: { type: "command", command: "bash something.sh" } })
    );

    const status = checkStatuslineStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(false);
  });
});

// ============================================================================
// Hook Status Detection Tests
// ============================================================================

describe("checkHookStatus", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("returns all false when no hook is installed", () => {
    const status = checkHookStatus(tempDir);
    expect(status.projectInstalled).toBe(false);
    expect(status.projectMatchesOurs).toBe(false);
  });

  it("detects project-level hook that matches ours", () => {
    installHook(tempDir);
    const status = checkHookStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(true);
  });

  it("detects project-level hook with different content", () => {
    const hooksDir = path.join(tempDir, ".claude", "hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, "block-dangerous-commands.js"), "// custom hook");

    const status = checkHookStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(false);
  });
});

// ============================================================================
// Extras Module Tests
// ============================================================================

describe("EXTRAS registry", () => {
  it("contains all registered extras", () => {
    const ids = EXTRAS.map((e) => e.id);
    expect(ids).toContain("safety-hook");
    expect(ids).toContain("statusline");
    expect(ids).toContain("sensitive-files");
  });

  it("each extra has all required fields", () => {
    for (const extra of EXTRAS) {
      expect(extra.id).toBeTruthy();
      expect(extra.name).toBeTruthy();
      expect(extra.description).toBeTruthy();
      expect(typeof extra.checkStatus).toBe("function");
      expect(typeof extra.installProject).toBe("function");
      expect(typeof extra.installGlobal).toBe("function");
      expect(extra.projectPath).toBeTruthy();
      expect(extra.globalPath).toBeTruthy();
    }
  });

  it("safety-hook extra detects and installs correctly", () => {
    const tempDir = createTempDir();
    try {
      const hook = EXTRAS.find((e) => e.id === "safety-hook")!;
      const before = hook.checkStatus(tempDir);
      expect(before.projectInstalled).toBe(false);

      hook.installProject(tempDir);
      const after = hook.checkStatus(tempDir);
      expect(after.projectInstalled).toBe(true);
      expect(after.projectMatchesOurs).toBe(true);
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("statusline extra detects and installs correctly", () => {
    const tempDir = createTempDir();
    try {
      const sl = EXTRAS.find((e) => e.id === "statusline")!;
      const before = sl.checkStatus(tempDir);
      expect(before.projectInstalled).toBe(false);

      sl.installProject(tempDir);
      const after = sl.checkStatus(tempDir);
      expect(after.projectInstalled).toBe(true);
      expect(after.projectMatchesOurs).toBe(true);
    } finally {
      removeTempDir(tempDir);
    }
  });
});

// ============================================================================
// applyAction Tests
// ============================================================================

describe("applyAction", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("installs project-level when action is 'project'", () => {
    const hook = EXTRAS.find((e) => e.id === "safety-hook")!;
    applyAction("project", hook, tempDir);

    const hookPath = path.join(tempDir, ".claude", "hooks", "block-dangerous-commands.js");
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  it("does nothing when action is 'skip'", () => {
    const hook = EXTRAS.find((e) => e.id === "safety-hook")!;
    applyAction("skip", hook, tempDir);

    const hookPath = path.join(tempDir, ".claude", "hooks", "block-dangerous-commands.js");
    expect(fs.existsSync(hookPath)).toBe(false);
  });

  it("does nothing when action is undefined (cancelled)", () => {
    const hook = EXTRAS.find((e) => e.id === "safety-hook")!;
    applyAction(undefined, hook, tempDir);

    const hookPath = path.join(tempDir, ".claude", "hooks", "block-dangerous-commands.js");
    expect(fs.existsSync(hookPath)).toBe(false);
  });

  it("installs statusline project-level", () => {
    const sl = EXTRAS.find((e) => e.id === "statusline")!;
    applyAction("project", sl, tempDir);

    const scriptPath = path.join(tempDir, ".claude", "config", "statusline-command.sh");
    expect(fs.existsSync(scriptPath)).toBe(true);
  });
});

// ============================================================================
// Extra Status Detection — Skip Logic Tests
// ============================================================================

describe("extras skip logic", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("safety-hook: matches ours after project install", () => {
    const hook = EXTRAS.find((e) => e.id === "safety-hook")!;
    hook.installProject(tempDir);

    const status = hook.checkStatus(tempDir);
    expect(status.projectMatchesOurs).toBe(true);
    // promptExtras would skip this extra
  });

  it("safety-hook: does not match when different script installed", () => {
    const hooksDir = path.join(tempDir, ".claude", "hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, "block-dangerous-commands.js"), "// custom");

    const hook = EXTRAS.find((e) => e.id === "safety-hook")!;
    const status = hook.checkStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(false);
    // promptExtras would show "replace?" prompt
  });

  it("statusline: matches ours after project install", () => {
    const sl = EXTRAS.find((e) => e.id === "statusline")!;
    sl.installProject(tempDir);

    const status = sl.checkStatus(tempDir);
    expect(status.projectMatchesOurs).toBe(true);
  });

  it("statusline: does not match when different script installed", () => {
    const configDir = path.join(tempDir, ".claude", "config");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "statusline-command.sh"), "#!/bin/bash\necho custom");
    fs.writeFileSync(
      path.join(tempDir, ".claude", "settings.json"),
      JSON.stringify({
        statusLine: { type: "command", command: "bash .claude/config/statusline-command.sh" },
      })
    );

    const sl = EXTRAS.find((e) => e.id === "statusline")!;
    const status = sl.checkStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(false);
  });

  it("not installed at project level: all extras return project false", () => {
    for (const extra of EXTRAS) {
      const status = extra.checkStatus(tempDir);
      expect(status.projectInstalled).toBe(false);
      expect(status.projectMatchesOurs).toBe(false);
    }
  });
});

// ============================================================================
// New Args Parsing Tests
// ============================================================================

describe("parseArgs (new flags)", () => {
  it("parses --refresh flag", () => {
    const args = parseArgs(["--refresh"]);
    expect(args.refresh).toBe(true);
  });

  it("parses --tune flag", () => {
    const args = parseArgs(["--tune"]);
    expect(args.tune).toBe(true);
  });

  it("parses --check flag", () => {
    const args = parseArgs(["--check"]);
    expect(args.check).toBe(true);
  });

  it("parses --no-memory flag", () => {
    const args = parseArgs(["--no-memory"]);
    expect(args.noMemory).toBe(true);
  });

  it("parses --export with path", () => {
    const args = parseArgs(["--export", "/tmp/config.json"]);
    expect(args.exportPath).toBe("/tmp/config.json");
  });

  it("returns null for --export without path", () => {
    const args = parseArgs(["--export"]);
    expect(args.exportPath).toBeNull();
  });

  it("parses --import with path", () => {
    const args = parseArgs(["--import", "/tmp/config.json"]);
    expect(args.importPath).toBe("/tmp/config.json");
  });

  it("parses --template with path", () => {
    const args = parseArgs(["--template", "/tmp/template.json"]);
    expect(args.template).toBe("/tmp/template.json");
  });

  it("parses --profile solo", () => {
    const args = parseArgs(["--profile", "solo"]);
    expect(args.profile).toBe("solo");
  });

  it("parses --profile team", () => {
    const args = parseArgs(["--profile", "team"]);
    expect(args.profile).toBe("team");
  });

  it("parses --profile ci", () => {
    const args = parseArgs(["--profile", "ci"]);
    expect(args.profile).toBe("ci");
  });

  it("rejects invalid profile", () => {
    const args = parseArgs(["--profile", "invalid"]);
    expect(args.profile).toBeNull();
  });

  it("ci profile forces non-interactive and noMemory", () => {
    const args = parseArgs(["--profile", "ci"]);
    expect(args.profile).toBe("ci");
    expect(args.interactive).toBe(false);
    expect(args.noMemory).toBe(true);
  });

  it("defaults new flags to false/null", () => {
    const args = parseArgs([]);
    expect(args.tune).toBe(false);
    expect(args.check).toBe(false);
    expect(args.noMemory).toBe(false);
    expect(args.exportPath).toBeNull();
    expect(args.importPath).toBeNull();
    expect(args.template).toBeNull();
    expect(args.profile).toBeNull();
  });
});

// ============================================================================
// Health Check Tests
// ============================================================================

describe("checkHealth", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("returns low score for empty project", () => {
    const result = checkHealth(tempDir);
    // Some checks pass by default (no rules = no filter violations, no duplication)
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.maxScore).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    // Key items should fail
    const claudeMdCheck = result.items.find((i) => i.name === "CLAUDE.md exists");
    expect(claudeMdCheck?.passed).toBe(false);
  });

  it("scores CLAUDE.md exists check", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, ".claude", "CLAUDE.md"), "# Test\n\n## Overview\n");

    const result = checkHealth(tempDir);
    const claudeMdCheck = result.items.find((i) => i.name === "CLAUDE.md exists");
    expect(claudeMdCheck?.passed).toBe(true);
    expect(claudeMdCheck?.score).toBe(10);
  });

  it("detects CLAUDE.md over 120 lines", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    const longContent = Array.from({ length: 150 }, (_, i) => `Line ${i + 1}`).join("\n");
    fs.writeFileSync(path.join(tempDir, ".claude", "CLAUDE.md"), longContent);

    const result = checkHealth(tempDir);
    const lengthCheck = result.items.find((i) => i.name === "CLAUDE.md length");
    expect(lengthCheck?.passed).toBe(false);
  });

  it("scores settings.json with permissions", () => {
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".claude", "settings.json"),
      JSON.stringify({ permissions: { allow: ["Read(**)", "Edit(**)"] } })
    );

    const result = checkHealth(tempDir);
    const settingsCheck = result.items.find((i) => i.name === "settings.json");
    expect(settingsCheck?.passed).toBe(true);
    expect(settingsCheck?.score).toBe(5);
  });

  it("detects agents", () => {
    const agentsDir = path.join(tempDir, ".claude", "agents");
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, "code-reviewer.md"), "---\nname: code-reviewer\n---\n");
    fs.writeFileSync(path.join(agentsDir, "test-writer.md"), "---\nname: test-writer\n---\n");

    const result = checkHealth(tempDir);
    const agentsCheck = result.items.find((i) => i.name === "Agents");
    expect(agentsCheck?.passed).toBe(true);
  });

  it("detects rules without paths filters", () => {
    const rulesDir = path.join(tempDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "bad-rule.md"), "---\n---\nNo paths filter here");

    const result = checkHealth(tempDir);
    const rulesCheck = result.items.find((i) => i.name === "Rules have paths filters");
    expect(rulesCheck?.passed).toBe(false);
  });

  it("passes rules check when all have paths", () => {
    const rulesDir = path.join(tempDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "good-rule.md"), '---\npaths: ["**/*.ts"]\n---\nGood');

    const result = checkHealth(tempDir);
    const rulesCheck = result.items.find((i) => i.name === "Rules have paths filters");
    expect(rulesCheck?.passed).toBe(true);
  });

  it("returns complete health result structure", () => {
    const result = checkHealth(tempDir);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("maxScore");
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);

    for (const item of result.items) {
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("passed");
      expect(item).toHaveProperty("score");
      expect(item).toHaveProperty("maxScore");
      expect(item).toHaveProperty("message");
    }
  });

  it("detects convention duplication between CLAUDE.md and skills", () => {
    const claudeDir = path.join(tempDir, ".claude");
    const skillsDir = path.join(claudeDir, "skills");
    fs.mkdirSync(skillsDir, { recursive: true });

    // CLAUDE.md with camelCase convention
    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "# Test\n\n## Code Conventions\n\nUse camelCase for variables\n"
    );
    // Skill that duplicates camelCase convention
    fs.writeFileSync(path.join(skillsDir, "style.md"), "---\nname: style\n---\nUse camelCase");

    const result = checkHealth(tempDir);
    const dupCheck = result.items.find((i) => i.name === "No duplication");
    expect(dupCheck?.passed).toBe(false);
    expect(dupCheck?.message).toContain("duplicate");
  });

  it("passes duplication check when no overlap", () => {
    const claudeDir = path.join(tempDir, ".claude");
    const skillsDir = path.join(claudeDir, "skills");
    fs.mkdirSync(skillsDir, { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "# Test\n\n## Code Conventions\n\nUse consistent naming\n"
    );
    fs.writeFileSync(
      path.join(skillsDir, "security.md"),
      "---\nname: security\n---\nFollow OWASP guidelines"
    );

    const result = checkHealth(tempDir);
    const dupCheck = result.items.find((i) => i.name === "No duplication");
    expect(dupCheck?.passed).toBe(true);
  });
});

// ============================================================================
// Portability Tests
// ============================================================================

describe("portability", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  describe("exportConfig", () => {
    it("exports .claude/ directory as JSON", () => {
      const claudeDir = path.join(tempDir, ".claude");
      fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "CLAUDE.md"), "# Test");
      fs.writeFileSync(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({ permissions: { allow: [] } })
      );
      fs.writeFileSync(path.join(claudeDir, "skills", "security.md"), "---\nname: security\n---");

      const outputPath = path.join(tempDir, "export.json");
      const config = exportConfig(tempDir, outputPath);

      expect(config.claudeMd).toBe("# Test");
      expect(config.settings).toHaveProperty("permissions");
      expect(config.skills["security.md"]).toBe("---\nname: security\n---");
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it("handles missing directories gracefully", () => {
      const outputPath = path.join(tempDir, "export.json");
      const config = exportConfig(tempDir, outputPath);

      expect(config.claudeMd).toBeNull();
      expect(config.settings).toBeNull();
      expect(Object.keys(config.skills).length).toBe(0);
    });
  });

  describe("importConfig", () => {
    it("imports config archive into project", () => {
      const config = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        projectName: "test",
        techStack: {},
        claudeMd: "# Imported",
        settings: { permissions: { allow: ["Read(**)"] } },
        skills: { "test.md": "# Test skill" },
        agents: {},
        rules: {},
        commands: {},
        hooks: {},
      };

      const archivePath = path.join(tempDir, "archive.json");
      fs.writeFileSync(archivePath, JSON.stringify(config));

      const targetDir = path.join(tempDir, "target");
      fs.mkdirSync(targetDir);

      const written = importConfig(archivePath, targetDir);

      expect(written).toContain(".claude/CLAUDE.md");
      expect(written).toContain(".claude/settings.json");
      expect(written).toContain(".claude/skills/test.md");
      expect(fs.readFileSync(path.join(targetDir, ".claude", "CLAUDE.md"), "utf-8")).toBe(
        "# Imported"
      );
    });

    it("skips existing files without force", () => {
      const config = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        projectName: "test",
        techStack: {},
        claudeMd: "# New",
        settings: null,
        skills: {},
        agents: {},
        rules: {},
        commands: {},
        hooks: {},
      };

      const archivePath = path.join(tempDir, "archive.json");
      fs.writeFileSync(archivePath, JSON.stringify(config));

      // Pre-create CLAUDE.md
      fs.mkdirSync(path.join(tempDir, "target", ".claude"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "target", ".claude", "CLAUDE.md"), "# Original");

      const written = importConfig(archivePath, path.join(tempDir, "target"), false);
      expect(written).not.toContain(".claude/CLAUDE.md");

      // Original content preserved
      expect(fs.readFileSync(path.join(tempDir, "target", ".claude", "CLAUDE.md"), "utf-8")).toBe(
        "# Original"
      );
    });

    it("overwrites existing files with force", () => {
      const config = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        projectName: "test",
        techStack: {},
        claudeMd: "# New",
        settings: null,
        skills: {},
        agents: {},
        rules: {},
        commands: {},
        hooks: {},
      };

      const archivePath = path.join(tempDir, "archive.json");
      fs.writeFileSync(archivePath, JSON.stringify(config));

      fs.mkdirSync(path.join(tempDir, "target", ".claude"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "target", ".claude", "CLAUDE.md"), "# Original");

      const written = importConfig(archivePath, path.join(tempDir, "target"), true);
      expect(written).toContain(".claude/CLAUDE.md");
      expect(fs.readFileSync(path.join(tempDir, "target", ".claude", "CLAUDE.md"), "utf-8")).toBe(
        "# New"
      );
    });
  });

  describe("loadTemplate", () => {
    it("loads valid template", () => {
      const template = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        projectName: "template",
        techStack: {},
        claudeMd: "# Template",
        settings: null,
        skills: { "test.md": "content" },
        agents: {},
        rules: {},
        commands: {},
        hooks: {},
      };

      const templatePath = path.join(tempDir, "template.json");
      fs.writeFileSync(templatePath, JSON.stringify(template));

      const loaded = loadTemplate(templatePath);
      expect(loaded).not.toBeNull();
      expect(loaded?.projectName).toBe("template");
    });

    it("returns null for missing file", () => {
      expect(loadTemplate("/nonexistent/path")).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      const badPath = path.join(tempDir, "bad.json");
      fs.writeFileSync(badPath, "not json");
      expect(loadTemplate(badPath)).toBeNull();
    });
  });

  describe("importConfig path traversal", () => {
    it("rejects filenames with path traversal", () => {
      const config = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        projectName: "evil",
        techStack: {},
        claudeMd: null,
        settings: null,
        skills: { "../hooks/evil.js": "malicious content" },
        agents: {},
        rules: {},
        commands: {},
        hooks: {},
      };

      const archivePath = path.join(tempDir, "evil.json");
      fs.writeFileSync(archivePath, JSON.stringify(config));

      const targetDir = path.join(tempDir, "target");
      fs.mkdirSync(targetDir);

      const written = importConfig(archivePath, targetDir);

      // Path traversal file should be rejected
      expect(written).not.toContain(".claude/skills/../hooks/evil.js");
      // The file should NOT exist outside the skills directory
      expect(fs.existsSync(path.join(targetDir, ".claude", "hooks", "evil.js"))).toBe(false);
    });
  });

  describe("importConfig error handling", () => {
    it("returns empty array on malformed JSON input", () => {
      const badPath = path.join(tempDir, "bad.json");
      fs.writeFileSync(badPath, "not valid json");

      const written = importConfig(badPath, tempDir);
      expect(written).toEqual([]);
    });
  });
});

// ============================================================================
// New Hook Tests
// ============================================================================

describe("new hooks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("sensitive files hook installs correctly", () => {
    installSensitiveHook(tempDir);
    const hookPath = path.join(tempDir, ".claude", "hooks", "protect-sensitive-files.js");
    expect(fs.existsSync(hookPath)).toBe(true);

    const status = checkSensitiveHookStatus(tempDir);
    expect(status.projectInstalled).toBe(true);
    expect(status.projectMatchesOurs).toBe(true);
  });

  it("EXTRAS registry contains new hooks", () => {
    const ids = EXTRAS.map((e) => e.id);
    expect(ids).toContain("sensitive-files");
  });

  it("EXTRAS has 3 entries total", () => {
    expect(EXTRAS.length).toBe(3);
  });
});

// ============================================================================
// writeSettings Merge Tests
// ============================================================================

describe("writeSettings merge", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("preserves existing user-added permissions", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({
        permissions: { allow: ["Read(**)", "Bash(custom:*)"] },
        customKey: "preserved",
      })
    );

    const stack = detectTechStack(tempDir);
    writeSettings(tempDir, stack);

    const result = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf-8"));

    // User's custom permission preserved
    expect(result.permissions.allow).toContain("Bash(custom:*)");
    // User's custom key preserved
    expect(result.customKey).toBe("preserved");
    // Generated permissions also present
    expect(result.permissions.allow).toContain("Read(**)");
  });

  it("overwrites with force=true", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ customKey: "will-be-lost", permissions: { allow: ["Bash(custom:*)"] } })
    );

    const stack = detectTechStack(tempDir);
    writeSettings(tempDir, stack, true);

    const result = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf-8"));

    expect(result.customKey).toBeUndefined();
    expect(result.permissions.allow).not.toContain("Bash(custom:*)");
  });
});

// ============================================================================
// Prompt Enhancement Tests
// ============================================================================

describe("prompt enhancements", () => {
  it("includes all 6 agents in the prompt", () => {
    const projectInfo = analyzeRepository(".");
    const prompt = getAnalysisPrompt(projectInfo);

    expect(prompt).toContain("code-reviewer.md");
    expect(prompt).toContain("test-writer.md");
    expect(prompt).toContain("code-simplifier.md");
    expect(prompt).toContain("explore.md");
    expect(prompt).toContain("plan.md");
    expect(prompt).toContain("docs-writer.md");
  });

  it("includes all 6 commands in the prompt", () => {
    const projectInfo = analyzeRepository(".");
    const prompt = getAnalysisPrompt(projectInfo);

    expect(prompt).toContain("analyze.md");
    expect(prompt).toContain("code-review.md");
    expect(prompt).toContain("commit.md");
    expect(prompt).toContain("fix.md");
    expect(prompt).toContain("explain.md");
    expect(prompt).toContain("refactor.md");
  });

  it("includes memory phase by default", () => {
    const projectInfo = analyzeRepository(".");
    const prompt = getAnalysisPrompt(projectInfo);

    expect(prompt).toContain("Phase 8: Seed Initial Memory");
    expect(prompt).toContain(".claude/memory/");
  });

  it("excludes memory phase with noMemory option", () => {
    const projectInfo = analyzeRepository(".");
    const prompt = getAnalysisPrompt(projectInfo, {
      claudeMdMode: "replace",
      existingClaudeMd: null,
      noMemory: true,
    });

    expect(prompt).not.toContain("Phase 8: Seed Initial Memory");
    expect(prompt).toContain("Skip memory seeding");
  });

  it("includes skill globs guidance", () => {
    const projectInfo = analyzeRepository(".");
    const prompt = getAnalysisPrompt(projectInfo);

    expect(prompt).toContain("Skill Globs Reference");
    expect(prompt).toContain("auto-triggering");
  });

  it("includes project-specific skill templates", () => {
    const projectInfo = analyzeRepository(".");
    const prompt = getAnalysisPrompt(projectInfo);

    expect(prompt).toContain("database-patterns.md");
    expect(prompt).toContain("docker-patterns.md");
    expect(prompt).toContain("monorepo-patterns.md");
    expect(prompt).toContain("cicd-patterns.md");
  });
});
