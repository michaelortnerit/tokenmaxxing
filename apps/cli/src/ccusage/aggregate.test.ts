import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { aggregateDays, summarize } from "./aggregate";
import { decodeDailyReport } from "./schema";

/** Mirrors the verified `ccusage claude daily --json --breakdown` v20 shape. */
const claudeFixture = {
  daily: [
    {
      date: "2026-06-10",
      inputTokens: 355_038,
      outputTokens: 1_438_433,
      cacheCreationTokens: 6_058_989,
      cacheReadTokens: 652_827_808,
      totalTokens: 660_680_268,
      totalCost: 851.14,
      modelsUsed: ["claude-fable-5", "claude-haiku-4-5-20251001"],
      modelBreakdowns: [
        {
          modelName: "claude-fable-5",
          inputTokens: 355_038,
          outputTokens: 1_438_433,
          cacheCreationTokens: 6_058_989,
          cacheReadTokens: 652_827_808,
          cost: 841.29,
        },
        {
          modelName: "claude-haiku-4-5-20251001",
          inputTokens: 6_637,
          outputTokens: 327_616,
          cacheCreationTokens: 2_865_086,
          cacheReadTokens: 46_241_604,
          cost: 9.85,
        },
      ],
    },
    {
      date: "2026-06-11",
      inputTokens: 1_000,
      outputTokens: 2_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 3_000,
      totalCost: 1.25,
      modelBreakdowns: [
        {
          modelName: "claude-fable-5",
          inputTokens: 1_000,
          outputTokens: 2_000,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          cost: 1.25,
        },
      ],
    },
  ],
  totals: {
    inputTokens: 356_038,
    totalCost: 852.39,
  },
};

/** Sources without breakdowns or with sparse fields must still aggregate. */
const sparseFixture = {
  daily: [
    {
      date: "2026-06-09",
      totalTokens: 5_000,
      totalCost: 0.5,
    },
    {
      date: "2026-06-09",
      inputTokens: 100,
      modelBreakdowns: [{ modelName: "gpt-5.5", inputTokens: 100, outputTokens: 50 }],
    },
  ],
};

describe("decodeDailyReport", () => {
  it("parses the verified v20 focused-command shape", async () => {
    const report = await Effect.runPromise(decodeDailyReport(claudeFixture));
    expect(report.daily).toHaveLength(2);
    expect(report.daily[0]?.modelBreakdowns).toHaveLength(2);
  });

  it("tolerates sparse fields and unknown keys", async () => {
    const report = await Effect.runPromise(decodeDailyReport(sparseFixture));
    expect(report.daily).toHaveLength(2);
    expect(report.daily[0]?.modelBreakdowns).toBeUndefined();
  });

  it("rejects output with no daily array", async () => {
    const exit = await Effect.runPromiseExit(decodeDailyReport({ data: [] }));
    expect(exit._tag).toBe("Failure");
  });
});

describe("aggregateDays", () => {
  it("explodes breakdowns into one row per (date, model) tagged with the source", async () => {
    const report = await Effect.runPromise(decodeDailyReport(claudeFixture));
    const rows = aggregateDays("claude", report.daily);

    expect(rows).toHaveLength(3);
    const fable = rows.find((row) => row.date === "2026-06-10" && row.model === "claude-fable-5");
    expect(fable).toMatchObject({
      cacheReadTokens: 652_827_808,
      costUsd: 841.29,
      source: "claude",
      // Per-model totalTokens is reconstructed from the four counters.
      totalTokens: 355_038 + 1_438_433 + 6_058_989 + 652_827_808,
    });
  });

  it("falls back to an unknown-model row when a day has no breakdowns, then merges duplicates", async () => {
    const report = await Effect.runPromise(decodeDailyReport(sparseFixture));
    const rows = aggregateDays("codex", report.daily);

    expect(rows.map((row) => row.model).sort()).toEqual(["gpt-5.5", "unknown"]);
    const unknown = rows.find((row) => row.model === "unknown");
    expect(unknown).toMatchObject({ costUsd: 0.5, date: "2026-06-09", totalTokens: 5_000 });
  });

  it("sums duplicate (date, model) pairs", () => {
    const rows = aggregateDays("claude", [
      {
        date: "2026-06-10",
        modelBreakdowns: [
          { modelName: "claude-fable-5", inputTokens: 10, cost: 1 },
          { modelName: "claude-fable-5", inputTokens: 5, cost: 0.5 },
        ],
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ costUsd: 1.5, inputTokens: 15 });
  });
});

describe("summarize", () => {
  it("counts distinct days and models and sums spend", async () => {
    const report = await Effect.runPromise(decodeDailyReport(claudeFixture));
    const summary = summarize(aggregateDays("claude", report.daily));

    expect(summary).toEqual({
      days: 2,
      models: 2,
      rows: 3,
      spendUsd: 841.29 + 9.85 + 1.25,
    });
  });
});
