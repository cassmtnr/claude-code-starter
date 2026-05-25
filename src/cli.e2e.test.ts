/**
 * @module cli.e2e.test
 * @description End-to-end tests for the CLI entry point.
 *
 * These tests run against the built dist/cli.js artifact,
 * so `bun run build` must be run before executing them.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cliPath = path.resolve("dist/cli.js");
const linkPath = path.join(os.tmpdir(), `ccs-symlink-test-${process.pid}`);

afterEach(() => {
  try {
    fs.unlinkSync(linkPath);
  } catch {}
});

describe("CLI entry point (E2E)", () => {
  it("outputs version when invoked directly", () => {
    const out = execSync(`node ${cliPath} --version`, { encoding: "utf-8" });
    expect(out.trim()).toMatch(/^claude-code-starter v\d+\.\d+\.\d+/);
  });

  it("outputs version when invoked via symlink", () => {
    fs.symlinkSync(cliPath, linkPath);
    const out = execSync(`node ${linkPath} --version`, { encoding: "utf-8" });
    expect(out.trim()).toMatch(/^claude-code-starter v\d+\.\d+\.\d+/);
  });

  it("outputs help when invoked via symlink", () => {
    fs.symlinkSync(cliPath, linkPath);
    const out = execSync(`node ${linkPath} --help`, { encoding: "utf-8" });
    expect(out).toContain("USAGE");
    expect(out).toContain("OPTIONS");
  });
});

describe("main() orchestration (Phase 11 H5)", () => {
  const fixtureDir = path.resolve("src/__fixtures__");

  function pathWith(variant: "success" | "error" | "slow" | null): string {
    if (variant === null) {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-claude-"));
      return emptyDir;
    }
    const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
    fs.symlinkSync(
      path.join(fixtureDir, `fake-claude-${variant}.sh`),
      path.join(linkDir, "claude")
    );
    return `${linkDir}:${process.env.PATH}`;
  }

  it("exits 1 when claude CLI not found", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-noclaude-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    const result = spawnSync(process.execPath, [cliPath, "-y"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith(null) },
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(1);
  });

  it("exits 1 when claude analysis fails", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-fail-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    const result = spawnSync(process.execPath, [cliPath, "-y"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith("error") },
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(1);
  });

  it("exits 0 with -y when CLAUDE.md already exists (non-interactive branch)", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-existing-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    fs.mkdirSync(path.join(tmpProject, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(tmpProject, ".claude", "CLAUDE.md"), "# existing\n");
    const result = spawnSync(process.execPath, [cliPath, "-y"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith("success") },
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(0);
  });

  it("prints summary section to stdout on successful run", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-h5-summary-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"t"}');
    const result = spawnSync(process.execPath, [cliPath, "-y", "--profile=ci"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: pathWith("success") },
      encoding: "utf-8",
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    // Summary output contains the tech stack section — flexible match since the exact text may evolve.
    expect(result.stdout).toMatch(/Tech Stack|Project|complete/i);
  });
});

describe("full-flow E2E (Phase 11 M4)", () => {
  it("writes .claude/settings.json on -y --profile=ci success", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "p11-m4-"));
    fs.writeFileSync(path.join(tmpProject, "package.json"), '{"name":"e2e-fixture"}');
    fs.writeFileSync(path.join(tmpProject, "index.ts"), "export const x = 1;\n");

    const fixtureDir = path.resolve("src/__fixtures__");
    const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
    fs.symlinkSync(path.join(fixtureDir, "fake-claude-success.sh"), path.join(linkDir, "claude"));

    const result = spawnSync(process.execPath, [cliPath, "-y", "--profile=ci"], {
      cwd: tmpProject,
      env: { ...process.env, PATH: `${linkDir}:${process.env.PATH}` },
      encoding: "utf-8",
      timeout: 15000,
    });

    expect(result.status).toBe(0);
    // settings.json is written by writeSettings (deterministic), BEFORE runClaudeAnalysis.
    expect(fs.existsSync(path.join(tmpProject, ".claude", "settings.json"))).toBe(true);
    // .claude/CLAUDE.md is NOT asserted — fake binary's canned JSON emits tool_use events
    // for Read/Write but doesn't actually perform the writes.
  });
});
