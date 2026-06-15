import * as Context from "effect/Context";
import * as Data from "effect/Data";
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

type OAuthProviderId = "github" | "google";

interface OAuthProfile {
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  login: string | null;
  name: string | null;
  provider: OAuthProviderId;
  providerAccountId: string;
}

interface UserAccountSummary {
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  login: string | null;
  name: string | null;
  provider: OAuthProviderId;
  providerAccountId: string;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

class AccountLinkConflict extends Data.TaggedError("AccountLinkConflict")<{
  readonly provider: OAuthProviderId;
}> {}

interface AuthServiceShape {
  /** Resolves or links a provider identity, then mints a browser session.
   * Returns the RAW token (stored hashed). */
  signInWithProvider(
    profile: OAuthProfile,
    options?: { currentUser?: CurrentUser | undefined },
  ): Effect.Effect<{ token: string; user: CurrentUser }, AccountLinkConflict | DatabaseError, any>;
  resolveSession(rawToken: string): Effect.Effect<Option.Option<CurrentUser>, DatabaseError, any>;
  signOut(rawToken: string): Effect.Effect<void, DatabaseError, any>;
  listAccounts(userId: string): Effect.Effect<UserAccountSummary[], DatabaseError, any>;
}

interface AuthRepositoryShape {
  createUserWithAccount(input: {
    account: OAuthProfile;
    login: string;
  }): Effect.Effect<CurrentUser, DatabaseError, any>;
  findAccountUser(
    provider: OAuthProviderId,
    providerAccountId: string,
  ): Effect.Effect<Option.Option<CurrentUser>, DatabaseError, any>;
  findUserById(userId: string): Effect.Effect<Option.Option<CurrentUser>, DatabaseError, any>;
  findUsersByVerifiedEmail(email: string): Effect.Effect<CurrentUser[], DatabaseError, any>;
  insertSession(input: {
    expiresAt: Date;
    id: string;
    userId: string;
  }): Effect.Effect<void, DatabaseError, any>;
  isLoginTaken(login: string): Effect.Effect<boolean, DatabaseError, any>;
  linkAccount(
    userId: string,
    profile: OAuthProfile,
  ): Effect.Effect<CurrentUser, DatabaseError, any>;
  listAccounts(userId: string): Effect.Effect<UserAccountSummary[], DatabaseError, any>;
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

  const mintSession = Effect.fn("AuthService.mintSession")(function* (user: CurrentUser) {
    const token = yield* Effect.sync(() => generateToken());
    const id = yield* sha256Hex(token);
    yield* repository.insertSession({
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      id,
      userId: user.id,
    });

    return { token, user };
  });

  return AuthService.of({
    signInWithProvider: Effect.fn("AuthService.signInWithProvider")(
      function* (rawProfile, options) {
        const profile = normalizeOAuthProfile(rawProfile);
        const existing = yield* repository.findAccountUser(
          profile.provider,
          profile.providerAccountId,
        );
        if (Option.isSome(existing)) {
          if (options?.currentUser !== undefined && options.currentUser.id !== existing.value.id) {
            return yield* Effect.fail(new AccountLinkConflict({ provider: profile.provider }));
          }

          const user = yield* repository.linkAccount(existing.value.id, profile);
          return yield* mintSession(user);
        }

        if (options?.currentUser !== undefined) {
          const user = yield* repository.linkAccount(options.currentUser.id, profile);
          return yield* mintSession(user);
        }

        const emailUser = yield* uniqueVerifiedEmailUser(profile);
        if (Option.isSome(emailUser)) {
          const user = yield* repository.linkAccount(emailUser.value.id, profile);
          return yield* mintSession(user);
        }

        const login = yield* nextAvailableLogin(loginBaseFromProfile(profile));
        const user = yield* repository.createUserWithAccount({ account: profile, login });
        return yield* mintSession(user);
      },
    ),
    resolveSession: Effect.fn("AuthService.resolveSession")(function* (rawToken) {
      const id = yield* sha256Hex(rawToken);
      return yield* repository.findSessionUser(id, new Date());
    }),
    signOut: Effect.fn("AuthService.signOut")(function* (rawToken) {
      const id = yield* sha256Hex(rawToken);
      yield* repository.deleteSession(id);
    }),
    listAccounts: Effect.fn("AuthService.listAccounts")(function* (userId) {
      return yield* repository.listAccounts(userId);
    }),
  });

  function uniqueVerifiedEmailUser(profile: OAuthProfile) {
    if (!profile.emailVerified || profile.email === null) {
      return Effect.succeed(Option.none<CurrentUser>());
    }

    const email = profile.email;
    return Effect.gen(function* () {
      const users = yield* repository.findUsersByVerifiedEmail(email);
      const uniqueUsers = [...new Map(users.map((user) => [user.id, user])).values()];

      return uniqueUsers.length === 1 ? Option.some(uniqueUsers[0]!) : Option.none<CurrentUser>();
    });
  }

  function nextAvailableLogin(base: string) {
    return Effect.gen(function* () {
      for (let suffix = 1; suffix < 10_000; suffix += 1) {
        const candidate = suffix === 1 ? base : `${base}-${suffix}`;
        const taken = yield* repository.isLoginTaken(candidate);
        if (!taken) {
          return candidate;
        }
      }

      return `${base}-${crypto.randomUUID().slice(0, 8)}`;
    });
  }
});

const AuthServiceLive = Layer.effect(AuthService, makeAuthService());

function normalizeOAuthProfile(profile: OAuthProfile): OAuthProfile {
  return {
    ...profile,
    email: profile.email === null ? null : profile.email.trim().toLowerCase(),
    login: normalizeNullableString(profile.login),
    name: normalizeNullableString(profile.name),
  };
}

function normalizeNullableString(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function loginBaseFromProfile(profile: OAuthProfile): string {
  const raw =
    profile.provider === "github" && profile.login !== null
      ? profile.login
      : (profile.email?.split("@", 1)[0] ?? profile.login ?? "user");

  return slugifyLogin(raw);
}

function slugifyLogin(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^[-_]+|[-_]+$/g, "");

  return slug.length === 0 ? "user" : slug;
}

export {
  AccountLinkConflict,
  AuthRepository,
  AuthService,
  AuthServiceLive,
  loginBaseFromProfile,
  makeAuthService,
};

export type {
  AuthRepositoryShape,
  AuthServiceShape,
  CurrentUser,
  OAuthProfile,
  OAuthProviderId,
  UserAccountSummary,
};
