import * as vscode from "vscode";
import type { UsageSource } from "./types";
import { detectSourceFromCommand } from "./detectSource";

export { detectSourceFromCommand } from "./detectSource";

export class TerminalTracker implements vscode.Disposable {
  private readonly terminalSources = new Map<vscode.Terminal, UsageSource>();
  private focusedTerminalSource: UsageSource | null = null;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.window.onDidChangeActiveTerminal(() => this.refreshFocusedSource()),
      vscode.window.onDidOpenTerminal((terminal) => this.inspectTerminalTitle(terminal)),
      vscode.window.onDidCloseTerminal((terminal) => {
        this.terminalSources.delete(terminal);
        this.refreshFocusedSource();
      }),
      vscode.window.onDidStartTerminalShellExecution((event) => {
        const source = detectSourceFromCommand(event.execution.commandLine.value);
        if (source) {
          this.terminalSources.set(event.terminal, source);
          this.refreshFocusedSource();
        }
      }),
      vscode.window.onDidEndTerminalShellExecution((event) => {
        const tracked = this.terminalSources.get(event.terminal);
        const endedSource = detectSourceFromCommand(event.execution.commandLine.value);
        if (tracked && tracked === endedSource) {
          this.terminalSources.delete(event.terminal);
          this.refreshFocusedSource();
        }
      })
    );

    for (const terminal of vscode.window.terminals) {
      this.inspectTerminalTitle(terminal);
    }

    this.refreshFocusedSource();
  }

  getFocusedSource(): UsageSource | null {
    return this.focusedTerminalSource;
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private inspectTerminalTitle(terminal: vscode.Terminal): void {
    const source = detectSourceFromCommand(terminal.name);
    if (source) {
      this.terminalSources.set(terminal, source);
    }
  }

  private refreshFocusedSource(): void {
    const active = vscode.window.activeTerminal;
    if (!active) {
      this.focusedTerminalSource = null;
      return;
    }

    this.focusedTerminalSource =
      this.terminalSources.get(active) ?? detectSourceFromCommand(active.name);
  }
}
