import type { DisplayMode, UsageSnapshot, UsageSource } from "./types";
import type { ResolvedActivity } from "./activity";

export type BarDisplay =
  | { kind: "empty" }
  | { kind: "dual" }
  | { kind: "single"; source: UsageSource; stale: boolean };

export function resolveBarDisplay(
  snapshot: UsageSnapshot,
  displayMode: DisplayMode,
  activity: ResolvedActivity | undefined,
  nowMs: number,
  staleThresholdMs: number
): BarDisplay {
  const hasClaude = snapshot.claude != null;
  const hasCodex = snapshot.codex != null;

  if (!hasClaude && !hasCodex) {
    return { kind: "empty" };
  }

  if (displayMode === "both" && hasClaude && hasCodex) {
    return { kind: "dual" };
  }

  if (displayMode === "auto" && hasClaude && hasCodex) {
    return { kind: "dual" };
  }

  if (displayMode === "claude" && hasClaude) {
    return {
      kind: "single",
      source: "claude",
      stale: isStateStale("claude", snapshot.claude, nowMs, staleThresholdMs, activity),
    };
  }

  if (displayMode === "codex" && hasCodex) {
    return {
      kind: "single",
      source: "codex",
      stale: isStateStale("codex", snapshot.codex, nowMs, staleThresholdMs, activity),
    };
  }

  if (activity?.focusedSource === "claude" && hasClaude) {
    return {
      kind: "single",
      source: "claude",
      stale: isStateStale("claude", snapshot.claude, nowMs, staleThresholdMs, activity),
    };
  }

  if (activity?.focusedSource === "codex" && hasCodex) {
    return {
      kind: "single",
      source: "codex",
      stale: isStateStale("codex", snapshot.codex, nowMs, staleThresholdMs, activity),
    };
  }

  if (hasClaude && hasCodex) {
    const claudeLive = activity?.claudeLive || activity?.claudeConnected;
    const codexLive = activity?.codexLive;
    if (claudeLive && codexLive) {
      return { kind: "dual" };
    }
  }

  const fallback = pickMostRecentSource(snapshot);
  if (fallback) {
    const state = fallback === "claude" ? snapshot.claude : snapshot.codex;
    return {
      kind: "single",
      source: fallback,
      stale: isStateStale(fallback, state, nowMs, staleThresholdMs, activity),
    };
  }

  return { kind: "empty" };
}

function pickMostRecentSource(snapshot: UsageSnapshot): UsageSource | null {
  const claudeUpdated = snapshot.claude?.updatedAt ?? 0;
  const codexUpdated = snapshot.codex?.updatedAt ?? 0;

  if (claudeUpdated === 0 && codexUpdated === 0) {
    return snapshot.claude ? "claude" : snapshot.codex ? "codex" : null;
  }

  return claudeUpdated >= codexUpdated ? "claude" : "codex";
}

function isStateStale(
  source: UsageSource,
  state: UsageSnapshot["claude"],
  nowMs: number,
  staleThresholdMs: number,
  activity: ResolvedActivity | undefined
): boolean {
  if (!state?.updatedAt) {
    return true;
  }

  const age = nowMs - state.updatedAt;
  if (age <= staleThresholdMs) {
    return false;
  }

  if (source === "claude") {
    return !(activity?.claudeLive || activity?.claudeConnected);
  }

  return !activity?.codexLive;
}
