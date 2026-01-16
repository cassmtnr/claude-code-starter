import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseArgs, detectProject, copyFile, copyDir } from "./cli.js";

// ============================================================================
// parseArgs Tests
// ============================================================================

describe("parseArgs", () => {
  it("should parse help flag with -h", () => {
    const args = parseArgs(["-h"]);
    expect(args.help).toBe(true);
    expect(args.version).toBe(false);
    expect(args.force).toBe(false);
  });

  it("should parse help flag with --help", () => {
    const args = parseArgs(["--help"]);
    expect(args.help).toBe(true);
  });

  it("should parse version flag with -v", () => {
    const args = parseArgs(["-v"]);
    expect(args.version).toBe(true);
    expect(args.help).toBe(false);
    expect(args.force).toBe(false);
  });

  it("should parse version flag with --version", () => {
    const args = parseArgs(["--version"]);
    expect(args.version).toBe(true);
  });

  it("should parse force flag with -f", () => {
    const args = parseArgs(["-f"]);
    expect(args.force).toBe(true);
    expect(args.help).toBe(false);
    expect(args.version).toBe(false);
  });

  it("should parse force flag with --force", () => {
    const args = parseArgs(["--force"]);
    expect(args.force).toBe(true);
  });

  it("should parse multiple flags", () => {
    const args = parseArgs(["-h", "-v", "-f"]);
    expect(args.help).toBe(true);
    expect(args.version).toBe(true);
    expect(args.force).toBe(true);
  });

  it("should return all false for empty args", () => {
    const args = parseArgs([]);
    expect(args.help).toBe(false);
    expect(args.version).toBe(false);
    expect(args.force).toBe(false);
  });

  it("should ignore unknown flags", () => {
    const args = parseArgs(["--unknown", "-x"]);
    expect(args.help).toBe(false);
    expect(args.version).toBe(false);
    expect(args.force).toBe(false);
  });
});

// ============================================================================
// detectProject Tests
// ============================================================================

describe("detectProject", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should detect empty directory as new project", () => {
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(false);
    expect(result.techStack).toEqual([]);
    expect(result.frameworks).toEqual([]);
    expect(result.directories).toEqual([]);
    expect(result.fileCount).toBe(0);
  });

  it("should detect Node.js project", () => {
    fs.writeFileSync(path.join(testDir, "package.json"), '{"name": "test"}');
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Node.js");
  });

  it("should detect TypeScript project", () => {
    fs.writeFileSync(path.join(testDir, "tsconfig.json"), "{}");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("TypeScript");
  });

  it("should detect Python project with requirements.txt", () => {
    fs.writeFileSync(path.join(testDir, "requirements.txt"), "flask==2.0.0");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Python");
  });

  it("should detect Python project with pyproject.toml", () => {
    fs.writeFileSync(path.join(testDir, "pyproject.toml"), "[project]");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Python");
  });

  it("should detect Rust project", () => {
    fs.writeFileSync(path.join(testDir, "Cargo.toml"), "[package]");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Rust");
  });

  it("should detect Go project", () => {
    fs.writeFileSync(path.join(testDir, "go.mod"), "module test");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Go");
  });

  it("should detect Java project with pom.xml", () => {
    fs.writeFileSync(path.join(testDir, "pom.xml"), "<project></project>");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Java");
  });

  it("should detect Java/Kotlin project with build.gradle", () => {
    fs.writeFileSync(path.join(testDir, "build.gradle"), "plugins {}");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Java/Kotlin");
  });

  it("should detect Ruby project", () => {
    fs.writeFileSync(path.join(testDir, "Gemfile"), 'source "https://rubygems.org"');
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.techStack).toContain("Ruby");
  });

  it("should detect src directory", () => {
    fs.mkdirSync(path.join(testDir, "src"));
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.directories).toContain("src");
  });

  it("should detect multiple directories", () => {
    fs.mkdirSync(path.join(testDir, "src"));
    fs.mkdirSync(path.join(testDir, "tests"));
    fs.mkdirSync(path.join(testDir, "lib"));
    const result = detectProject(testDir);
    expect(result.directories).toContain("src");
    expect(result.directories).toContain("tests");
    expect(result.directories).toContain("lib");
  });

  it("should detect React framework", () => {
    fs.writeFileSync(
      path.join(testDir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } })
    );
    const result = detectProject(testDir);
    expect(result.frameworks).toContain("React");
  });

  it("should detect Next.js framework", () => {
    fs.writeFileSync(
      path.join(testDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14.0.0" } })
    );
    const result = detectProject(testDir);
    expect(result.frameworks).toContain("Next.js");
  });

  it("should detect Vue framework", () => {
    fs.writeFileSync(
      path.join(testDir, "package.json"),
      JSON.stringify({ dependencies: { vue: "^3.0.0" } })
    );
    const result = detectProject(testDir);
    expect(result.frameworks).toContain("Vue");
  });

  it("should detect Express framework", () => {
    fs.writeFileSync(
      path.join(testDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.0.0" } })
    );
    const result = detectProject(testDir);
    expect(result.frameworks).toContain("Express");
  });

  it("should count source files", () => {
    fs.mkdirSync(path.join(testDir, "src"));
    fs.writeFileSync(path.join(testDir, "src", "index.ts"), "");
    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "");
    fs.writeFileSync(path.join(testDir, "src", "utils.js"), "");
    const result = detectProject(testDir);
    expect(result.fileCount).toBe(3);
  });

  it("should ignore node_modules", () => {
    fs.mkdirSync(path.join(testDir, "node_modules"));
    fs.writeFileSync(path.join(testDir, "node_modules", "dep.js"), "");
    const result = detectProject(testDir);
    expect(result.fileCount).toBe(0);
  });

  it("should not duplicate tech stack entries", () => {
    fs.writeFileSync(path.join(testDir, "requirements.txt"), "");
    fs.writeFileSync(path.join(testDir, "pyproject.toml"), "");
    const result = detectProject(testDir);
    const pythonCount = result.techStack.filter((t) => t === "Python").length;
    expect(pythonCount).toBe(1);
  });
});

