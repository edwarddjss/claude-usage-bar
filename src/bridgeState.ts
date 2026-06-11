import * as fs from "fs";
import { LEGACY_STATE_PATH } from "./constants";
import { expandHome } from "./paths";
import type { BridgeState, UsageSnapshot } from "./types";

export function readBridgeState(filePath: string): BridgeState | null {
  const resolved = expandHome(filePath);

  if (!fs.existsSync(resolved)) {
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = fs.readFileSync(resolved, "utf8").trim();
      if (!raw || raw === "{}") {
        return null;
      }

      const parsed = JSON.parse(raw) as unknown;
      return sanitizeBridgeState(parsed);
    } catch {
      if (attempt < 2) {
        continue;
      }
    }
  }

  return null;
}

export function readUsageSnapshot(
  claudeStatePath: string,
  codexStatePath: string,
  legacyStatePath = LEGACY_STATE_PATH
): UsageSnapshot {
  const claude = readBridgeState(claudeStatePath) ?? readBridgeState(legacyStatePath);
  const codex = readBridgeState(codexStatePath);

  return {
    claude: claude ? { ...claude, source: "claude" } : null,
    codex: codex ? { ...codex, source: "codex" } : null,
  };
}

export function sanitizeBridgeState(input: unknown): BridgeState | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const data = input as Record<string, unknown>;
  const source = data.source === "claude" || data.source === "codex" ? data.source : undefined;

  return {
    source,
    updatedAt: toNumber(data.updatedAt) ?? undefined,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
    model: typeof data.model === "string" ? data.model : undefined,
    cwd: typeof data.cwd === "string" ? data.cwd : undefined,
    pid: toNumber(data.pid) ?? undefined,
    fiveHour: sanitizeMetric(data.fiveHour),
    sevenDay: sanitizeMetric(data.sevenDay),
    context: sanitizeContext(data.context),
    cost: sanitizeCost(data.cost),
    credits: sanitizeCredits(data.credits),
  };
}

function sanitizeMetric(value: unknown): BridgeState["fiveHour"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const metric = value as Record<string, unknown>;
  return {
    usedPercentage: toNumber(metric.usedPercentage),
    resetsAt: normalizeResetsAt(metric.resetsAt),
  };
}

function sanitizeContext(value: unknown): BridgeState["context"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const context = value as Record<string, unknown>;
  return {
    usedPercentage: toNumber(context.usedPercentage),
    remainingPercentage: toNumber(context.remainingPercentage),
    inputTokens: toNumber(context.inputTokens),
    outputTokens: toNumber(context.outputTokens),
  };
}

function sanitizeCost(value: unknown): BridgeState["cost"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const cost = value as Record<string, unknown>;
  return {
    sessionUsd: toNumber(cost.sessionUsd),
  };
}

function sanitizeCredits(value: unknown): BridgeState["credits"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const credits = value as Record<string, unknown>;
  return {
    hasCredits:
      typeof credits.hasCredits === "boolean" ? credits.hasCredits : undefined,
    unlimited:
      typeof credits.unlimited === "boolean" ? credits.unlimited : undefined,
    balance: toNumber(credits.balance),
    planType: typeof credits.planType === "string" ? credits.planType : undefined,
    rateLimitReachedType:
      typeof credits.rateLimitReachedType === "string"
        ? credits.rateLimitReachedType
        : undefined,
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeResetsAt(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric == null) {
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}
