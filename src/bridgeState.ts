import * as fs from "fs";
import { LEGACY_STATE_PATH } from "./constants";
import { expandHome } from "./paths";
import type { BridgeState, UsageSnapshot } from "./types";

export {
  DEFAULT_BRIDGE_DIR,
  DEFAULT_CLAUDE_STATE_PATH,
  DEFAULT_CODEX_STATE_PATH,
  LEGACY_STATE_PATH,
} from "./constants";

export type { BridgeState, UsageMetric, UsageSnapshot, UsageSource } from "./types";

export function readBridgeState(filePath: string): BridgeState | null {
  const resolved = expandHome(filePath);

  try {
    if (!fs.existsSync(resolved)) {
      return null;
    }

    const raw = fs.readFileSync(resolved, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeBridgeState(parsed);
  } catch {
    return null;
  }
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