// ============================================================================
// copyFile Tests
// ============================================================================

describe("copyFile", () => {
  let testDir: string;
  let srcFile: string;
  let destFile: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
    srcFile = path.join(testDir, "source.txt");
    destFile = path.join(testDir, "dest.txt");
    fs.writeFileSync(srcFile, "source content");
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should create new file and return 'created'", () => {
    const result = copyFile(srcFile, destFile, false);
    expect(result).toBe("created");
    expect(fs.existsSync(destFile)).toBe(true);
    expect(fs.readFileSync(destFile, "utf-8")).toBe("source content");
  });

  it("should skip existing file without force", () => {
    fs.writeFileSync(destFile, "existing content");
    const result = copyFile(srcFile, destFile, false);
    expect(result).toBe("skipped");
    expect(fs.readFileSync(destFile, "utf-8")).toBe("existing content");
  });

  it("should overwrite existing file with force and return 'updated'", () => {
    fs.writeFileSync(destFile, "existing content");
    const result = copyFile(srcFile, destFile, true);
    expect(result).toBe("updated");
    expect(fs.readFileSync(destFile, "utf-8")).toBe("source content");
  });

  it("should return 'created' when force is true but file doesn't exist", () => {
    const result = copyFile(srcFile, destFile, true);
    expect(result).toBe("created");
    expect(fs.readFileSync(destFile, "utf-8")).toBe("source content");
  });
});

// ============================================================================
// copyDir Tests
// ============================================================================

describe("copyDir", () => {
  let testDir: string;
  let srcDir: string;
  let destDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
    srcDir = path.join(testDir, "src");
    destDir = path.join(testDir, "dest");
    fs.mkdirSync(srcDir);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should copy files to new directory", () => {
    fs.writeFileSync(path.join(srcDir, "file1.txt"), "content1");
    fs.writeFileSync(path.join(srcDir, "file2.txt"), "content2");
    copyDir(srcDir, destDir);
    expect(fs.existsSync(path.join(destDir, "file1.txt"))).toBe(true);
    expect(fs.existsSync(path.join(destDir, "file2.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, "file1.txt"), "utf-8")).toBe("content1");
  });

  it("should copy nested directories", () => {
    fs.mkdirSync(path.join(srcDir, "nested"));
    fs.writeFileSync(path.join(srcDir, "nested", "deep.txt"), "deep content");
    copyDir(srcDir, destDir);
    expect(fs.existsSync(path.join(destDir, "nested", "deep.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, "nested", "deep.txt"), "utf-8")).toBe("deep content");
  });

  it("should create destination directory if it doesn't exist", () => {
    const newDest = path.join(testDir, "new", "nested", "dest");
    fs.writeFileSync(path.join(srcDir, "file.txt"), "content");
    copyDir(srcDir, newDest);
    expect(fs.existsSync(path.join(newDest, "file.txt"))).toBe(true);
  });

  it("should overwrite existing files in destination", () => {
    fs.mkdirSync(destDir);
    fs.writeFileSync(path.join(srcDir, "file.txt"), "new content");
    fs.writeFileSync(path.join(destDir, "file.txt"), "old content");
    copyDir(srcDir, destDir);
    expect(fs.readFileSync(path.join(destDir, "file.txt"), "utf-8")).toBe("new content");
  });
});
