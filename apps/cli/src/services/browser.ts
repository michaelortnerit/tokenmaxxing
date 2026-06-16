import { spawn } from "node:child_process";

import { Context, Data, Effect, Layer } from "effect";

class BrowserOpenError extends Data.TaggedError("BrowserOpenError")<{
  readonly cause: unknown;
}> {}

class BrowserService extends Context.Service<
  BrowserService,
  {
    readonly open: (url: string) => Effect.Effect<void, BrowserOpenError>;
  }
>()("BrowserService") {}

const BrowserLive = Layer.succeed(BrowserService)({
  open: (url) =>
    Effect.tryPromise({
      try: () => openUrl(url),
      catch: (cause) => new BrowserOpenError({ cause }),
    }),
});

async function openUrl(url: string): Promise<void> {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      child.off("error", onError);
      child.off("spawn", onSpawn);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onSpawn = () => {
      cleanup();
      child.unref();
      resolve();
    };

    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
}

export { BrowserLive, BrowserOpenError, BrowserService };
