import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpServerRequest } from "effect/unstable/http";

import { Authorization, CurrentUser, Unauthorized } from "@tokenmaxxing/api-contract";

import { sessionTokenFrom } from "../../auth/cookies";
import { AuthService, type CurrentUser as AuthUser } from "../../auth/service";

/**
 * Request authentication for the session-guarded contract groups: bearer
 * header or the session cookie. Provides CurrentUser to handlers.
 *
 * Deliberately NOT an HttpApiSecurity-scheme middleware: the builder's
 * scheme fall-through re-runs the wrapped handler per scheme and treats the
 * handler's own domain failures as scheme failures, replacing them with the
 * last scheme's decode error. One plain middleware, one execution.
 */

const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const auth = yield* AuthService;

    return Authorization.of((httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const token = sessionTokenFrom(request);
        const user =
          token === null
            ? Option.none<AuthUser>()
            : yield* auth.resolveSession(token).pipe(Effect.catchCause(() => Effect.succeedNone));
        if (Option.isNone(user)) {
          return yield* Effect.fail(new Unauthorized({ message: "Sign in required." }));
        }

        return yield* Effect.provideService(httpEffect, CurrentUser, user.value);
      }),
    );
  }),
);

export { AuthorizationLive };
