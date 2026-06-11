import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { expandHome, toTildePath } from "./paths";
import type { ExtensionSettings } from "./types";

export function buildBridgeSetupText(settings: ExtensionSettings): string {
  const claudeBridge = toTildePath(path.join(os.homedir(), ".claude", "claude-status-bridge.js"));
  const codexBridge = toTildePath(path.join(os.homedir(), ".codex", "codex-status-bridge.js"));
  const codexPoller = toTildePath(path.join(os.homedir(), ".codex", "codex-usage-poller.js"));

  return [
    "AI Usage Bar bridge setup",
    "Works in VS Code, Cursor, and remote hosts (WSL, SSH).",
    "",
    "Claude Code:",
    `1. Install bridge scripts (Command: AI Usage: Install Bridge Scripts)`,
    "2. Add to ~/.claude/settings.json:",
    JSON.stringify(
      {
        statusLine: {
          type: "command",
          command: `node ${claudeBridge}`,
          refreshInterval: 1,
        },
      },
      null,
      2
    ),
    "",
    "Codex CLI:",
    "1. Install bridge scripts",
    "2. Add to ~/.codex/config.toml:",
    `[[hooks]]\nevent = "AfterAgent"\ncommand = "node ${codexBridge}"`,
    "",
    "3. Start the Codex poller in a background terminal:",
    `node ${codexPoller} --interval 2000`,
    "",
    `Claude state: ${expandHome(settings.claudeStatePath)}`,
    `Codex state: ${expandHome(settings.codexStatePath)}`,
  ].join("\n");
}

export async function copyBridgeSetup(settings: ExtensionSettings): Promise<void> {
  await vscode.env.clipboard.writeText(buildBridgeSetupText(settings));
  await vscode.window.showInformationMessage("AI Usage bridge setup copied to clipboard.");
}

export async function installBridgeScripts(extensionPath: string): Promise<void> {
  const scriptsDir = path.join(extensionPath, "scripts");
  const targets = [
    { dir: path.join(os.homedir(), ".claude"), files: ["bridge-common.js", "claude-status-bridge.js"] },
    { dir: path.join(os.homedir(), ".codex"), files: ["bridge-common.js", "codex-status-bridge.js", "codex-usage-poller.js"] },
  ];

  for (const target of targets) {
    fs.mkdirSync(target.dir, { recursive: true });

    for (const file of target.files) {
      const source = path.join(scriptsDir, file);
      const destination = path.join(target.dir, file);
      fs.copyFileSync(source, destination);
      fs.chmodSync(destination, 0o755);
    }
  }

  await vscode.window.showInformationMessage(
    "Bridge scripts installed to ~/.claude and ~/.codex."
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
