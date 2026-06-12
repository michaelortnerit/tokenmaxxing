import { hostname } from "node:os";

import { Data, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import type { UsageDayInput } from "@tokenmaxxing/api-contract";

import { aggregateDays, summarize } from "../ccusage/aggregate";
import { runCcusageSource } from "../ccusage/runner";
import { DEFAULT_SOURCE_NAMES, resolveSources } from "../ccusage/sources";
import { ApiClientService, ConfigService, ConsoleService } from "../services";
import { NotLoggedInError } from "./whoami";

class SyncPushError extends Data.TaggedError("SyncPushError")<{
  readonly cause: unknown;
}> {
  override message =
    "error: failed to push usage to tokenmaxxing\nhint: check your network and run tokenmaxxing sync again";
}

class UnknownSourceError extends Data.TaggedError("UnknownSourceError")<{
  readonly names: string[];
}> {
  override get message() {
    return `error: unknown source${this.names.length > 1 ? "s" : ""}: ${this.names.join(", ")}\nhint: valid sources are ${DEFAULT_SOURCE_NAMES.join(", ")}`;
  }
}

const CHUNK_SIZE = 1000;

const syncCommand = Command.make(
  "sync",
  {
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDescription("Aggregate locally but push nothing"),
    ),
    json: Flag.boolean("json").pipe(Flag.withDescription("Output machine-readable JSON")),
    since: Flag.string("since").pipe(
      Flag.optional,
      Flag.withDescription("Only sync days on or after this date (YYYY-MM-DD)"),
    ),
    sources: Flag.string("sources").pipe(
      Flag.optional,
      Flag.withDescription(
        `Comma-separated agents to sync (default: ${DEFAULT_SOURCE_NAMES.join(",")})`,
      ),
    ),
  },
  ({ dryRun, json, since, sources }) =>
    syncEffect({
      dryRun,
      json,
      since: Option.getOrUndefined(since),
      sources: Option.getOrUndefined(sources),
    }),
).pipe(Command.withDescription("Aggregate local agent usage via ccusage and push it"));

interface SyncOptions {
  dryRun: boolean;
  json: boolean;
  since?: string | undefined;
  sources?: string | undefined;
}

function syncEffect(options: SyncOptions) {
  return Effect.gen(function* () {
    const config = yield* Effect.service(ConfigService);
    const clients = yield* Effect.service(ApiClientService);
    const console = yield* Effect.service(ConsoleService);

    const output = options.json ? { error: console.error, log: () => {} } : console;

    const stored = yield* config.readConfig();
    if (stored.token === undefined) {
      return yield* Effect.fail(new NotLoggedInError());
    }

    const requested = options.sources?.split(",") ?? DEFAULT_SOURCE_NAMES;
    const { invalid, sources } = resolveSources(requested);
    if (invalid.length > 0) {
      return yield* Effect.fail(new UnknownSourceError({ names: invalid }));
    }

    const client = yield* clients.make({ baseUrl: stored.apiUrl, token: stored.token });
    // Validates the token up front and gives us the login for the final URL.
    const me = yield* client.me.me().pipe(Effect.mapError(() => new NotLoggedInError()));

    const rows: UsageDayInput[] = [];
    const sourceSummaries: Record<string, ReturnType<typeof summarize> | null> = {};
    for (const source of sources) {
      const report = yield* runCcusageSource(source, { since: options.since });
      if (Option.isNone(report) || report.value.length === 0) {
        sourceSummaries[source.source] = null;
        yield* Effect.sync(() => output.log(`${source.source.padEnd(9)} skipped (no data)`));
        continue;
      }

      const sourceRows = aggregateDays(source.source, report.value);
      const summary = summarize(sourceRows);
      sourceSummaries[source.source] = summary;
      rows.push(...sourceRows);
      yield* Effect.sync(() =>
        output.log(
          `${source.source.padEnd(9)} ${summary.days} days · ${summary.models} models · $${summary.spendUsd.toFixed(2)}`,
        ),
      );
    }

    if (options.dryRun || rows.length === 0) {
      yield* Effect.sync(() => {
        if (options.json) {
          console.log(
            JSON.stringify({
              dryRun: options.dryRun,
              rows: rows.length,
              sources: sourceSummaries,
              status: "ok",
            }),
          );
        } else {
          output.log(
            rows.length === 0
              ? "Nothing to sync."
              : `Dry run: ${rows.length} rows across ${sources.length} sources; nothing pushed.`,
          );
        }
      });
      return;
    }

    const device = { name: hostname(), platform: process.platform };
    let upserted = 0;
    for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
      const chunk = rows.slice(offset, offset + CHUNK_SIZE);
      const response = yield* client.usage
        .sync({ payload: { days: chunk, device } })
        .pipe(Effect.mapError((cause) => new SyncPushError({ cause })));
      upserted += response.upserted;
    }

    yield* Effect.sync(() => {
      if (options.json) {
        console.log(
          JSON.stringify({ rows: rows.length, sources: sourceSummaries, status: "ok", upserted }),
        );
      } else {
        const profileUrl = `${stored.wwwUrl}/${me.user.login}`;
        output.log(`Synced ${rows.length} rows -> ${profileUrl}`);
      }
    });
  });
}

export { syncCommand, syncEffect, SyncPushError, UnknownSourceError };
