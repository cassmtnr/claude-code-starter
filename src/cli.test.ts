import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseArgs, detectProject, copyFile, copyDir, getVersion, getTemplatesDir } from "./cli.js";

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
    expect(result.fileCount).toBe(0);
  });

  it("should detect existing project with source files", () => {
    fs.writeFileSync(path.join(testDir, "index.ts"), "");
    fs.writeFileSync(path.join(testDir, "app.py"), "");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.fileCount).toBe(2);
  });

  it("should ignore patterns from .gitignore", () => {
    fs.writeFileSync(path.join(testDir, ".gitignore"), "node_modules\ndist\n");
    fs.mkdirSync(path.join(testDir, "node_modules"));
    fs.writeFileSync(path.join(testDir, "node_modules", "dep.js"), "");
    fs.mkdirSync(path.join(testDir, "dist"));
    fs.writeFileSync(path.join(testDir, "dist", "bundle.js"), "");
    fs.writeFileSync(path.join(testDir, "src.ts"), ""); // not ignored
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(true);
    expect(result.fileCount).toBe(1);
  });

  it("should always ignore .git", () => {
    fs.mkdirSync(path.join(testDir, ".git"));
    fs.writeFileSync(path.join(testDir, ".git", "config"), "");
    const result = detectProject(testDir);
    expect(result.isExisting).toBe(false);
    expect(result.fileCount).toBe(0);
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

  it("should handle empty source directory", () => {
    copyDir(srcDir, destDir);
    expect(fs.existsSync(destDir)).toBe(true);
    expect(fs.readdirSync(destDir)).toEqual([]);
  });
});

// ============================================================================
// getVersion Tests
// ============================================================================

describe("getVersion", () => {
  it("should return a valid semver version string", () => {
    const version = getVersion();
    expect(typeof version).toBe("string");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ============================================================================
// getTemplatesDir Tests
// ============================================================================

describe("getTemplatesDir", () => {
  it("should return a path ending with templates", () => {
    const templatesDir = getTemplatesDir();
    expect(typeof templatesDir).toBe("string");
    expect(templatesDir.endsWith("templates")).toBe(true);
  });
});

