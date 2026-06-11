import * as vscode from "vscode";
import { installBridgeScriptsToDisk, type BridgeInstallResult } from "./bridgeSetupCore";

export async function ensureBridgeReady(extensionPath: string): Promise<BridgeInstallResult> {
  const result = installBridgeScriptsToDisk(extensionPath);

  if (result.errors.length > 0) {
    console.warn("[Headroom] Bridge auto-setup had errors:", result.errors.join("; "));
  }

  if (!result.scriptsInstalled || !result.claudeConfigured) {
    const detail = result.errors[0] ?? "Could not write Claude bridge files.";
    void vscode.window.showErrorMessage(
      `Headroom setup incomplete: ${detail} Run "Headroom: Install Bridge Scripts" to retry.`
    );
  }

  return result;
}
