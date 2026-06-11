import * as fs from "fs";
import * as vscode from "vscode";
import { expandHome, pathBasename, pathDirname } from "./paths";
import {
  readStateFileFingerprint,
  sameFingerprint,
  type StateFileFingerprint,
} from "./stateFileFingerprint";
import type { ExtensionSettings } from "./types";

const CONTENT_VERIFY_INTERVAL_MS = 5000;
const WATCH_DEBOUNCE_MS = 250;

export class FileWatcherService implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private stateFiles: string[] = [];
  private readonly fingerprints = new Map<string, StateFileFingerprint>();
  private lastContentVerifyMs = 0;

  constructor(
    private readonly settings: ExtensionSettings,
    private readonly onRefresh: () => void
  ) {}

  start(): void {
    this.stop();

    this.stateFiles = [
      expandHome(this.settings.claudeStatePath),
      expandHome(this.settings.codexStatePath),
      expandHome(this.settings.legacyStatePath),
    ];
    const watchedStateFiles = new Set(this.stateFiles);

    for (const filePath of watchedStateFiles) {
      this.watchFile(filePath);
    }

    this.watchClaudeIdeLocks(expandHome(this.settings.claudeIdeLockDir));
    this.primeStateFileFingerprints();

    this.refreshTimer = setInterval(() => {
      const nowMs = Date.now();
      const verifyContents = nowMs - this.lastContentVerifyMs >= CONTENT_VERIFY_INTERVAL_MS;

      if (verifyContents) {
        if (this.pollStateFiles(true)) {
          this.onRefresh();
        }
        this.lastContentVerifyMs = nowMs;
        return;
      }

      if (this.pollStateFiles(false)) {
        this.onRefresh();
      }
    }, this.settings.refreshIntervalMs);
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    this.stateFiles = [];
    this.fingerprints.clear();
    this.lastContentVerifyMs = 0;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  dispose(): void {
    this.stop();
  }

  private primeStateFileFingerprints(): void {
    this.lastContentVerifyMs = Date.now();

    for (const filePath of this.stateFiles) {
      this.fingerprints.set(filePath, readStateFileFingerprint(filePath, true));
    }
  }

  private pollStateFiles(includeContent: boolean): boolean {
    let changed = false;

    for (const filePath of this.stateFiles) {
      const next = readStateFileFingerprint(filePath, includeContent);
      const previous = this.fingerprints.get(filePath);

      if (!sameFingerprint(previous, next, includeContent)) {
        this.fingerprints.set(filePath, next);
        changed = true;
      }
    }

    return changed;
  }

  private watchFile(filePath: string): void {
    const directory = pathDirname(filePath);
    const filename = pathBasename(filePath);

    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(directory), filename)
      );
      this.bindWatcher(watcher);
      this.watchers.push(watcher);
    } catch {
      // Best effort; fingerprint polling still verifies shared state.
    }
  }

  private watchClaudeIdeLocks(directory: string): void {
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(directory), "*.lock")
      );
      this.bindWatcher(watcher);
      this.watchers.push(watcher);
    } catch {
      // Best effort; activity also resolves from the latest bridge state.
    }
  }

  private bindWatcher(watcher: vscode.FileSystemWatcher): void {
    watcher.onDidChange(() => this.scheduleRefresh());
    watcher.onDidCreate(() => this.scheduleRefresh());
    watcher.onDidDelete(() => this.scheduleRefresh());
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.onRefreshIfStateChanged(true);
    }, WATCH_DEBOUNCE_MS);
  }

  private onRefreshIfStateChanged(includeContent: boolean): void {
    if (this.pollStateFiles(includeContent)) {
      if (includeContent) {
        this.lastContentVerifyMs = Date.now();
      }
      this.onRefresh();
    }
  }
}
