import * as vscode from "vscode";
import type { ResolvedActivity } from "./types";
import { buildBridgeSetupText } from "./bridgeSetup";
import { expandHome } from "./paths";
import type { BridgeState, UsageSnapshot } from "./types";
import { formatPercentage, renderProgressBar } from "./renderBar";
import { formatLastUpdated, formatResetTime, formatTimeRemaining } from "./time";

const VIEW_TYPE = "claudeUsageBar.dashboard";

interface DashboardSettings {
  claudeStatePath: string;
  codexStatePath: string;
}

let activePanel: vscode.WebviewPanel | undefined;

export function openDashboard(
  context: vscode.ExtensionContext,
  snapshot: UsageSnapshot,
  settings: DashboardSettings,
  activity?: ResolvedActivity
): void {
  const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

  if (activePanel) {
    activePanel.reveal(column);
    activePanel.webview.html = buildDashboardHtml(snapshot, settings, activity);
    return;
  }

  activePanel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    "AI Usage",
    column,
    { enableScripts: false, retainContextWhenHidden: true }
  );

  activePanel.onDidDispose(() => {
    activePanel = undefined;
  });

  activePanel.webview.html = buildDashboardHtml(snapshot, settings, activity);
}

function buildDashboardHtml(
  snapshot: UsageSnapshot,
  settings: DashboardSettings,
  activity?: ResolvedActivity
): string {
  const nowMs = Date.now();
  const claudePath = expandHome(settings.claudeStatePath);
  const codexPath = expandHome(settings.codexStatePath);

  const setupSnippet = buildBridgeSetupText({
    claudeStatePath: settings.claudeStatePath,
    codexStatePath: settings.codexStatePath,
    legacyStatePath: settings.claudeStatePath,
    claudeIdeLockDir: "~/.claude/ide",
    displayMode: "auto",
    activeThresholdMs: 15_000,
    primaryMetric: "fiveHour",
    statusBarAlignment: "right",
    refreshIntervalMs: 1_000,
    barWidth: 8,
    showIcon: true,
  });

  const activityLine = activity
    ? `Mode: ${activity.mode} · Focus: ${activity.focusedSource ?? "none"} · Claude live: ${activity.claudeLive} · Codex live: ${activity.codexLive}`
    : "Mode: unknown";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #cccccc);
      --muted: var(--vscode-descriptionForeground, #999);
      --border: var(--vscode-panel-border, #444);
      --bar-fill: var(--vscode-progressBar-background, #0e70c0);
    }
    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background: var(--bg);
      margin: 0;
      padding: 20px;
      line-height: 1.5;
    }
    h1 { font-size: 1.4em; margin: 0 0 8px; }
    h2 { font-size: 1.1em; margin: 24px 0 8px; color: var(--muted); }
    .activity { color: var(--muted); margin-bottom: 16px; }
    .metric { margin-bottom: 16px; }
    .metric-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .bar { font-family: monospace; letter-spacing: 1px; color: var(--bar-fill); }
    .detail { color: var(--muted); font-size: 0.9em; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .label { color: var(--muted); }
    pre {
      background: var(--vscode-textCodeBlock-background, #2d2d2d);
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 12px;
      white-space: pre-wrap;
    }
    .source-card {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 16px;
    }
    code { font-family: monospace; }
  </style>
</head>
<body>
  <h1>AI Usage Dashboard</h1>
  <p class="activity">${escapeHtml(activityLine)}</p>

  ${renderSourceCard("Claude", snapshot.claude, claudePath, nowMs)}
  ${renderSourceCard("Codex", snapshot.codex, codexPath, nowMs)}

  <h2>Bridge setup</h2>
  <pre>${escapeHtml(setupSnippet)}</pre>
</body>
</html>`;
}

function renderSourceCard(
  title: string,
  state: BridgeState | null,
  statePath: string,
  nowMs: number
): string {
  if (!state) {
    return `<div class="source-card"><strong>${escapeHtml(title)}</strong><p class="detail">No data yet.</p><code>${escapeHtml(statePath)}</code></div>`;
  }

  const fiveHourPct = state.fiveHour?.usedPercentage ?? null;
  const sevenDayPct = state.sevenDay?.usedPercentage ?? null;
  const contextPct = state.context?.usedPercentage ?? null;

  return `<div class="source-card">
    <div class="metric-header"><strong>${escapeHtml(title)}</strong><span>${formatPercentage(fiveHourPct)}</span></div>
    <div class="bar">${escapeHtml(renderProgressBar(fiveHourPct, 20))}</div>
    <div class="detail">5h resets ${escapeHtml(formatResetTime(state.fiveHour?.resetsAt))} (${escapeHtml(formatTimeRemaining(state.fiveHour?.resetsAt, nowMs))} left)</div>
    <div class="detail">Weekly ${formatPercentage(sevenDayPct)} · Context ${formatPercentage(contextPct)}</div>
    <div class="grid" style="margin-top: 10px;">
      <div><span class="label">Model</span><br>${escapeHtml(state.model ?? "unknown")}</div>
      <div><span class="label">Last updated</span><br>${escapeHtml(formatLastUpdated(state.updatedAt, nowMs))}</div>
      <div><span class="label">Session</span><br>${escapeHtml(state.sessionId ?? "unknown")}</div>
      <div><span class="label">State file</span><br><code>${escapeHtml(statePath)}</code></div>
    </div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
