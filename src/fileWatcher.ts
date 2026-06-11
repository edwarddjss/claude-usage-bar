import * as fs from "fs";
import * as vscode from "vscode";
import { expandHome, pathBasename, pathDirname } from "./paths";
import type { ExtensionSettings } from "./types";

export class FileWatcherService implements vscode.Disposable {
  private watchers: fs.FSWatcher[] = [];
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly settings: ExtensionSettings,
    private readonly onRefresh: () => void
  ) {}

  start(): void {
    this.stop();

    const watchedFiles = new Set([
      pathBasename(this.settings.claudeStatePath),
      pathBasename(this.settings.codexStatePath),
      pathBasename(this.settings.legacyStatePath),
    ]);

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
      this.onRefresh();
    }, this.settings.refreshIntervalMs);
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  dispose(): void {
    this.stop();
  }

  private watchDirectory(directory: string, watchedFiles: Set<string>): void {
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      const watcher = fs.watch(directory, (_eventType, filename) => {
        if (!filename) {
          this.onRefresh();
          return;
        }

        const name = filename.toString();
        if (watchedFiles.has(name) || name.endsWith(".lock")) {
          this.onRefresh();
        }
      });

      this.watchers.push(watcher);
    } catch {
      // Best effort; interval refresh still works.
    }
  }
}
