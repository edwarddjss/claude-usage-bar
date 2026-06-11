import { resolveBarDisplay } from "./barDisplay";
import type {
  BridgeState,
  PrimaryMetric,
  RenderOptions,
  UsageSnapshot,
  UsageSource,
} from "./types";
import {
  formatTimeRemaining,
  isStale,
  STALE_THRESHOLD_MS,
} from "./time";

export type { PrimaryMetric, RenderOptions } from "./types";

const METRIC_LABELS: Record<PrimaryMetric, string> = {
  fiveHour: "5h",
  sevenDay: "7d",
  context: "ctx",
};

const SOURCE_LABELS: Record<UsageSource, string> = {
  claude: "Claude",
  codex: "Codex",
};

export function clampPercentage(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

export function renderProgressBar(
  percentage: number | null | undefined,
  width = 8,
  filled = "█",
  empty = "░"
): string {
  const clamped = clampPercentage(percentage);
  if (clamped == null) {
    return "?".repeat(width);
  }

  const filledCount = Math.round((clamped / 100) * width);
  return filled.repeat(filledCount) + empty.repeat(Math.max(0, width - filledCount));
}

export function formatPercentage(percentage: number | null | undefined): string {
  const clamped = clampPercentage(percentage);
  if (clamped == null) {
    return "?%";
  }

  return `${Math.round(clamped)}%`;
}

export function formatRemainingPercentage(percentage: number | null | undefined): string {
  const clamped = clampPercentage(percentage);
  if (clamped == null) {
    return "?%";
  }

  return `${Math.floor(clamped)}%`;
}

export function getPrimaryPercentage(
  state: BridgeState | null,
  metric: PrimaryMetric
): number | null {
  if (!state) {
    return null;
  }

  switch (metric) {
    case "fiveHour":
      return clampPercentage(state.fiveHour?.usedPercentage);
    case "sevenDay":
      return clampPercentage(state.sevenDay?.usedPercentage);
    case "context":
      return clampPercentage(state.context?.usedPercentage);
    default:
      return null;
  }
}

export function getPrimaryRemainingPercentage(
  state: BridgeState | null,
  metric: PrimaryMetric
): number | null {
  if (!state) {
    return null;
  }

  if (metric === "context") {
    return (
      clampPercentage(state.context?.remainingPercentage) ??
      invertPercentage(state.context?.usedPercentage)
    );
  }

  return invertPercentage(getPrimaryPercentage(state, metric));
}

function invertPercentage(percentage: number | null | undefined): number | null {
  const clamped = clampPercentage(percentage);
  return clamped == null ? null : 100 - clamped;
}

export function renderStatusBarText(
  snapshot: UsageSnapshot,
  options: RenderOptions
): string {
  const nowMs = options.nowMs ?? Date.now();
  const display = resolveBarDisplay(
    snapshot,
    options.displayMode ?? "auto",
    options.activity,
    nowMs,
    STALE_THRESHOLD_MS
  );

  if (display.kind === "empty") {
    if (options.bridgeConfigured) {
      return withIcon("$(clock) Start Claude or Codex", options.showIcon);
    }

    return withIcon("$(circle-slash) No usage data", options.showIcon);
  }

  if (display.kind === "dual") {
    return renderDualStatusBar(snapshot, options, nowMs);
  }

  const state = display.source === "claude" ? snapshot.claude : snapshot.codex;
  return renderSingleStatusBar(state, display.source, options, nowMs, display.stale);
}

function renderSingleStatusBar(
  state: BridgeState | null,
  source: UsageSource,
  options: RenderOptions,
  nowMs: number,
  stale: boolean
): string {
  if (!state) {
    return withIcon(`$(circle-slash) ${SOURCE_LABELS[source]} —`, options.showIcon);
  }

  const percentage = getPrimaryRemainingPercentage(state, options.primaryMetric);
  const bar = renderProgressBar(percentage, options.barWidth);
  const label = METRIC_LABELS[options.primaryMetric];
  const staleMark = stale || isStale(state.updatedAt, nowMs) ? " ·" : "";
  const value = `${bar} ${formatRemainingPercentage(percentage)} left`;
  const text = `${SOURCE_LABELS[source]} ${label} ${value}${staleMark}`;

  const icon = stale || isStale(state.updatedAt, nowMs) ? "$(warning)" : "$(pulse)";
  return withIcon(`${icon} ${text}`, options.showIcon);
}

function renderDualStatusBar(
  snapshot: UsageSnapshot,
  options: RenderOptions,
  nowMs: number
): string {
  const compactWidth = Math.max(4, Math.floor(options.barWidth / 2));
  const claudeSegment = renderCompactSegment(
    snapshot.claude,
    "claude",
    options.primaryMetric,
    compactWidth,
    nowMs
  );
  const codexSegment = renderCompactSegment(
    snapshot.codex,
    "codex",
    options.primaryMetric,
    compactWidth,
    nowMs
  );
  return withIcon(`$(pulse) ${claudeSegment} │ ${codexSegment}`, options.showIcon);
}

function renderCompactSegment(
  state: BridgeState | null,
  source: UsageSource,
  metric: PrimaryMetric,
  width: number,
  nowMs: number
): string {
  const percentage = getPrimaryRemainingPercentage(state, metric);
  const bar = renderProgressBar(percentage, width);
  const staleSuffix = state && isStale(state.updatedAt, nowMs) ? "·" : "";
  const value = `${bar} ${formatRemainingPercentage(percentage)} left`;
  return `${SOURCE_LABELS[source]}${staleSuffix} ${value}`;
}

function withIcon(text: string, showIcon: boolean): string {
  if (!showIcon) {
    return text.replace(/^\$\([^)]+\)\s*/, "");
  }

  return text;
}

