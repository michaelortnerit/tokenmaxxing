import { RemovalPolicy, Stage } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

function databaseNameForStage(stage: string): string {
  return `tokenmaxxing-${stage}`;
}

const Database = Cloudflare.D1Database("DB", {
  name: Stage.pipe(Effect.map(databaseNameForStage)),
  migrationsDir: "./packages/db/migrations",
}).pipe(RemovalPolicy.retain());

export { Database, databaseNameForStage };
