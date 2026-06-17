import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const cliRoot = resolve(import.meta.dirname, "../..");

function runCli(args: readonly string[]) {
  const result = spawnSync("bun", ["src/index.ts", ...args], {
    cwd: cliRoot,
    encoding: "utf8",
  });

  return {
    output: `${result.stdout}${result.stderr}`,
    status: result.status,
  };
}

describe("root command", () => {
  it("lists upgrade but not update", () => {
    const result = runCli(["--help"]);

    expect(result.status).toBe(0);
    expect(result.output).toContain("upgrade    Upgrade the globally installed CLI");
    expect(result.output).not.toContain("update     Update the globally installed CLI");
  });

  it("rejects update as an unknown subcommand", () => {
    const result = runCli(["update"]);

    expect(result.status).toBe(1);
    expect(result.output).toContain('Unknown subcommand "update"');
    expect(result.output).toContain("upgrade    Upgrade the globally installed CLI");
  });

  it("exposes --json on all service subcommands and upgrade", () => {
    for (const args of [
      ["upgrade", "--help"],
      ["service", "install", "--help"],
      ["service", "uninstall", "--help"],
      ["service", "status", "--help"],
      ["service", "doctor", "--help"],
      ["service", "run", "--help"],
    ]) {
      const result = runCli(args);

      expect(result.status).toBe(0);
      expect(result.output).toContain("--json");
    }
  });
});

export {};
