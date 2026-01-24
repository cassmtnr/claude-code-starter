import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRepository, detectTechStack, summarizeTechStack } from "./analyzer.js";
import { getVersion, parseArgs } from "./cli.js";
import { generateArtifacts, writeArtifacts } from "./generator.js";

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
      // Create a minimal stack for testing
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
    // Should only count src/index.ts, not ignored files
    expect(info.fileCount).toBe(1);
  });
});

// ============================================================================
// Artifact Generation Tests
// ============================================================================

describe("generateArtifacts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("generates CLAUDE.md artifact", () => {
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const claudeMd = result.artifacts.find((a) => a.type === "claude-md");
    expect(claudeMd).toBeDefined();
    expect(claudeMd?.path).toBe(".claude/CLAUDE.md");
    expect(claudeMd?.content).toContain("# ");
  });

  it("generates settings.json artifact", () => {
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const settings = result.artifacts.find((a) => a.type === "settings");
    expect(settings).toBeDefined();
    expect(settings?.path).toBe(".claude/settings.json");
    expect(settings?.content).toContain("permissions");
  });

  it("generates universal skills", () => {
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const skills = result.artifacts.filter((a) => a.type === "skill");
    expect(skills.length).toBeGreaterThanOrEqual(3);
    expect(skills.map((s) => s.path)).toContain(".claude/skills/pattern-discovery.md");
    expect(skills.map((s) => s.path)).toContain(".claude/skills/systematic-debugging.md");
    expect(skills.map((s) => s.path)).toContain(".claude/skills/testing-methodology.md");
  });

  it("generates agents", () => {
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const agents = result.artifacts.filter((a) => a.type === "agent");
    expect(agents.length).toBeGreaterThanOrEqual(2);
    expect(agents.map((a) => a.path)).toContain(".claude/agents/code-reviewer.md");
    expect(agents.map((a) => a.path)).toContain(".claude/agents/test-writer.md");
  });

  it("generates commands", () => {
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const commands = result.artifacts.filter((a) => a.type === "command");
    expect(commands.length).toBe(4);
    expect(commands.map((c) => c.path)).toContain(".claude/commands/task.md");
    expect(commands.map((c) => c.path)).toContain(".claude/commands/status.md");
    expect(commands.map((c) => c.path)).toContain(".claude/commands/done.md");
    expect(commands.map((c) => c.path)).toContain(".claude/commands/analyze.md");
  });

  it("generates Next.js skill for Next.js projects", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { next: "14.0.0" } })
    );
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const skills = result.artifacts.filter((a) => a.type === "skill");
    expect(skills.map((s) => s.path)).toContain(".claude/skills/nextjs-patterns.md");
  });

  it("generates FastAPI skill for FastAPI projects", () => {
    fs.writeFileSync(path.join(tempDir, "requirements.txt"), "fastapi==0.100.0");
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const skills = result.artifacts.filter((a) => a.type === "skill");
    expect(skills.map((s) => s.path)).toContain(".claude/skills/fastapi-patterns.md");
  });

  it("generates TypeScript rules for TypeScript projects", () => {
    fs.writeFileSync(path.join(tempDir, "tsconfig.json"), "{}");
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const rules = result.artifacts.filter((a) => a.type === "rule");
    expect(rules.map((r) => r.path)).toContain(".claude/rules/typescript.md");
  });

  it("generates Python rules for Python projects", () => {
    fs.writeFileSync(path.join(tempDir, "requirements.txt"), "flask");
    const info = analyzeRepository(tempDir);
    const result = generateArtifacts(info);
    const rules = result.artifacts.filter((a) => a.type === "rule");
    expect(rules.map((r) => r.path)).toContain(".claude/rules/python.md");
  });
});

// ============================================================================
// Artifact Writing Tests
// ============================================================================

describe("writeArtifacts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("creates new files", () => {
    const artifacts = [
      { type: "skill" as const, path: ".claude/skills/test.md", content: "# Test", isNew: true },
    ];
    const result = writeArtifacts(artifacts, tempDir, false);
    expect(result.created).toContain(".claude/skills/test.md");
    expect(fs.existsSync(path.join(tempDir, ".claude", "skills", "test.md"))).toBe(true);
  });

  it("updates existing files", () => {
    // Create existing file
    const filePath = path.join(tempDir, ".claude", "skills", "test.md");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "# Old Content");

    const artifacts = [
      {
        type: "skill" as const,
        path: ".claude/skills/test.md",
        content: "# New Content",
        isNew: false,
      },
    ];
    const result = writeArtifacts(artifacts, tempDir, false);
    expect(result.updated).toContain(".claude/skills/test.md");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("# New Content");
  });

  it("skips task.md when not forced", () => {
    // Create existing task file
    const taskPath = path.join(tempDir, ".claude", "state", "task.md");
    fs.mkdirSync(path.dirname(taskPath), { recursive: true });
    fs.writeFileSync(taskPath, "# My Important Task");

    const artifacts = [
      {
        type: "command" as const,
        path: ".claude/state/task.md",
        content: "# New Task",
        isNew: false,
      },
    ];
    const result = writeArtifacts(artifacts, tempDir, false);
    expect(result.skipped).toContain(".claude/state/task.md");
    expect(fs.readFileSync(taskPath, "utf-8")).toBe("# My Important Task");
  });

  it("overwrites with force flag", () => {
    // Create existing file
    const filePath = path.join(tempDir, ".claude", "CLAUDE.md");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "# Old");

    const artifacts = [
      { type: "claude-md" as const, path: ".claude/CLAUDE.md", content: "# New", isNew: false },
    ];
    const result = writeArtifacts(artifacts, tempDir, true);
    expect(result.updated).toContain(".claude/CLAUDE.md");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("# New");
  });

  it("creates nested directory structure", () => {
    const artifacts = [
      {
        type: "skill" as const,
        path: ".claude/skills/deep/nested/skill.md",
        content: "# Deep",
        isNew: true,
      },
    ];
    writeArtifacts(artifacts, tempDir, false);
    expect(
      fs.existsSync(path.join(tempDir, ".claude", "skills", "deep", "nested", "skill.md"))
    ).toBe(true);
  });
});
