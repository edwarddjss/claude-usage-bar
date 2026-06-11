import * as vscode from "vscode";
import { ensureBridgeReady } from "./bridgeAutoSetup";
import { CodexPollerService } from "./codexPollerService";
import { registerCommands } from "./commands";
import { UsageBarController } from "./usageBarController";

let controller: UsageBarController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  if (controller) {
    console.warn("[Headroom] Extension already active — skipping duplicate activation.");
    return;
  }

  controller = new UsageBarController(context);
  context.subscriptions.push(controller);
  registerCommands(context, controller);

  const poller = new CodexPollerService();
  poller.start(context.extensionPath);
  context.subscriptions.push(poller);

  void ensureBridgeReady(context.extensionPath).then((result) => {
    const configured = result.scriptsInstalled && result.claudeConfigured;
    controller?.setBridgeConfigured(configured);
    controller?.refresh();
  });
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}
