import * as vscode from "vscode";
import {
  copyBridgeSetup,
  installBridgeScripts,
  openStateFile,
} from "./bridgeSetup";
import { COMMANDS, CONFIG_SECTION } from "./constants";
import { getExtensionSettings } from "./settings";
import type { UsageBarController } from "./usageBarController";

export function registerCommands(
  context: vscode.ExtensionContext,
  controller: UsageBarController
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.openDashboard, () => {
      controller.openDashboardPanel();
    }),
    vscode.commands.registerCommand(COMMANDS.refresh, () => {
      controller.refresh();
    }),
    vscode.commands.registerCommand(COMMANDS.copyBridgeSetup, async () => {
      await copyBridgeSetup(getExtensionSettings());
    }),
    vscode.commands.registerCommand(COMMANDS.installBridgeScripts, async () => {
      await installBridgeScripts(context.extensionPath);
    }),
    vscode.commands.registerCommand(COMMANDS.openClaudeStateFile, async () => {
      await openStateFile("claude", getExtensionSettings());
    }),
    vscode.commands.registerCommand(COMMANDS.openCodexStateFile, async () => {
      await openStateFile("codex", getExtensionSettings());
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        controller.restart(getExtensionSettings());
      }
    })
  );
}
