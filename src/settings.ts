import * as vscode from "vscode";
import {
  CONFIG_SECTION,
  DEFAULT_CLAUDE_IDE_LOCK_DIR,
  DEFAULT_CLAUDE_STATE_PATH,
  DEFAULT_CODEX_STATE_PATH,
  LEGACY_STATE_PATH,
} from "./constants";
import type { ExtensionSettings } from "./types";

export function getExtensionSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  return {
    claudeStatePath: config.get<string>("claudeStatePath", DEFAULT_CLAUDE_STATE_PATH),
    codexStatePath: config.get<string>("codexStatePath", DEFAULT_CODEX_STATE_PATH),
    legacyStatePath: config.get<string>("statePath", LEGACY_STATE_PATH),
    claudeIdeLockDir: config.get<string>("claudeIdeLockDir", DEFAULT_CLAUDE_IDE_LOCK_DIR),
    displayMode: config.get("displayMode", "auto"),
    activeThresholdMs: config.get<number>("activeThresholdMs", 15_000),
    primaryMetric: config.get("primaryMetric", "fiveHour"),
    statusBarAlignment: config.get("statusBarAlignment", "right"),
    refreshIntervalMs: config.get<number>("refreshIntervalMs", 1_000),
    barWidth: config.get<number>("barWidth", 8),
    showIcon: config.get<boolean>("showIcon", true),
  };
}
