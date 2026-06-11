export type UsageSource = "claude" | "codex";

export type PrimaryMetric = "fiveHour" | "sevenDay" | "context";

export type DisplayMode = "auto" | "claude" | "codex" | "both";

export type StatusBarAlignment = "right" | "left";

export interface UsageMetric {
  usedPercentage?: number | null;
  resetsAt?: number | null;
}

export interface BridgeState {
  source?: UsageSource;
  updatedAt?: number;
  sessionId?: string;
  model?: string;
  cwd?: string;
  pid?: number;
  fiveHour?: UsageMetric;
  sevenDay?: UsageMetric;
  context?: {
    usedPercentage?: number | null;
    remainingPercentage?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  };
  cost?: {
    sessionUsd?: number | null;
  };
}

export interface UsageSnapshot {
  claude: BridgeState | null;
  codex: BridgeState | null;
}

export interface ExtensionSettings {
  claudeStatePath: string;
  codexStatePath: string;
  legacyStatePath: string;
  claudeIdeLockDir: string;
  displayMode: DisplayMode;
  activeThresholdMs: number;
  primaryMetric: PrimaryMetric;
  statusBarAlignment: StatusBarAlignment;
  refreshIntervalMs: number;
  barWidth: number;
  showIcon: boolean;
}

export interface RenderOptions {
  primaryMetric: PrimaryMetric;
  barWidth: number;
  showIcon: boolean;
  nowMs?: number;
  activity?: ResolvedActivity;
}

export interface ClaudeIdeLock {
  pid: number;
  workspaceFolders: string[];
  ideName?: string;
}

export interface ActivityContext {
  nowMs: number;
  activeThresholdMs: number;
  workspaceFolders: string[];
  focusedTerminalSource: UsageSource | null;
}

export interface ResolvedActivity {
  claudeLive: boolean;
  codexLive: boolean;
  claudeConnected: boolean;
  focusedSource: UsageSource | null;
  showClaude: boolean;
  showCodex: boolean;
  mode: "single" | "dual" | "none";
  primarySource: UsageSource | null;
}
