import { RemovalPolicy } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Stack } from "alchemy/Stack";

function databaseNameForStage(stage: string): string {
  return `tokenmaxxing-${stage}`;
}

const Database = Cloudflare.D1Database(
  "DB",
  Stack.useSync(({ stage }) => ({
    name: databaseNameForStage(stage),
    migrationsDir: "./packages/db/migrations",
  })),
).pipe(RemovalPolicy.retain());

export { Database, databaseNameForStage };
