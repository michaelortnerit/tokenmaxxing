import { Context, Effect, Layer } from "effect";

class TerminalService extends Context.Service<
  TerminalService,
  {
    readonly canOpenExternalBrowser: Effect.Effect<boolean>;
    readonly isInteractive: Effect.Effect<boolean>;
  }
>()("TerminalService") {}

function isSet(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

function canOpenExternalBrowser({
  env = process.env,
  isInteractive = Boolean(process.stdin.isTTY && process.stderr.isTTY),
  platform = process.platform,
}: {
  env?: Record<string, string | undefined>;
  isInteractive?: boolean;
  platform?: NodeJS.Platform;
} = {}): boolean {
  if (!isInteractive || isSet(env["CI"])) {
    return false;
  }

  if (isSet(env["SSH_CONNECTION"]) || isSet(env["SSH_CLIENT"]) || isSet(env["SSH_TTY"])) {
    return false;
  }

  if (platform === "linux") {
    return isSet(env["DISPLAY"]) || isSet(env["WAYLAND_DISPLAY"]);
  }

  return platform === "darwin" || platform === "win32";
}

const TerminalLive = Layer.succeed(TerminalService)({
  canOpenExternalBrowser: Effect.sync(() => canOpenExternalBrowser()),
  isInteractive: Effect.sync(() => Boolean(process.stdin.isTTY && process.stderr.isTTY)),
});

export { canOpenExternalBrowser, TerminalLive, TerminalService };
