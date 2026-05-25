import { createId } from "./id";
import type { CliToolProfile, ImplementationSession, ModelProfile, ProviderUsageRecord, Workspace } from "./types";

export interface ParsedProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  modelName?: string;
  requestCount?: number;
  rawUsagePayload?: string;
  wasEstimated?: boolean;
}

export interface ProviderUsageAnalytics {
  totalSessions: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  averageDurationMs: number;
  averageTokensPerSession: number;
  perProvider: Array<{
    providerId: string;
    providerName: string;
    totalSessions: number;
    totalTokens: number;
    totalEstimatedCostUsd: number;
    averageDurationMs: number;
    averageTokensPerSession: number;
  }>;
  daily: Array<{
    date: string;
    sessions: number;
    tokens: number;
    estimatedCostUsd: number;
  }>;
  topCost: ProviderUsageRecord[];
  topTokens: ProviderUsageRecord[];
  topDuration: ProviderUsageRecord[];
}

const charsPerToken = 4;

const providerPricingPerMillion: Record<string, { input: number; output: number }> = {
  "claude-code": { input: 3, output: 15 },
  "codex-cli": { input: 1.25, output: 10 },
  "custom-cli": { input: 1, output: 4 }
};

export const estimateTokensFromText = (text: string): number => Math.max(0, Math.ceil(text.length / charsPerToken));

export const estimateProviderCost = (
  providerId: string,
  inputTokens: number,
  outputTokens: number
): number => {
  const pricing = providerPricingPerMillion[providerId] ?? providerPricingPerMillion["custom-cli"];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
};

export const parseProviderUsage = (
  providerId: string,
  stdout: string,
  stderr: string
): ParsedProviderUsage | null => {
  try {
    const text = [stdout, stderr].filter(Boolean).join("\n");
    return providerId === "claude-code" ? parseClaudeUsage(text) : providerId === "codex-cli" ? parseCodexUsage(text) : parseGenericUsage(text);
  } catch {
    return null;
  }
};

export const createProviderUsageRecord = (options: {
  workspaceId: string;
  cardId: string;
  sessionId: string;
  provider: CliToolProfile;
  prompt: string;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
  cliVersion?: string;
}): ProviderUsageRecord => {
  const providerId = options.provider.providerId || providerIdFromName(options.provider.provider);
  const parsed = parseProviderUsage(providerId, options.stdout, options.stderr);
  const estimatedInputTokens = estimateTokensFromText(options.prompt);
  const estimatedOutputTokens = estimateTokensFromText([options.stdout, options.stderr].filter(Boolean).join("\n"));
  const inputTokens = parsed?.inputTokens ?? Math.max(1, estimatedInputTokens);
  const outputTokens = parsed?.outputTokens ?? Math.max(0, estimatedOutputTokens);
  const totalTokens = parsed?.totalTokens ?? inputTokens + outputTokens;
  const wasEstimated = parsed?.wasEstimated ?? !(parsed?.inputTokens || parsed?.outputTokens || parsed?.totalTokens);
  const estimatedCostUsd = parsed?.estimatedCostUsd ?? estimateProviderCost(providerId, inputTokens, outputTokens);
  const executionDurationMs = Math.max(
    0,
    new Date(options.completedAt).getTime() - new Date(options.startedAt).getTime()
  );

  return {
    id: createId("usage"),
    providerId,
    providerName: options.provider.displayName || options.provider.name,
    modelName: parsed?.modelName,
    sessionId: options.sessionId,
    cardId: options.cardId,
    workspaceId: options.workspaceId,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedInputTokens: wasEstimated ? estimatedInputTokens : undefined,
    estimatedOutputTokens: wasEstimated ? estimatedOutputTokens : undefined,
    estimatedCostUsd,
    executionDurationMs,
    requestCount: parsed?.requestCount ?? 1,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
    wasEstimated,
    rawUsagePayload: parsed?.rawUsagePayload,
    cliVersion: options.cliVersion
  };
};

