import type { ResolvedActivity } from "./activity";
import type { BridgeState, PrimaryMetric, RenderOptions, UsageSnapshot, UsageSource } from "./types";
import { formatLastUpdated, formatResetTime, formatTimeRemaining, isStale } from "./time";

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

const SOURCE_SHORT_LABELS: Record<UsageSource, string> = {
  claude: "C",
  codex: "X",
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

export function getPrimaryPercentage(state: BridgeState | null, metric: PrimaryMetric): number | null {
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

export function renderStatusBarText(
  snapshot: UsageSnapshot,
  options: RenderOptions
): string {
  const nowMs = options.nowMs ?? Date.now();
  const activity = options.activity;

  if (!activity || activity.mode === "none") {
    return withIcon("$(circle-slash) AI usage unavailable", options.showIcon);
  }

  if (activity.mode === "dual") {
    return renderDualStatusBar(snapshot, options, nowMs);
  }

  const source = activity.primarySource ?? (activity.showClaude ? "claude" : "codex");
  const state = source === "claude" ? snapshot.claude : snapshot.codex;
  return renderSingleStatusBar(state, source, options, nowMs, activity);
}

function renderSingleStatusBar(
  state: BridgeState | null,
  source: UsageSource,
  options: RenderOptions,
  nowMs: number,
  activity: ResolvedActivity
): string {
  if (!state) {
    return withIcon(`$(circle-slash) ${SOURCE_LABELS[source]} usage unavailable`, options.showIcon);
  }

  const live = source === "claude" ? activity.claudeLive || activity.claudeConnected : activity.codexLive;
  if (!live && isStale(state.updatedAt, nowMs)) {
    return withIcon(`$(warning) ${SOURCE_LABELS[source]} usage stale`, options.showIcon);
  }

  const percentage = getPrimaryPercentage(state, options.primaryMetric);
  const bar = renderProgressBar(percentage, options.barWidth);
  const label = METRIC_LABELS[options.primaryMetric];
  const text = `${SOURCE_LABELS[source]} ${label} ${bar} ${formatPercentage(percentage)}`;

  return withIcon(`$(pulse) ${text}`, options.showIcon);
}

function renderDualStatusBar(
  snapshot: UsageSnapshot,
  options: RenderOptions,
  nowMs: number
): string {
  const compactWidth = Math.max(4, Math.floor(options.barWidth / 2));
  const claudeSegment = renderCompactSegment(snapshot.claude, "claude", options.primaryMetric, compactWidth, nowMs);
  const codexSegment = renderCompactSegment(snapshot.codex, "codex", options.primaryMetric, compactWidth, nowMs);
  return withIcon(`$(pulse) ${claudeSegment} │ ${codexSegment}`, options.showIcon);
}

function renderCompactSegment(
  state: BridgeState | null,
  source: UsageSource,
  metric: PrimaryMetric,
  width: number,
  nowMs: number
): string {
  const percentage = getPrimaryPercentage(state, metric);
  const bar = renderProgressBar(percentage, width);
  const staleSuffix = state && isStale(state.updatedAt, nowMs) ? "!" : "";
  return `${SOURCE_SHORT_LABELS[source]}${staleSuffix} ${bar} ${formatPercentage(percentage)}`;
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
  const activity = options.activity;
  const lines: string[] = [];

  if (!snapshot.claude && !snapshot.codex) {
    return "No bridge data available.\nConfigure Claude Code and/or Codex bridges.";
  }

  if (activity) {
    lines.push(
      `Activity: ${describeActivity(activity)}`,
      `Focused terminal: ${activity.focusedSource ?? "none"}`
    );
  }

  if (snapshot.claude && (!activity || activity.showClaude)) {
    lines.push("", `[Claude]`, ...renderSourceTooltipLines(snapshot.claude, nowMs));
  }

  if (snapshot.codex && (!activity || activity.showCodex)) {
    lines.push("", `[Codex]`, ...renderSourceTooltipLines(snapshot.codex, nowMs));
  }

  return lines.join("\n");
}

function describeActivity(activity: ResolvedActivity): string {
  if (activity.mode === "dual") {
    return "Claude + Codex active";
  }

  if (activity.primarySource) {
    return `${SOURCE_LABELS[activity.primarySource]} active`;
  }

  return "idle";
}

function renderSourceTooltipLines(state: BridgeState, nowMs: number): string[] {
  const lines = [
    `5-hour usage: ${formatMetricLine(state.fiveHour?.usedPercentage, state.fiveHour?.resetsAt, nowMs)}`,
    `Weekly usage: ${formatMetricLine(state.sevenDay?.usedPercentage, state.sevenDay?.resetsAt, nowMs)}`,
    `Context window: ${formatPercentage(state.context?.usedPercentage)}`,
    `Session cost: ${formatCost(state.cost?.sessionUsd)}`,
    `Model: ${state.model ?? "unknown"}`,
    `Last updated: ${formatLastUpdated(state.updatedAt, nowMs)}`,
  ];

  if (state.cwd) {
    lines.push(`CWD: ${state.cwd}`);
  }

  if (isStale(state.updatedAt, nowMs)) {
    lines.push("Status: stale (no update for >2 minutes)");
  }

  return lines;
}

function formatMetricLine(
  percentage: number | null | undefined,
  resetsAt: number | null | undefined,
  nowMs: number
): string {
  const pct = formatPercentage(percentage);
  const reset = formatResetTime(resetsAt);
  const remaining = formatTimeRemaining(resetsAt, nowMs);
  return `${pct} · resets ${reset} (${remaining} left)`;
}

function formatCost(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "unknown";
  }

  return `$${value.toFixed(2)}`;
}

export function renderBridgeStatusLine(percentage: number | null | undefined): string {
  return `Claude 5h ${formatPercentage(percentage)}`;
}
