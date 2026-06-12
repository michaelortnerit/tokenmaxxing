import { Schema } from "effect";

/**
 * The shape of `ccusage <source> daily --json --breakdown` (v20, focused
 * per-source commands — NOT the unified report, which buckets by `period`
 * and mixes agents). Deliberately lenient: only `date` is required, every
 * count defaults at the aggregation step, and unknown keys are ignored —
 * field presence varies across sources and ccusage versions.
 */

const CcusageModelBreakdown = Schema.Struct({
  cacheCreationTokens: Schema.optional(Schema.Number),
  cacheReadTokens: Schema.optional(Schema.Number),
  cost: Schema.optional(Schema.Number),
  inputTokens: Schema.optional(Schema.Number),
  modelName: Schema.String,
  outputTokens: Schema.optional(Schema.Number),
});

type CcusageModelBreakdown = typeof CcusageModelBreakdown.Type;

const CcusageDay = Schema.Struct({
  cacheCreationTokens: Schema.optional(Schema.Number),
  cacheReadTokens: Schema.optional(Schema.Number),
  date: Schema.String,
  inputTokens: Schema.optional(Schema.Number),
  modelBreakdowns: Schema.optional(Schema.Array(CcusageModelBreakdown)),
  outputTokens: Schema.optional(Schema.Number),
  totalCost: Schema.optional(Schema.Number),
  totalTokens: Schema.optional(Schema.Number),
});

type CcusageDay = typeof CcusageDay.Type;

const CcusageDailyReport = Schema.Struct({
  daily: Schema.Array(CcusageDay),
});

type CcusageDailyReport = typeof CcusageDailyReport.Type;

const decodeDailyReport = Schema.decodeUnknownEffect(CcusageDailyReport);

export { CcusageDailyReport, CcusageDay, CcusageModelBreakdown, decodeDailyReport };