export const createModelProviderUsageRecord = (options: {
  workspaceId: string;
  cardId: string;
  sessionId: string;
  model: ModelProfile;
  prompt: string;
  output: string;
  startedAt: string;
  completedAt: string;
  rawUsagePayload?: string;
}): ProviderUsageRecord => {
  const providerId = providerIdFromName(options.model.provider);
  const inputTokens = Math.max(1, estimateTokensFromText(options.prompt));
  const outputTokens = Math.max(0, estimateTokensFromText(options.output));
  const estimatedCostUsd = estimateProviderCost(providerId, inputTokens, outputTokens);
  return {
    id: createId("usage"),
    providerId,
    providerName: options.model.provider,
    modelName: options.model.modelName,
    sessionId: options.sessionId,
    cardId: options.cardId,
    workspaceId: options.workspaceId,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCostUsd,
    executionDurationMs: Math.max(0, new Date(options.completedAt).getTime() - new Date(options.startedAt).getTime()),
    requestCount: 1,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
    wasEstimated: true,
    rawUsagePayload: options.rawUsagePayload
  };
};

export const aggregateUsageRecords = (records: ProviderUsageRecord[]): ProviderUsageAnalytics => {
  const completedRecords = records.filter((record) => record.completedAt);
  const totalSessions = completedRecords.length;
  const totalTokens = sum(completedRecords.map((record) => record.totalTokens));
  const totalEstimatedCostUsd = sum(completedRecords.map((record) => record.estimatedCostUsd ?? 0));
  const averageDurationMs = average(completedRecords.map((record) => record.executionDurationMs));
  const averageTokensPerSession = totalSessions > 0 ? totalTokens / totalSessions : 0;

  const providers = new Map<string, ProviderUsageRecord[]>();
  for (const record of completedRecords) {
    const key = record.providerId || record.providerName;
    providers.set(key, [...(providers.get(key) ?? []), record]);
  }

  const days = new Map<string, ProviderUsageRecord[]>();
  for (const record of completedRecords) {
    const key = record.completedAt.slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), record]);
  }

  return {
    totalSessions,
    totalTokens,
    totalEstimatedCostUsd,
    averageDurationMs,
    averageTokensPerSession,
    perProvider: Array.from(providers.entries()).map(([providerId, providerRecords]) => ({
      providerId,
      providerName: providerRecords[0]?.providerName ?? providerId,
      totalSessions: providerRecords.length,
      totalTokens: sum(providerRecords.map((record) => record.totalTokens)),
      totalEstimatedCostUsd: sum(providerRecords.map((record) => record.estimatedCostUsd ?? 0)),
      averageDurationMs: average(providerRecords.map((record) => record.executionDurationMs)),
      averageTokensPerSession: average(providerRecords.map((record) => record.totalTokens))
    })),
    daily: Array.from(days.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, dayRecords]) => ({
        date,
        sessions: dayRecords.length,
        tokens: sum(dayRecords.map((record) => record.totalTokens)),
        estimatedCostUsd: sum(dayRecords.map((record) => record.estimatedCostUsd ?? 0))
      })),
    topCost: [...completedRecords].sort((a, b) => (b.estimatedCostUsd ?? 0) - (a.estimatedCostUsd ?? 0)).slice(0, 5),
    topTokens: [...completedRecords].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 5),
    topDuration: [...completedRecords].sort((a, b) => b.executionDurationMs - a.executionDurationMs).slice(0, 5)
  };
};

export const usageForProvider = (workspace: Workspace, profile: CliToolProfile): ProviderUsageAnalytics => {
  const providerId = profile.providerId || providerIdFromName(profile.provider);
  return aggregateUsageRecords(workspace.providerUsageRecords.filter((record) => record.providerId === providerId));
};

