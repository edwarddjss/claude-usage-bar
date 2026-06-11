export const CONFIG_SECTION = "headroom";

export const DEFAULT_CLAUDE_STATE_PATH = "~/.ai-usage-bridge/claude.json";
export const DEFAULT_CODEX_STATE_PATH = "~/.ai-usage-bridge/codex.json";
export const LEGACY_STATE_PATH = "~/.claude-usage-bridge/state.json";
export const DEFAULT_CLAUDE_IDE_LOCK_DIR = "~/.claude/ide";

export const COMMANDS = {
  openDashboard: "headroom.openDashboard",
  refresh: "headroom.refresh",
  copyBridgeSetup: "headroom.copyBridgeSetup",
  installBridgeScripts: "headroom.installBridgeScripts",
  openClaudeStateFile: "headroom.openStateFile",
  openCodexStateFile: "headroom.openCodexStateFile",
} as const;
