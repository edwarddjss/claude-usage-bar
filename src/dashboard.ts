import * as vscode from "vscode";
import type { ResolvedActivity } from "./types";
import type { BridgeState, UsageSnapshot } from "./types";
import {
  formatRemainingPercentage,
  getPrimaryRemainingPercentage,
  renderProgressBar,
} from "./renderBar";
import { formatLastUpdated, formatTimeRemaining, isStale } from "./time";

const VIEW_TYPE = "headroom.dashboard";

interface DashboardSettings {
  claudeStatePath: string;
  codexStatePath: string;
}

interface DashboardViewState {
  snapshot: UsageSnapshot;
  settings: DashboardSettings;
  activity?: ResolvedActivity;
}

let activePanel: vscode.WebviewPanel | undefined;
let latestState: DashboardViewState | undefined;

export function openDashboard(
  _context: vscode.ExtensionContext,
  snapshot: UsageSnapshot,
  settings: DashboardSettings,
  activity?: ResolvedActivity
): void {
  latestState = { snapshot, settings, activity };
  const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

  if (activePanel) {
    activePanel.reveal(column);
    activePanel.webview.html = buildDashboardHtml(latestState);
    return;
  }

  activePanel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    "Headroom",
    column,
    { enableScripts: false, retainContextWhenHidden: true }
  );

  activePanel.onDidDispose(() => {
    activePanel = undefined;
  });

  activePanel.webview.html = buildDashboardHtml(latestState);
}

export function refreshDashboardIfOpen(
  snapshot: UsageSnapshot,
  settings: DashboardSettings,
  activity?: ResolvedActivity
): void {
  if (!activePanel) {
    return;
  }

  latestState = { snapshot, settings, activity };
  activePanel.webview.html = buildDashboardHtml(latestState);
}

function buildDashboardHtml(state: DashboardViewState): string {
  const nowMs = Date.now();

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
      --muted: var(--vscode-descriptionForeground, #8a8a8a);
      --border: var(--vscode-widget-border, #3c3c3c);
      --accent: var(--vscode-progressBar-background, #3794ff);
      --ok: var(--vscode-testing-iconPassed, #73c991);
      --warn: var(--vscode-testing-iconQueued, #cca700);
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: 13px;
      color: var(--fg);
      background: var(--bg);
      margin: 0;
      padding: 24px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .header h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .header span {
      color: var(--muted);
      font-size: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      min-height: 188px;
    }
    .card h2 {
      margin: 0 0 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .metric {
      margin-bottom: 14px;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .metric-row strong {
      font-weight: 500;
    }
    .bar {
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--accent);
      letter-spacing: 0.06em;
      font-size: 12px;
    }
    .meta {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 11px;
      display: grid;
      gap: 4px;
    }
    .empty {
      color: var(--muted);
      font-size: 12px;
      margin: 0;
    }
    .badge {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 6px;
      border-radius: 999px;
      border: 1px solid var(--border);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .badge.live {
      color: var(--ok);
      border-color: color-mix(in srgb, var(--ok) 45%, var(--border));
    }
    .badge.stale {
      color: var(--warn);
      border-color: color-mix(in srgb, var(--warn) 45%, var(--border));
    }
    @media (max-width: 720px) {
      body { padding: 16px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Headroom</h1>
    <span>Updated ${escapeHtml(new Date(nowMs).toLocaleTimeString())}</span>
  </div>
  <div class="grid">
    ${renderSourceCard("Claude", state.snapshot.claude, nowMs)}
    ${renderSourceCard("Codex", state.snapshot.codex, nowMs)}
  </div>
</body>
</html>`;
}

function renderSourceCard(title: string, state: BridgeState | null, nowMs: number): string {
  if (!state) {
    return `<section class="card"><h2>${escapeHtml(
      title
    )}</h2><p class="empty">Waiting for local usage data.</p></section>`;
  }

  const stale = isStale(state.updatedAt, nowMs);
  const badge = stale
    ? '<span class="badge stale">stale</span>'
    : '<span class="badge live">live</span>';

  return `<section class="card">
    <h2>${escapeHtml(title)}${badge}</h2>
    ${renderMetric("5 hour", state, "fiveHour", state.fiveHour?.resetsAt, nowMs)}
    ${renderMetric("Weekly", state, "sevenDay", state.sevenDay?.resetsAt, nowMs)}
    ${renderMetric("Context", state, "context", null, nowMs)}
    <div class="meta">
      <div>Model · ${escapeHtml(state.model ?? "—")}</div>
      <div>Session · ${escapeHtml(state.sessionId ?? "—")}</div>
      <div>Updated · ${escapeHtml(formatLastUpdated(state.updatedAt, nowMs))}</div>
    </div>
  </section>`;
}

function renderMetric(
  label: string,
  state: BridgeState,
  metric: "fiveHour" | "sevenDay" | "context",
  resetsAt: number | null | undefined,
  nowMs: number
): string {
  const leftPercentage = getPrimaryRemainingPercentage(state, metric);
  const resetLabel =
    resetsAt != null ? `resets in ${formatTimeRemaining(resetsAt, nowMs)}` : "—";

  return `<div class="metric">
    <div class="metric-row"><strong>${escapeHtml(label)}</strong><span>${formatRemainingPercentage(
      leftPercentage
    )} left</span></div>
    <div class="bar">${escapeHtml(renderProgressBar(leftPercentage, 16))}</div>
    <div class="metric-row" style="color: var(--muted); margin-top: 4px;"><span>${resetLabel}</span></div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