export const liveEstimatedUsageForSession = (session: ImplementationSession | undefined): {
  totalTokens: number;
  costUsd: number;
  wasEstimated: boolean;
} => {
  if (!session) {
    return { totalTokens: 0, costUsd: 0, wasEstimated: true };
  }
  return {
    totalTokens: session.tokenUsage.totalTokens,
    costUsd: session.tokenUsage.costUsd,
    wasEstimated: session.usageWasEstimated ?? true
  };
};

const parseClaudeUsage = (text: string): ParsedProviderUsage | null => {
  const json = extractUsageJson(text, ["usage", "tokenUsage", "tokens"]);
  if (json) {
    return normalizeUsageObject(json, text);
  }
  return parseUsageLines(text);
};

const parseCodexUsage = (text: string): ParsedProviderUsage | null => {
  const json = extractUsageJson(text, ["usage", "token_usage", "tokens"]);
  if (json) {
    return normalizeUsageObject(json, text);
  }
  return parseUsageLines(text);
};

const parseGenericUsage = (text: string): ParsedProviderUsage | null => parseUsageLines(text);

const extractUsageJson = (text: string, keys: string[]): unknown | null => {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      for (const key of keys) {
        if (parsed?.[key]) {
          return parsed[key];
        }
      }
      if (parsed?.input_tokens || parsed?.output_tokens || parsed?.total_tokens) {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
};

const normalizeUsageObject = (value: unknown, raw: string): ParsedProviderUsage | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const usage = value as Record<string, unknown>;
  const inputTokens = numeric(usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens ?? usage.promptTokens);
  const outputTokens = numeric(usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens ?? usage.completionTokens);
  const totalTokens = numeric(usage.total_tokens ?? usage.totalTokens);
  const estimatedCostUsd = numeric(usage.cost_usd ?? usage.costUsd ?? usage.estimated_cost_usd ?? usage.estimatedCostUsd);
  if (!inputTokens && !outputTokens && !totalTokens) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    modelName: typeof usage.model === "string" ? usage.model : undefined,
    requestCount: numeric(usage.requests ?? usage.request_count ?? usage.requestCount),
    rawUsagePayload: raw,
    wasEstimated: false
  };
};

const parseUsageLines = (text: string): ParsedProviderUsage | null => {
  const inputTokens = matchNumber(text, /(?:input|prompt)\s*tokens?\s*[:=]\s*([\d,.kKmM]+)/i);
  const outputTokens = matchNumber(text, /(?:output|completion|response)\s*tokens?\s*[:=]\s*([\d,.kKmM]+)/i);
  const totalTokens = matchNumber(text, /total\s*tokens?\s*[:=]\s*([\d,.kKmM]+)/i);
  const estimatedCostUsd = matchNumber(text, /(?:cost|estimated cost)\s*[:=]\s*\$?\s*([\d,.]+)/i);
  const modelName = text.match(/model\s*[:=]\s*([^\r\n]+)/i)?.[1]?.trim();
  if (!inputTokens && !outputTokens && !totalTokens && !estimatedCostUsd) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    modelName,
    rawUsagePayload: text,
    wasEstimated: false
  };
};

const matchNumber = (text: string, regex: RegExp): number | undefined => {
  const value = text.match(regex)?.[1];
  return value ? parseCompactNumber(value) : undefined;
};

const numeric = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" ? parseCompactNumber(value) : undefined;

const parseCompactNumber = (value: string): number | undefined => {
  const clean = value.replace(/,/g, "").trim();
  const multiplier = clean.toLowerCase().endsWith("m") ? 1_000_000 : clean.toLowerCase().endsWith("k") ? 1_000 : 1;
  const parsed = Number.parseFloat(clean.replace(/[kKmM]$/, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * multiplier) : undefined;
};

const providerIdFromName = (value: string): string => value.toLowerCase().replace(/\s+/g, "-");

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

const average = (values: number[]): number => (values.length > 0 ? sum(values) / values.length : 0);
