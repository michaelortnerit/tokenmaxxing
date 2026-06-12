import { sessions, users, type User } from "@tokenmaxxing/db";
import { and, eq, gt } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Drizzle } from "../database";
import { AuthRepository, type CurrentUser } from "./service";

const makeD1AuthRepository = Effect.fn("makeD1AuthRepository")(function* () {
  const database = yield* Drizzle;

  return AuthRepository.of({
    upsertUser: (profile) =>
      Effect.gen(function* () {
        const now = new Date();
        const insert = {
          id: crypto.randomUUID(),
          githubId: profile.githubId,
          login: profile.login,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          createdAt: now,
          updatedAt: now,
        };

        const [row] = yield* database.use((db) =>
          db
            .insert(users)
            .values(insert)
            .onConflictDoUpdate({
              target: users.githubId,
              set: {
                login: profile.login,
                name: profile.name,
                avatarUrl: profile.avatarUrl,
                updatedAt: now,
              },
            })
            .returning(),
        );

        return toCurrentUser(row ?? insert);
      }),
    insertSession: (input) =>
      Effect.gen(function* () {
        yield* database.use((db) =>
          db.insert(sessions).values({
            id: input.id,
            userId: input.userId,
            expiresAt: input.expiresAt,
            createdAt: new Date(),
          }),
        );
      }),
    findSessionUser: (sessionId, now) =>
      Effect.gen(function* () {
        const rows = yield* database.use((db) =>
          db
            .select({ user: users })
            .from(sessions)
            .innerJoin(users, eq(sessions.userId, users.id))
            .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
            .limit(1),
        );
        const row = rows[0];

        return row === undefined ? Option.none() : Option.some(toCurrentUser(row.user));
      }),
    deleteSession: (sessionId) =>
      Effect.gen(function* () {
        yield* database.use((db) => db.delete(sessions).where(eq(sessions.id, sessionId)));
      }),
  });
});

const AuthRepositoryLive = Layer.effect(AuthRepository, makeD1AuthRepository());

function toCurrentUser(user: Pick<User, "avatarUrl" | "id" | "login" | "name">): CurrentUser {
  return { avatarUrl: user.avatarUrl, id: user.id, login: user.login, name: user.name };
}

export { AuthRepositoryLive, makeD1AuthRepository };
