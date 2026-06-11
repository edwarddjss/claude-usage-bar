import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { UsageBarController } from "./usageBarController";

let controller: UsageBarController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  controller = new UsageBarController(context);
  context.subscriptions.push(controller);
  registerCommands(context, controller);
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}
