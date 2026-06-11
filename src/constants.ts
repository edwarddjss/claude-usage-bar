export const CONFIG_SECTION = "claudeUsageBar";

export const DEFAULT_BRIDGE_DIR = "~/.ai-usage-bridge";
export const DEFAULT_CLAUDE_STATE_PATH = "~/.ai-usage-bridge/claude.json";
export const DEFAULT_CODEX_STATE_PATH = "~/.ai-usage-bridge/codex.json";
export const LEGACY_STATE_PATH = "~/.claude-usage-bridge/state.json";
export const DEFAULT_CLAUDE_IDE_LOCK_DIR = "~/.claude/ide";

export const COMMANDS = {
  openDashboard: "claudeUsageBar.openDashboard",
  refresh: "claudeUsageBar.refresh",
  copyBridgeSetup: "claudeUsageBar.copyBridgeSetup",
  installBridgeScripts: "claudeUsageBar.installBridgeScripts",
  openClaudeStateFile: "claudeUsageBar.openStateFile",
  openCodexStateFile: "claudeUsageBar.openCodexStateFile",
} as const;

export const BRIDGE_SCRIPTS = [
  "bridge-common.js",
  "claude-status-bridge.js",
  "codex-status-bridge.js",
  "codex-usage-poller.js",
] as const;
