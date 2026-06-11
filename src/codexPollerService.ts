import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import * as vscode from "vscode";

const POLL_INTERVAL_MS = 1000;

export class CodexPollerService implements vscode.Disposable {
  private process: ChildProcess | undefined;

  start(extensionPath: string): void {
    this.stop();

    const scriptPath = path.join(extensionPath, "scripts", "codex-usage-poller.js");
    const nodeCommand = process.platform === "win32" ? "node.exe" : "node";

    this.process = spawn(nodeCommand, [scriptPath, "--interval", String(POLL_INTERVAL_MS)], {
      stdio: "ignore",
      windowsHide: true,
    });

    this.process.on("error", (error) => {
      console.warn("[Headroom] Codex poller could not start:", error.message);
    });
  }

  stop(): void {
    if (!this.process) {
      return;
    }

    this.process.kill();
    this.process = undefined;
  }

  dispose(): void {
    this.stop();
  }
}
