# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-06-10

### Added
- Dual-source support for Claude Code and Codex CLI
- Auto activity detection via bridge heartbeat, Claude IDE locks, and focused terminal
- Split status bar view when both tools are active
- `AI Usage: Install Bridge Scripts` command
- Codex bridge script, session poller, and hook integration
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
