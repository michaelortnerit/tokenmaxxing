import * as Effect from "effect/Effect";

/**
 * Token primitives for auth: opaque bearer tokens (random, hashed at rest).
 * Pure WebCrypto, Effect at the definition site — callers never wrap.
 */

const CLI_TOKEN_PREFIX = "tmx_";

/** 32 random bytes, base64url — the raw session token. */
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return toBase64Url(bytes);
}

/** Raw CLI token, recognizable by prefix so CliAuth can reject early. */
function generateCliToken(): string {
  return `${CLI_TOKEN_PREFIX}${generateToken()}`;
}

/** Hex sha-256; session rows store this, never the raw token. */
function sha256Hex(value: string): Effect.Effect<string> {
  return Effect.promise(async () => {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));

    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  });
}

/** cli_tokens.tokenHash format: a labeled sha-256 of the raw `tmx_` token. */
function hashCliToken(token: string): Effect.Effect<string> {
  return sha256Hex(token).pipe(Effect.map((hex) => `sha256:${hex}`));
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export { CLI_TOKEN_PREFIX, generateCliToken, generateToken, hashCliToken, sha256Hex };
