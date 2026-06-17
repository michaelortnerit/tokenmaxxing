import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { ConsoleService } from "./services";
import { renderCliFailure } from "./errors";
import { NotLoggedInError } from "./commands/whoami";

function testConsole() {
  const errors: string[] = [];
  const logs: string[] = [];
  const layer = Layer.succeed(ConsoleService)({
    error: (message?: unknown) => {
      errors.push(String(message));
    },
    log: (message?: unknown) => {
      logs.push(String(message));
    },
  });

  return { errors, layer, logs };
}

describe("renderCliFailure", () => {
  it("renders expected failures as strict JSON when --json is active", async () => {
    const { errors, layer, logs } = testConsole();

    const exit = await Effect.runPromiseExit(
      Effect.fail(new NotLoggedInError()).pipe(
        Effect.tapCause((cause) => renderCliFailure(cause, { json: true, verbose: false })),
        Effect.provide(layer),
      ),
    );

    expect(exit._tag).toBe("Failure");
    expect(logs).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(JSON.parse(errors[0]!)).toEqual({
      error: {
        code: "not_logged_in",
        hint: "run tokenmaxxing login",
        message: "not logged in",
      },
      status: "error",
    });
  });
});

export {};
