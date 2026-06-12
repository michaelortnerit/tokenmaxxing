import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";

import { AppConfig, type GitHubOAuthConfig } from "../config";

/**
 * Every call this worker makes to GitHub: the OAuth code exchange and the
 * user profile read. Identity only — no repo access, no GitHub App.
 */

class GitHubApiError extends Data.TaggedError("GitHubApiError")<{
  readonly cause: unknown;
}> {}

interface GitHubUserProfile {
  avatarUrl: string | null;
  githubId: number;
  login: string;
  name: string | null;
}

interface GitHubClientShape {
  /** OAuth authorization-code exchange; returns the user access token. */
  exchangeCode(code: string, redirectUri: string): Effect.Effect<string, GitHubApiError>;
  fetchUser(accessToken: string): Effect.Effect<GitHubUserProfile, GitHubApiError>;
}

class GitHubClient extends Context.Service<GitHubClient, GitHubClientShape>()(
  "@tokenmaxxing/api/GitHubClient",
) {}

const githubHeaders = (token: string) => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${token}`,
  // GitHub rejects requests without a User-Agent.
  "user-agent": "tokenmaxxing",
});

const makeGitHubClient = Effect.fn("makeGitHubClient")(function* () {
  const config = yield* AppConfig;
  const http = yield* HttpClient.HttpClient;

  const requestJson = Effect.fn("GitHubClient.requestJson")(function* (
    request: HttpClientRequest.HttpClientRequest,
  ) {
    const response = yield* http
      .execute(request)
      .pipe(Effect.mapError((cause) => new GitHubApiError({ cause })));
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.fail(
        new GitHubApiError({
          cause: new Error(`GitHub responded ${response.status} for ${request.url}`),
        }),
      );
    }

    return yield* response.json.pipe(Effect.mapError((cause) => new GitHubApiError({ cause })));
  });

  return GitHubClient.of({
    exchangeCode: Effect.fn("GitHubClient.exchangeCode")(function* (code, redirectUri) {
      const payload = (yield* requestJson(
        HttpClientRequest.post("https://github.com/login/oauth/access_token", {
          headers: { accept: "application/json" },
        }).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            client_id: config.github.clientId,
            client_secret: config.github.clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        ),
      )) as { access_token?: string; error?: string };
      if (typeof payload.access_token !== "string") {
        return yield* Effect.fail(
          new GitHubApiError({
            cause: new Error(`GitHub token exchange rejected: ${payload.error ?? "no token"}`),
          }),
        );
      }

      return payload.access_token;
    }),
    fetchUser: Effect.fn("GitHubClient.fetchUser")(function* (accessToken) {
      const payload = (yield* requestJson(
        HttpClientRequest.get("https://api.github.com/user", {
          headers: githubHeaders(accessToken),
        }),
      )) as { avatar_url?: string; id: number; login: string; name?: string | null };

      return {
        avatarUrl: payload.avatar_url ?? null,
        githubId: payload.id,
        login: payload.login,
        name: payload.name ?? null,
      };
    }),
  });
});

function buildAuthorizeUrl(config: GitHubOAuthConfig, redirectUri: string, state: string): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  // Identity only; the public profile is all the leaderboard needs.
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);

  return url.toString();
}

export { buildAuthorizeUrl, GitHubApiError, GitHubClient, makeGitHubClient };

export type { GitHubClientShape, GitHubUserProfile };
