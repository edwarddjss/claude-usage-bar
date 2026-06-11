# Headroom publishing flow

How this repo gets to **VS Code** and **Cursor**, and how we ship updates from the CLI.

---

## What we're publishing

| Field | Value |
|-------|-------|
| Extension name (slug) | `headroom` |
| Marketplace ID | `edwarddjss.headroom` |
| Publisher | `edwarddjss` (Blackdog Labs) |
| Display name | Headroom |
| Entry point | `src/extension.ts` → compiled to `out/extension.js` |
| Package manager | `pnpm` |

The repo folder is still `claude-usage-bar` on GitHub. The marketplace slug is `headroom`.

---

## Two registries, one VSIX

We publish the **same VSIX** to two places:

| Registry | Who uses it | CLI tool |
|----------|-------------|----------|
| [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=edwarddjss.headroom) | VS Code | `@vscode/vsce` |
| [Open VSX](https://open-vsx.org/extension/edwarddjss/headroom) | Cursor (default extension search) | `ovsx` |

Cursor does not search the Microsoft Marketplace by default. **You must publish to both** or Cursor users won't see updates.

```
pnpm run package  →  headroom-X.Y.Z.vsix
        │
        ├── pnpm dlx @vscode/vsce publish     → VS Code
        └── pnpm dlx ovsx publish ...vsix     → Cursor / Open VSX
```

---

## One-time setup

### 1. VS Code Marketplace publisher

1. [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Create publisher: `edwarddjss` (must match `package.json` → `"publisher"`)
3. Create a PAT at [dev.azure.com](https://dev.azure.com) → User settings → Personal access tokens
   - Organization: **All accessible organizations**
   - Scope: **Marketplace → Manage**
4. Log in once from this repo:

```bash
pnpm dlx @vscode/vsce login edwarddjss
# paste PAT when prompted
```

Credentials are stored in `~/.vsce`.

### 2. Open VSX (Cursor)

1. Account at [open-vsx.org](https://open-vsx.org/)
2. Profile → **Access Tokens** → generate token
3. Create namespace (first time only):

```bash
pnpm dlx ovsx create-namespace edwarddjss -p <OPENVSX_TOKEN>
```

Namespace `edwarddjss` must match the publisher ID.

### 3. Confirm `package.json` metadata

Already set in this repo:

```json
{
  "name": "headroom",
  "publisher": "edwarddjss",
  "repository": {
    "url": "https://github.com/edwarddjss/claude-usage-bar"
  }
}
```

---

## Release workflow (every version)

### 1. Make changes

Source lives in `src/`. Bridge scripts in `scripts/`. Tests in `test/`.

### 2. Bump version

Edit `package.json` → `"version"`. Add an entry to `CHANGELOG.md`.

Semver in practice for this project:

- **Patch** (`1.2.1`) — bug fixes, copy, refresh timing
- **Minor** (`1.3.0`) — features, dashboard changes
- **Major** (`2.0.0`) — breaking settings/command namespace changes

Marketplace rejects re-publishing the same version. Always bump before publish.

### 3. Verify locally

```bash
pnpm install
pnpm test          # unit tests (render, bridge, activity, etc.)
pnpm run lint      # tsc --noEmit
```

Optional manual check:

```bash
pnpm run watch     # terminal 1 — compile on save
# F5 in VS Code/Cursor — Extension Development Host
```

Or install the built VSIX locally:

```bash
pnpm run package
cursor --install-extension headroom-$(node -p "require('./package.json').version").vsix --force
# or: code --install-extension headroom-....vsix --force
```

### 4. Build the VSIX

```bash
pnpm run package
```

This runs `tsc`, then `vsce package --no-dependencies`. Output:

```
headroom-<version>.vsix
```

Included assets are controlled by `.vscodeignore` (excludes `src/`, `test/`, dev configs; ships `out/`, `scripts/`, `media/`).

`vsce publish` also runs `vscode:prepublish` → `pnpm run compile` automatically, but we still `package` first so Open VSX gets the same file.

### 5. Publish to VS Code Marketplace

```bash
pnpm dlx @vscode/vsce publish
```

Uses version from `package.json`. Requires prior `vsce login`.

Verify:

```bash
pnpm dlx @vscode/vsce show edwarddjss.headroom
```

Listing URL may take a few minutes to propagate:

`https://marketplace.visualstudio.com/items?itemName=edwarddjss.headroom`

### 6. Publish to Open VSX (Cursor)

```bash
pnpm dlx ovsx publish headroom-<version>.vsix -p <OPENVSX_TOKEN>
```

Example:

```bash
pnpm dlx ovsx publish headroom-1.2.1.vsix -p "$OVSX_PAT"
```

Open VSX can take 30–60 seconds before the new version appears in search. If publish says **"already published but isn't active"**, wait a minute and check the [extension page](https://open-vsx.org/extension/edwarddjss/headroom). Delete stuck inactive versions from Open VSX → Settings → Extensions if needed.

### 7. Tag the release (optional)

```bash
git tag v1.2.0
git push origin v1.2.0
```

---

## Quick reference — full release

```bash
# 1. bump version in package.json + CHANGELOG.md

pnpm test
pnpm run package

pnpm dlx @vscode/vsce publish
pnpm dlx ovsx publish headroom-$(node -p "require('./package.json').version").vsix -p "$OVSX_PAT"
```

---

## How users get updates

| Editor | Source | Update path |
|--------|--------|-------------|
| VS Code | Microsoft Marketplace | Extensions → Headroom → Update |
| Cursor | Open VSX | Extensions → Headroom → Update |

Users on an old local VSIX install (`--install-extension headroom-X.vsix`) do **not** auto-update. They need to install from the marketplace or reinstall a new VSIX.

---

## What gets published

```
headroom.vsix
├── package.json          # manifest, commands, settings
├── out/                  # compiled TypeScript
├── scripts/              # bridge scripts (copied locally on activate; Codex uses the extension poller)
├── media/                # icon + README screenshots
├── README.md             # marketplace listing body
├── CHANGELOG.md
└── LICENSE
```

Not published: `src/`, `test/`, `.vscode/`, `node_modules/`.

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Extension name already exists` | `name` slug taken globally | We use `headroom` — don't rename back to `claude-usage-bar` |
| `version must be greater` | Same version already published | Bump `package.json` version |
| `Publisher not found` | Publisher ID mismatch | `package.json` `"publisher"` must be `edwarddjss` |
| `Invalid PAT` / 401 | Expired or wrong-scope token | Regenerate with **Marketplace → Manage** |
| Open VSX `isn't active` | Registry propagation / stuck upload | Wait 1 min, check open-vsx.org UI, delete bad version, republish |
| `ENOENT headroom-X.vsix` | Forgot to package before `ovsx publish` | Run `pnpm run package` first |
| Listing 404 right after publish | CDN lag | Normal — API and `vsce show` confirm success first |

---

## Credentials on this machine

| Tool | Stored in |
|------|-----------|
| `vsce` | `~/.vsce` (PAT for `edwarddjss`) |
| `ovsx` | Pass `-p` each time, or set `OVSX_PAT` env var |

Never commit tokens. Rotate if exposed.

---

## Repo scripts

| Command | What it does |
|---------|--------------|
| `pnpm run compile` | `tsc` → `out/` |
| `pnpm run watch` | compile on save |
| `pnpm test` | compile + `node --test test/*.test.js` |
| `pnpm run lint` | `tsc --noEmit` |
| `pnpm run package` | compile + `vsce package` → `.vsix` |

---

## Checklist before every release

- [ ] Version bumped in `package.json`
- [ ] `CHANGELOG.md` updated
- [ ] `pnpm test` passes
- [ ] Tested in Extension Development Host or local VSIX
- [ ] `pnpm run package` succeeds
- [ ] `vsce publish` → VS Code Marketplace
- [ ] `ovsx publish` → Open VSX / Cursor
- [ ] Optional: git tag + GitHub release
