/**
 * @module cli.e2e.test
 * @description End-to-end tests for the CLI entry point.
 *
 * These tests run against the built dist/cli.js artifact,
 * so `bun run build` must be run before executing them.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
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
