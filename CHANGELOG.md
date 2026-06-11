# Changelog

All notable changes to this project will be documented in this file.

## [1.2.16] - 2026-06-11

### Fixed
- Status bar now periodically resyncs shared bridge files from disk so one editor window can catch usage updates written by another window even if a file-watch event is missed

## [1.2.15] - 2026-06-11

### Changed
- Marketplace metadata now includes more precise Claude/Codex rate-limit and status-bar search terms
- Added the `Machine Learning` category while keeping the visible listing concise

## [1.2.14] - 2026-06-11

### Changed
- Marketplace README is now shorter and product-facing, without internal setup details
- Screenshot now uses a GitHub raw image URL so marketplace pages do not render a broken bundled image

## [1.2.13] - 2026-06-11

### Changed
- Marketplace tagline now uses clearer `headroom` wording instead of awkward `usage left` phrasing

## [1.2.12] - 2026-06-11

### Fixed
- Status bar no longer shows `refresh` for stale Claude reset windows; it keeps the latest numeric headroom visible with the stale marker
- Codex polling now runs every second so the status bar tracks Codex's own usage display more closely
- Empty tooltip copy no longer implies terminal-only usage

## [1.2.11] - 2026-06-11

### Changed
- Renamed the marketplace screenshot asset so registries fetch the updated image instead of a cached old filename

## [1.2.10] - 2026-06-11

### Fixed
- Codex poller now uses a per-user lock file so multiple editor windows do not start duplicate pollers

### Changed
- Enabled TypeScript unused-code checks
- Removed legacy screenshot assets, old package artifacts, unused exports, and unused helpers
- Cleaned repair/setup copy so it no longer implies terminal-only usage

## [1.2.9] - 2026-06-11

### Changed
- Marketplace description now clarifies that Headroom works with extension UI, terminal TUI, and CLI sessions

## [1.2.8] - 2026-06-11

### Changed
- Marketplace screenshot now shows the focused dual status bar and hover tooltip view

## [1.2.7] - 2026-06-11

### Changed
- Dual status bar labels now use `Claude` and `Codex` instead of ambiguous `C` and `X`

## [1.2.6] - 2026-06-11

### Fixed
- Tooltip no longer includes a live-updating `updated` row, preventing hover rebuilds during active Codex sessions
- Codex poller interval increased from 1s to 5s to reduce unnecessary UI churn while keeping usage effectively live

## [1.2.5] - 2026-06-11

### Fixed
- Status bar and tooltip updates are now skipped when rendered content is unchanged, preventing visible hover flicker
- File watcher events are debounced so one bridge write does not trigger multiple UI refreshes

### Changed
- Marketplace listing copy now focuses on headroom left, zero Codex config edits, and local-only privacy
- Unused legacy/fake screenshot assets are excluded from packaged VSIX files
- Dashboard layout is clearer about left, used, reset, model, session, and credits

## [1.2.4] - 2026-06-11

### Fixed
- Remaining headroom percentages now floor instead of round, avoiding overstatement like `95% left` when Codex shows `94%`
- Stale expired reset windows now show `refresh` instead of stale `0% left`
- Codex credit metadata is preserved when telemetry exposes API/credit fallback state

### Changed
- Tooltips keep subscription headroom and credit availability as separate rows

## [1.2.3] - 2026-06-11

### Fixed
- Codex poller no longer rewrites unchanged state every polling interval, preventing status bar tooltip flicker on hover
- Codex context now uses the latest request token usage instead of cumulative session totals
- Codex model is extracted from session context when rate-limit events omit it
- Tooltip hides unavailable cost rows instead of showing `cost —`

## [1.2.2] - 2026-06-11

### Fixed
- Repairs old Codex `codex-status-bridge.js` hook config left by earlier releases without adding new Codex hooks
- Status bar and dashboard now show remaining headroom as the primary value

### Changed
- Tooltips show both used and left percentages so the visible percentage is not ambiguous

## [1.2.1] - 2026-06-11

### Fixed
- Auto mode now keeps Claude and Codex in a stable split view when both have data
- Codex polling now prefers the real account limit over model-specific `codex_*` limits
- Codex setup no longer writes the old `[[hooks]]` block to `~/.codex/config.toml`
- Codex context usage is calculated from token totals and model context window when available
- Codex parser now accepts fractional percentages, `percent_used`, and used/limit pairs

### Changed
- Marketplace README, package description, and dashboard empty states now describe the zero-setup flow clearly

## [1.2.0] - 2026-06-11

### Fixed
- Status bar always shows bridge percentages when data exists (no more hiding live usage behind activity checks)
- Stale data keeps showing exact percentages instead of replacing them with a warning-only message
- Faster refresh (500ms) with mtime polling for reliable updates on Windows
- Codex poller runs every 1s

### Changed
- Dashboard redesigned — minimal layout, live updates, no setup dump
- Marketplace README and listing copy simplified

## [1.1.0] - 2026-06-11

### Added
- **Zero-config install** — bridge scripts, Claude status line config, and Codex poller run automatically on activation
- Friendlier status bar when waiting: `Start Claude or Codex`

### Changed
- Removed first-run setup prompt — setup is silent unless it fails

## [1.0.1] - 2026-06-11

### Added
- First-run setup prompt when bridge files are missing
- **Install Bridge Scripts** now auto-configures Claude `settings.json`

### Fixed
- Windows-safe bridge commands using quoted absolute paths instead of `~` (tilde paths fail in Node on Windows)
- Skip `chmod` on Windows during script install

## [1.0.0] - 2026-06-10

### Added
- First public Marketplace release as **Headroom — Claude & Codex Usage**
- Marketplace ID: `edwarddjss.headroom`

### Changed
- Rebranded from AI Usage Bar / `claude-usage-bar` to **Headroom**
- Command namespace: `headroom.*` (was `claudeUsageBar.*`)
- Settings namespace: `headroom.*` (was `claudeUsageBar.*`)

## [0.3.0] - 2026-06-10

### Added
- Dual-source support for Claude Code and Codex CLI
- Auto activity detection via bridge heartbeat, Claude IDE locks, and focused terminal
- Split status bar view when both tools are active
- `AI Usage: Install Bridge Scripts` command
- Codex bridge script and session poller
- Modular extension architecture (`UsageBarController`, services, shared types)
- VS Code + Cursor + remote host compatibility (`extensionKind: workspace`)

### Changed
- Bridge state directory moved to `~/.ai-usage-bridge/`
- Display name updated to **AI Usage Bar**
- Command titles standardized under **AI Usage:**

## [0.1.0] - 2026-06-10

### Added
- Initial Claude Code-only status bar extension
- Bridge script and dashboard
- File watcher and tooltip support
