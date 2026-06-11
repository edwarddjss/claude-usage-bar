import * as fs from "fs";
import * as vscode from "vscode";
import { expandHome, pathBasename, pathDirname } from "./paths";
import type { ExtensionSettings } from "./types";

const FULL_RESYNC_INTERVAL_MS = 5000;

export class FileWatcherService implements vscode.Disposable {
  private watchers: fs.FSWatcher[] = [];
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly fileMtimes = new Map<string, number>();
  private lastFullRefreshMs = 0;

  constructor(
    private readonly settings: ExtensionSettings,
    private readonly onRefresh: () => void
  ) {}

  start(): void {
    this.stop();

    const stateFiles = [
      expandHome(this.settings.claudeStatePath),
      expandHome(this.settings.codexStatePath),
      expandHome(this.settings.legacyStatePath),
    ];

    const watchedFiles = new Set(stateFiles.map(pathBasename));

    const watchedDirs = new Set([
      pathDirname(this.settings.claudeStatePath),
      pathDirname(this.settings.codexStatePath),
      pathDirname(this.settings.legacyStatePath),
      expandHome(this.settings.claudeIdeLockDir),
    ]);

    for (const directory of watchedDirs) {
      this.watchDirectory(directory, watchedFiles);
    }

    this.refreshTimer = setInterval(() => {
      const nowMs = Date.now();
      const fullResyncDue = nowMs - this.lastFullRefreshMs >= FULL_RESYNC_INTERVAL_MS;

      if (this.pollStateFiles(stateFiles) || fullResyncDue) {
        this.lastFullRefreshMs = nowMs;
        this.onRefresh();
      }
    }, this.settings.refreshIntervalMs);
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.fileMtimes.clear();
    this.lastFullRefreshMs = 0;

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

  private pollStateFiles(stateFiles: string[]): boolean {
    let changed = false;

    for (const filePath of stateFiles) {
      try {
        if (!fs.existsSync(filePath)) {
          continue;
        }

        const mtime = fs.statSync(filePath).mtimeMs;
        const previous = this.fileMtimes.get(filePath);

        if (previous == null) {
          this.fileMtimes.set(filePath, mtime);
          continue;
        }

        if (mtime !== previous) {
          this.fileMtimes.set(filePath, mtime);
          changed = true;
        }
      } catch {
        // Best effort.
      }
    }

    return changed;
  }

  private watchDirectory(directory: string, watchedFiles: Set<string>): void {
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      const watcher = fs.watch(directory, (_eventType, filename) => {
        if (!filename) {
          this.scheduleRefresh();
          return;
        }

        const name = filename.toString();
        if (watchedFiles.has(name) || name.endsWith(".lock")) {
          this.scheduleRefresh();
        }
      });

      this.watchers.push(watcher);
    } catch {
      // Best effort; interval refresh still works.
    }
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.onRefresh();
    }, 250);
  }
}