export function renderTooltip(
  snapshot: UsageSnapshot,
  options: RenderOptions
): string {
  const nowMs = options.nowMs ?? Date.now();
  const lines: string[] = [];

  if (!snapshot.claude && !snapshot.codex) {
    if (options.bridgeConfigured) {
      return "Ready. Use Claude Code or Codex to see usage.";
    }

    return "No usage data yet.";
  }

  if (snapshot.claude) {
    lines.push("[Claude]", ...renderSourceTooltipLines(snapshot.claude, nowMs));
  }

  if (snapshot.codex) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("[Codex]", ...renderSourceTooltipLines(snapshot.codex, nowMs));
  }

  return lines.join("\n");
}

function renderSourceTooltipLines(state: BridgeState, nowMs: number): string[] {
  const lines = [
    `5h ${formatMetricLine(state.fiveHour?.usedPercentage, state.fiveHour?.resetsAt, nowMs)}`,
    `7d ${formatMetricLine(state.sevenDay?.usedPercentage, state.sevenDay?.resetsAt, nowMs)}`,
    `ctx ${formatUsedLeft(state.context?.usedPercentage, state.context?.remainingPercentage)}`,
    `model ${state.model ?? "—"}`,
  ];

  if (state.cost?.sessionUsd != null) {
    lines.splice(3, 0, `cost ${formatCost(state.cost.sessionUsd)}`);
  }

  const creditsLine = formatCreditsLine(state);
  if (creditsLine) {
    lines.splice(state.cost?.sessionUsd != null ? 4 : 3, 0, creditsLine);
  }

  if (isStale(state.updatedAt, nowMs)) {
    lines.push("stale");
  }

  return lines;
}

function formatMetricLine(
  percentage: number | null | undefined,
  resetsAt: number | null | undefined,
  nowMs: number
): string {
  const used = formatPercentage(percentage);
  const left = formatRemainingPercentage(invertPercentage(percentage));
  const remaining = formatTimeRemaining(resetsAt, nowMs);
  if (resetsAt != null && resetsAt <= nowMs) {
    return `${used} used · reset passed`;
  }

  return `${used} used · ${left} left · resets in ${remaining}`;
}

function formatUsedLeft(
  usedPercentage: number | null | undefined,
  remainingPercentage: number | null | undefined
): string {
  const used = formatPercentage(usedPercentage);
  const left = formatRemainingPercentage(
    clampPercentage(remainingPercentage) ?? invertPercentage(usedPercentage)
  );
  return `${used} used · ${left} left`;
}

function formatCreditsLine(state: BridgeState): string | null {
  if (state.credits?.unlimited) {
    return "credits unlimited";
  }

  if (state.credits?.hasCredits) {
    const balance =
      state.credits.balance != null && Number.isFinite(state.credits.balance)
        ? ` · balance ${state.credits.balance}`
        : "";
    return `credits available${balance}`;
  }

  if (state.credits?.rateLimitReachedType) {
    return `limit ${state.credits.rateLimitReachedType}`;
  }

  return null;
}

function formatCost(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `$${value.toFixed(2)}`;
}
