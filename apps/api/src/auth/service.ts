import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import type { DatabaseError } from "../database";
import { generateToken, sha256Hex } from "./crypto";

/** Identity attached to requests after session resolution. */
interface CurrentUser {
  avatarUrl: string | null;
  id: string;
  login: string;
  name: string | null;
}

interface GitHubProfile {
  avatarUrl: string | null;
  githubId: number;
  login: string;
  name: string | null;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AuthServiceShape {
  /** Upserts the GitHub user and mints a browser session. Returns the RAW
   * token (stored hashed). */
  signInWithGitHub(
    profile: GitHubProfile,
  ): Effect.Effect<{ token: string; user: CurrentUser }, DatabaseError, any>;
  resolveSession(rawToken: string): Effect.Effect<Option.Option<CurrentUser>, DatabaseError, any>;
  signOut(rawToken: string): Effect.Effect<void, DatabaseError, any>;
}

interface AuthRepositoryShape {
  upsertUser(profile: GitHubProfile): Effect.Effect<CurrentUser, DatabaseError, any>;
  insertSession(input: {
    expiresAt: Date;
    id: string;
    userId: string;
  }): Effect.Effect<void, DatabaseError, any>;
  findSessionUser(
    sessionId: string,
    now: Date,
  ): Effect.Effect<Option.Option<CurrentUser>, DatabaseError, any>;
  deleteSession(sessionId: string): Effect.Effect<void, DatabaseError, any>;
}

class AuthService extends Context.Service<AuthService, AuthServiceShape>()(
  "@tokenmaxxing/api/AuthService",
) {}

class AuthRepository extends Context.Service<AuthRepository, AuthRepositoryShape>()(
  "@tokenmaxxing/api/AuthRepository",
) {}

const makeAuthService = Effect.fn("makeAuthService")(function* () {
  const repository = yield* AuthRepository;

  return AuthService.of({
    signInWithGitHub: Effect.fn("AuthService.signInWithGitHub")(function* (profile) {
      const user = yield* repository.upsertUser(profile);

      const token = yield* Effect.sync(() => generateToken());
      const id = yield* sha256Hex(token);
      yield* repository.insertSession({
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        id,
        userId: user.id,
      });

      return { token, user };
    }),
    resolveSession: Effect.fn("AuthService.resolveSession")(function* (rawToken) {
      const id = yield* sha256Hex(rawToken);
      return yield* repository.findSessionUser(id, new Date());
    }),
    signOut: Effect.fn("AuthService.signOut")(function* (rawToken) {
      const id = yield* sha256Hex(rawToken);
      yield* repository.deleteSession(id);
    }),
  });
});

const AuthServiceLive = Layer.effect(AuthService, makeAuthService());

export { AuthRepository, AuthService, AuthServiceLive, makeAuthService };

export type { AuthRepositoryShape, AuthServiceShape, CurrentUser, GitHubProfile };
