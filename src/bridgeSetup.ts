import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  formatNodeCommand,
  getBridgePaths,
  installBridgeScriptsToDisk,
} from "./bridgeSetupCore";
import { expandHome } from "./paths";
import type { ExtensionSettings } from "./types";

function buildBridgeSetupText(settings: ExtensionSettings): string {
  const paths = getBridgePaths();
  const claudeCommand = formatNodeCommand(paths.claudeBridge);
  const platform =
    process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";

  return [
    "Headroom bridge setup",
    `Platform: ${platform} — paths use your home directory (${os.homedir()}).`,
    "",
    "Headroom configures itself automatically on install.",
    "If usage is missing, run: Headroom: Install Bridge Scripts",
    "",
    "Claude Code:",
    `1. Add to ${path.join(os.homedir(), ".claude", "settings.json")}:`,
    JSON.stringify(
      {
        statusLine: {
          type: "command",
          command: claudeCommand,
          refreshInterval: 1,
        },
      },
      null,
      2
    ),
    "",
    "Codex:",
    "No Codex config changes are required. Headroom reads local Codex session telemetry while VS Code or Cursor is running.",
    "",
    "Use Claude Code or Codex from the extension UI, terminal TUI, or CLI. Headroom will show usage when local data is available.",
    "",
    `Claude state: ${expandHome(settings.claudeStatePath)}`,
    `Codex state: ${expandHome(settings.codexStatePath)}`,
  ].join("\n");
}

export async function copyBridgeSetup(settings: ExtensionSettings): Promise<void> {
  await vscode.env.clipboard.writeText(buildBridgeSetupText(settings));
  await vscode.window.showInformationMessage("Headroom bridge setup copied to clipboard.");
}

export async function installBridgeScripts(extensionPath: string): Promise<void> {
  const result = installBridgeScriptsToDisk(extensionPath);

  if (result.errors.length > 0) {
    await vscode.window.showErrorMessage(
      `Headroom bridge install failed: ${result.errors[0]}`
    );
    return;
  }

  await vscode.window.showInformationMessage(
    "Headroom bridge ready. Use Claude Code or Codex to see usage."
  );
}

export async function openStateFile(
  source: "claude" | "codex",
  settings: ExtensionSettings
): Promise<void> {
  const resolvedPath = expandHome(
    source === "claude" ? settings.claudeStatePath : settings.codexStatePath
  );

  if (!fs.existsSync(resolvedPath)) {
    const create = "Create file";
    const choice = await vscode.window.showWarningMessage(
      `${source} state file not found at ${resolvedPath}.`,
      create
    );

    if (choice !== create) {
      return;
    }

    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, "{}\n", "utf8");
  }

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(resolvedPath));
  await vscode.window.showTextDocument(doc);
}
