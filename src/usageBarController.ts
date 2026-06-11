import * as vscode from "vscode";
import { resolveActivity } from "./activity";
import { readUsageSnapshot } from "./bridgeState";
import { COMMANDS } from "./constants";
import { openDashboard, refreshDashboardIfOpen } from "./dashboard";
import { FileWatcherService } from "./fileWatcher";
import { renderStatusBarText, renderTooltip } from "./renderBar";
import { getExtensionSettings } from "./settings";
import { TerminalTracker } from "./terminalTracker";
import type { ExtensionSettings, UsageSnapshot } from "./types";

export class UsageBarController implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private readonly terminalTracker: TerminalTracker;
  private fileWatcher: FileWatcherService | undefined;
  private snapshot: UsageSnapshot = { claude: null, codex: null };
  private bridgeConfigured = false;
  private lastStatusText: string | undefined;
  private lastTooltip: string | undefined;
  private statusShown = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.terminalTracker = new TerminalTracker();
    this.context.subscriptions.push(this.terminalTracker);
    this.statusBarItem = this.createStatusBarItem(getExtensionSettings());
    this.context.subscriptions.push(this.statusBarItem);
    this.refreshSnapshot();
    this.restartWatchers();
    this.updateStatusBar();
  }

  getSnapshot(): UsageSnapshot {
    return this.snapshot;
  }

  setBridgeConfigured(configured: boolean): void {
    this.bridgeConfigured = configured;
  }

  refresh(): void {
    this.refreshSnapshot();
    this.updateStatusBar();
  }

  restart(settings?: ExtensionSettings): void {
    if (settings) {
      this.replaceStatusBarItem(settings);
    }

    this.restartWatchers();
    this.refresh();
  }

  dispose(): void {
    this.fileWatcher?.dispose();
    this.terminalTracker.dispose();
    this.statusBarItem.hide();
    this.statusBarItem.dispose();
  }

  private replaceStatusBarItem(settings: ExtensionSettings): void {
    this.statusBarItem.hide();
    this.statusBarItem.dispose();
    this.statusBarItem = this.createStatusBarItem(settings);
    this.lastStatusText = undefined;
    this.lastTooltip = undefined;
    this.statusShown = false;
    this.context.subscriptions.push(this.statusBarItem);
  }

  private createStatusBarItem(settings: ExtensionSettings): vscode.StatusBarItem {
    const alignment =
      settings.statusBarAlignment === "left"
        ? vscode.StatusBarAlignment.Left
        : vscode.StatusBarAlignment.Right;

    const item = vscode.window.createStatusBarItem(alignment, 100);
    item.command = COMMANDS.openDashboard;
    item.name = "Headroom";
    return item;
  }

  private restartWatchers(): void {
    this.fileWatcher?.dispose();
    const settings = getExtensionSettings();
    this.fileWatcher = new FileWatcherService(settings, () => this.refresh());
    this.fileWatcher.start();
  }

  private refreshSnapshot(): void {
    const settings = getExtensionSettings();
    this.snapshot = readUsageSnapshot(
      settings.claudeStatePath,
      settings.codexStatePath,
      settings.legacyStatePath
    );
  }

  private updateStatusBar(): void {
    const settings = getExtensionSettings();
    const nowMs = Date.now();
    const workspaceFolders =
      vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];

    const activity = resolveActivity(this.snapshot, settings.displayMode, {
      nowMs,
      activeThresholdMs: settings.activeThresholdMs,
      workspaceFolders,
      focusedTerminalSource: this.terminalTracker.getFocusedSource(),
    });

    const renderOptions = {
      primaryMetric: settings.primaryMetric,
      barWidth: settings.barWidth,
      showIcon: settings.showIcon,
      displayMode: settings.displayMode,
      nowMs,
      activity,
      bridgeConfigured: this.bridgeConfigured,
    };

    const nextText = renderStatusBarText(this.snapshot, renderOptions);
    const nextTooltip = renderTooltip(this.snapshot, renderOptions);

    if (nextText !== this.lastStatusText) {
      this.statusBarItem.text = nextText;
      this.lastStatusText = nextText;
    }

    if (nextTooltip !== this.lastTooltip) {
      this.statusBarItem.tooltip = nextTooltip;
      this.lastTooltip = nextTooltip;
    }

    if (!this.statusShown) {
      this.statusBarItem.show();
      this.statusShown = true;
    }

    refreshDashboardIfOpen(
      this.snapshot,
      {
        claudeStatePath: settings.claudeStatePath,
        codexStatePath: settings.codexStatePath,
      },
      activity
    );
  }

  openDashboardPanel(): void {
    const settings = getExtensionSettings();
    const activity = resolveActivity(this.snapshot, settings.displayMode, {
      nowMs: Date.now(),
      activeThresholdMs: settings.activeThresholdMs,
      workspaceFolders:
        vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
      focusedTerminalSource: this.terminalTracker.getFocusedSource(),
    });

    openDashboard(
      this.context,
      this.snapshot,
      {
        claudeStatePath: settings.claudeStatePath,
        codexStatePath: settings.codexStatePath,
      },
      activity
    );
  }
}
