import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  AdminUsersResponse,
  CliLoginStartInput,
  IngestUsageInput,
  ProfileDailyResponse,
  SyncUsageInput,
  UsageCheckInInput,
} from "./schemas";

describe("device telemetry inputs", () => {
  it("keeps old clients without version or arch compatible", async () => {
    await expect(
      Schema.decodeUnknownPromise(CliLoginStartInput)({
        deviceId: "device_123",
        deviceName: "Mac.localdomain",
        devicePlatform: "darwin",
      }),
    ).resolves.toEqual({
      deviceId: "device_123",
      deviceName: "Mac.localdomain",
      devicePlatform: "darwin",
    });

    await expect(
      Schema.decodeUnknownPromise(IngestUsageInput)({
        device: { name: "Mac.localdomain", platform: "darwin" },
        reports: [],
      }),
    ).resolves.toEqual({
      device: { name: "Mac.localdomain", platform: "darwin" },
      reports: [],
    });

    await expect(
      Schema.decodeUnknownPromise(SyncUsageInput)({
        days: [],
        device: { name: "Mac.localdomain", platform: "darwin" },
      }),
    ).resolves.toEqual({
      days: [],
      device: { name: "Mac.localdomain", platform: "darwin" },
    });

    await expect(
      Schema.decodeUnknownPromise(UsageCheckInInput)({
        device: { name: "Mac.localdomain", platform: "darwin" },
        service: {
          repairAttemptedAt: "2026-06-21T18:00:00.000Z",
          repairReason: "scheduler-inactive",
          repairStatus: "scheduled",
          status: "success",
        },
      }),
    ).resolves.toEqual({
      device: { name: "Mac.localdomain", platform: "darwin" },
      service: {
        repairAttemptedAt: "2026-06-21T18:00:00.000Z",
        repairReason: "scheduler-inactive",
        repairStatus: "scheduled",
        status: "success",
      },
    });
  });
});

describe("profile daily responses", () => {
  it("carries chart range metadata separately from sparse usage rows", async () => {
    await expect(
      Schema.decodeUnknownPromise(ProfileDailyResponse)({
        days: [
          {
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            costUsd: 12.34,
            date: "2026-06-19",
            inputTokens: 100,
            key: "claude-opus-4",
            outputTokens: 200,
            totalTokens: 300,
          },
        ],
        range: {
          first: "2026-01-01",
          last: "2026-06-21",
        },
      }),
    ).resolves.toEqual({
      days: [
        {
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          costUsd: 12.34,
          date: "2026-06-19",
          inputTokens: 100,
          key: "claude-opus-4",
          outputTokens: 200,
          totalTokens: 300,
        },
      ],
      range: {
        first: "2026-01-01",
        last: "2026-06-21",
      },
    });
  });
});

describe("admin fleet responses", () => {
  it("carries device owner, service, token, and usage telemetry", async () => {
    const response = {
      devices: [
        {
          activeDays: 7,
          activeTokenCount: 1,
          device: {
            arch: "arm64",
            createdAt: "2026-06-19T18:00:00.000Z",
            id: "device_123",
            lastCheckInAt: "2026-06-19T19:31:00.000Z",
            lastSyncAt: "2026-06-19T19:30:00.000Z",
            name: "Mac.localdomain",
            platform: "darwin",
            serviceBackend: "launchd",
            serviceError: null,
            serviceReloadRequired: false,
            serviceRepairAttemptedAt: "2026-06-19T19:00:00.000Z",
            serviceRepairCompletedAt: null,
            serviceRepairError: null,
            serviceRepairReason: "auto-updated",
            serviceRepairStatus: "scheduled",
            serviceSchedulerActive: true,
            serviceStatus: "success",
            serviceTemplateVersion: 2,
            version: "0.5.4",
          },
          isOutdated: false,
          lastTokenUsedAt: "2026-06-19T19:31:00.000Z",
          lastUsageDate: "2026-06-19",
          latestCheckInAt: "2026-06-19T19:31:00.000Z",
          revokedTokenCount: 0,
          sources: ["codex"],
          status: "healthy",
          tokenCount: 1,
          totalSpendUsd: 12.34,
          totalTokens: 123_456,
          user: {
            avatarUrl: null,
            id: "user_123",
            login: "pondorasti",
            name: "Alexandru",
          },
        },
      ],
      generatedAt: "2026-06-19T20:00:00.000Z",
      latestCliPublishedAt: "2026-06-19T19:00:00.000Z",
      latestCliVersion: "0.5.4",
      rolloutGraceHours: 2,
      staleThresholdHours: 6,
      summary: {
        healthy: 1,
        outdated: 0,
        repairNeeded: 0,
        stale: 0,
        totalDevices: 1,
        totalUsers: 1,
        unknown: 0,
      },
      users: [],
    };

    await expect(Schema.decodeUnknownPromise(AdminUsersResponse)(response)).resolves.toEqual(
      response,
    );
  });
});
