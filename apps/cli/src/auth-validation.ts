import { Effect } from "effect";
import type { AuthUser } from "@tokenmaxxing/api-contract";

import { humanSpinner, type HumanOutputOptions } from "./output";
import type { TokenmaxxingApiClient } from "./services";

interface ValidateCurrentLoginOptions extends HumanOutputOptions {
  showSpinner?: boolean | undefined;
}

type CurrentLoginValidation =
  | { _tag: "failed"; cause: unknown }
  | { _tag: "unauthorized" }
  | { _tag: "valid"; user: AuthUser };

function validateCurrentLogin(
  client: TokenmaxxingApiClient,
  options: ValidateCurrentLoginOptions = {},
) {
  return Effect.gen(function* () {
    const spinner =
      options.showSpinner === true
        ? yield* humanSpinner("Checking current login...", options)
        : undefined;
    const result = yield* client.me.me().pipe(
      Effect.map((me): CurrentLoginValidation => ({ _tag: "valid", user: me.user })),
      Effect.catch((cause) =>
        Effect.succeed(
          isUnauthorizedError(cause)
            ? ({ _tag: "unauthorized" } satisfies CurrentLoginValidation)
            : ({ _tag: "failed", cause } satisfies CurrentLoginValidation),
        ),
      ),
    );

    if (result._tag === "valid") {
      yield* Effect.sync(() => spinner?.stop("Validated current login."));
      return result;
    }

    yield* Effect.sync(() => spinner?.error("Could not validate current login."));
    return result;
  });
}

function isUnauthorizedError(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { _tag?: string })._tag === "Unauthorized"
  );
}

export { isUnauthorizedError, validateCurrentLogin };
export type { CurrentLoginValidation, ValidateCurrentLoginOptions };
