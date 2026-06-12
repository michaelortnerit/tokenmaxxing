import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

import { CliAuth, Unauthorized } from "@tokenmaxxing/api-contract";

import { AuthRepositoryLive } from "./auth/d1";
import { AuthService, makeAuthService } from "./auth/service";
import { Database } from "./cloudflare/database";
import { AppConfig } from "./config";
import { Drizzle } from "./database";
import { GitHubClient, makeGitHubClient } from "./github/client";
import { AuthorizationLive } from "./http/middleware/authorization";
import { makeApiHttpEffect } from "./http/layer";

/** Placeholder until the device-code milestone lands: CLI endpoints 401. */
const cliAuthStubLayer = Layer.succeed(
  CliAuth,
  CliAuth.of(() => Effect.fail(new Unauthorized({ message: "CLI token required." }))),
);

const ApiWorker = Cloudflare.Worker(
  "api",
  {
    name: "tokenmaxxing-api",
    main: import.meta.filename,
    url: false,
    compatibility: {
      date: "2026-06-02",
      flags: ["nodejs_compat"],
    },
    domain: "api.tokenmaxxing.851.sh",
    observability: {
      enabled: true,
    },
    dev: {
      port: 8788,
      strictPort: true,
    },
  },
  Effect.gen(function* () {
    const connection = yield* Cloudflare.D1Connection.bind(Database);

    // Config reads stay in this outer Effect so alchemy's deploy-time
    // binding discovery sees them (secrets bind as secret_text).
    const config = yield* AppConfig.fromEnv;
    const appConfigLayer = Layer.succeed(AppConfig, config);
    const drizzleLayer = Drizzle.layer(connection);

    const auth = yield* makeAuthService().pipe(
      Effect.provide(AuthRepositoryLive.pipe(Layer.provide(drizzleLayer))),
    );
    const github = yield* makeGitHubClient().pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(AppConfig, config),
    );

    // Handlers and raw routes (OAuth) resolve these services at request
    // time, not layer-build time — this context rides along with every
    // routed request.
    const rawRouteServices = Context.empty().pipe(
      Context.add(AppConfig, config),
      Context.add(AuthService, auth),
      Context.add(GitHubClient, github),
    );

    return {
      fetch: makeApiHttpEffect({
        appConfigLayer,
        authServiceLayer: Layer.succeed(AuthService, auth),
        drizzleLayer,
        middlewareLayer: Layer.mergeAll(AuthorizationLive, cliAuthStubLayer),
      }).pipe(Effect.map((apiHttpEffect) => apiHttpEffect.pipe(Effect.provide(rawRouteServices)))),
    };
  }).pipe(Effect.provide([Cloudflare.D1ConnectionLive, Cloudflare.D1ConnectionPolicyLive])),
);

export default ApiWorker;
