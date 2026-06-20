import { QueryClient } from "@tanstack/react-query";
import { isRedirect, type AnyRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import {
  accountsQueryOptions,
  devicesQueryOptions,
  meQueryOptions,
  tokensQueryOptions,
} from "../lib/queries";
import {
  accountLabel,
  confirmDeviceDelete,
  deviceDeleteConfirmationMessage,
  deviceDeleteInvalidationKeys,
  fetchSettingsData,
  fetchSettingsSession,
  loadSettingsRoute,
} from "./settings";

const me = {
  user: {
    avatarUrl: null,
    id: "user_123",
    login: "pondorasti",
    name: null,
  },
};

const accounts = {
  accounts: [
    {
      avatarUrl: null,
      email: "alex@example.com",
      emailVerified: true,
      login: "alex",
      name: "Alex",
      provider: "github" as const,
      providerAccountId: "github_123",
    },
  ],
};

const devices = {
  devices: [
    {
      arch: "arm64",
      createdAt: "2026-06-18T00:00:00.000Z",
      id: "device_123",
      lastSyncAt: null,
      name: "Mac.localdomain",
      platform: "darwin",
      version: "0.5.4",
    },
  ],
};

const tokens = {
  tokens: [
    {
      createdAt: "2026-06-18T00:00:00.000Z",
      deviceId: "device_123",
      id: "token_123",
      lastUsedAt: null,
      name: "Mac.localdomain",
      revokedAt: null,
    },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("fetchSettingsSession", () => {
  it("returns null for an unauthenticated session", async () => {
    const fetcher = vi.fn(async () => jsonResponse(401, { message: "Sign in required." }));

    await expect(fetchSettingsSession(undefined, fetcher)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/me$/), {
      headers: undefined,
    });
  });

  it("forwards the session cookie and decodes the /me response", async () => {
    const fetcher = vi.fn(async () => jsonResponse(200, me));

    await expect(fetchSettingsSession("tmx_session=abc", fetcher)).resolves.toEqual(me);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/me$/), {
      headers: { cookie: "tmx_session=abc" },
    });
  });
});

describe("fetchSettingsData", () => {
  it("keeps secondary settings read failures from failing the authenticated route load", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/me")) {
        return jsonResponse(200, me);
      }
      if (url.endsWith("/me/devices")) {
        return jsonResponse(200, devices);
      }
      if (url.endsWith("/me/tokens")) {
        throw new Error("tokens unavailable");
      }

      return jsonResponse(500, { message: "accounts unavailable" });
    });

    await expect(fetchSettingsData("tmx_session=abc", fetcher)).resolves.toEqual({
      data: {
        devices,
        me,
      },
      status: "ok",
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/me\/accounts$/), {
      headers: { cookie: "tmx_session=abc" },
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/me\/devices$/), {
      headers: { cookie: "tmx_session=abc" },
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/me\/tokens$/), {
      headers: { cookie: "tmx_session=abc" },
    });
  });
});

describe("loadSettingsRoute", () => {
  it("redirects unauthenticated users to login with a settings redirect", async () => {
    const queryClient = new QueryClient();

    await expect(
      loadSettingsRoute(queryClient, async () => ({ status: "unauthenticated" })),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isRedirect(error)).toBe(true);

      const redirect = error as AnyRedirect;
      expect(redirect.options.to).toBe("/login");
      expect(redirect.options.search).toEqual({ redirect: "/settings" });

      return true;
    });
  });

  it("seeds the me query cache for authenticated users", async () => {
    const queryClient = new QueryClient();

    await loadSettingsRoute(queryClient, async () => ({ data: { me }, status: "ok" }));

    expect(queryClient.getQueryData(meQueryOptions.queryKey)).toEqual(me);
  });

  it("seeds successful settings secondary reads into the query cache", async () => {
    const queryClient = new QueryClient();

    await loadSettingsRoute(queryClient, async () => ({
      data: {
        accounts,
        devices,
        me,
        tokens,
      },
      status: "ok",
    }));

    expect(queryClient.getQueryData(meQueryOptions.queryKey)).toEqual(me);
    expect(queryClient.getQueryData(accountsQueryOptions.queryKey)).toEqual(accounts);
    expect(queryClient.getQueryData(devicesQueryOptions.queryKey)).toEqual(devices);
    expect(queryClient.getQueryData(tokensQueryOptions.queryKey)).toEqual(tokens);
  });

  it("completes for authenticated users when secondary settings data is absent", async () => {
    const queryClient = new QueryClient();

    await expect(
      loadSettingsRoute(queryClient, async () => ({
        data: {
          devices,
          me,
        },
        status: "ok",
      })),
    ).resolves.toBeUndefined();

    expect(queryClient.getQueryData(meQueryOptions.queryKey)).toEqual(me);
    expect(queryClient.getQueryData(devicesQueryOptions.queryKey)).toEqual(devices);
    expect(queryClient.getQueryData(accountsQueryOptions.queryKey)).toBeUndefined();
    expect(queryClient.getQueryData(tokensQueryOptions.queryKey)).toBeUndefined();
  });
});

describe("device deletion helpers", () => {
  it("asks for destructive confirmation with the device name", () => {
    const confirm = vi.fn(() => true);

    expect(confirmDeviceDelete({ name: "Mac.localdomain" }, confirm)).toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      "Delete synced usage for Mac.localdomain? This removes the device from your profile and revokes its CLI tokens.",
    );
  });

  it("uses the expected cache invalidation keys after delete", () => {
    expect(deviceDeleteInvalidationKeys("pondorasti")).toEqual([
      ["me", "devices"],
      ["me", "tokens"],
      ["profile", "pondorasti"],
    ]);
  });

  it("keeps confirmation copy explicit about token revocation", () => {
    expect(deviceDeleteConfirmationMessage("tuftlords-MBP.localdomain")).toContain(
      "revokes its CLI tokens",
    );
  });
});

describe("accountLabel", () => {
  it("prefers email, then provider login, then provider name", () => {
    expect(
      accountLabel({
        avatarUrl: null,
        email: "alex@example.com",
        emailVerified: true,
        login: "alex",
        name: "Alex",
        provider: "google",
        providerAccountId: "google_123",
      }),
    ).toBe("alex@example.com");

    expect(
      accountLabel({
        avatarUrl: null,
        email: null,
        emailVerified: false,
        login: "pondorasti",
        name: "Alex",
        provider: "github",
        providerAccountId: "github_123",
      }),
    ).toBe("pondorasti");
  });
});
