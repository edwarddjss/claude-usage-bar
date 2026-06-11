# Publishing guide

**No — it is not just three commands.** Those three commands are only the final publish step. Before that you need a one-time account setup and a few listing assets. This guide walks through everything in order.

---

## Phase 1 — One-time accounts (≈15 minutes)

### 1. Create a GitHub repo

```bash
cd /home/nazk/Projects/claude-usage-bar
git add .
git commit -m "Prepare AI Usage Bar v0.3.0 for marketplace release"
gh repo create claude-usage-bar --public --source=. --push
```

This gives you a real `repository` URL for the marketplace listing.

### 2. Create a Marketplace publisher

1. Go to [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Sign in with the **same Microsoft account** you want tied to the publisher
3. Click **Create publisher**
4. Use publisher ID: `edwarddjss` (must match what you put in `package.json`)
5. Display name: `Edward` (or your preferred public name)

### 3. Create a Personal Access Token (PAT)

1. Go to [https://dev.azure.com](https://dev.azure.com) → User settings → **Personal access tokens**
2. Click **New Token**
3. Name: `vsce-publish`
4. Organization: **All accessible organizations**
5. Scopes: **Marketplace → Manage**
6. Copy the token — you only see it once

---

## Phase 2 — Fill in package.json (2 minutes)

Open `package.json` and confirm these fields match your accounts:

```json
{
  "publisher": "edwarddjss",
  "repository": {
    "type": "git",
    "url": "https://github.com/edwarddjss/claude-usage-bar"
  },
  "bugs": {
    "url": "https://github.com/edwarddjss/claude-usage-bar/issues"
  },
  "homepage": "https://github.com/edwarddjss/claude-usage-bar#readme"
}
```

These are already set in the repo — just change them if your publisher ID or GitHub username differs.

---

## Phase 3 — Pre-publish checklist

Run through this before publishing:

- [ ] `pnpm test` — all 39 tests pass
- [ ] `pnpm run lint` — no TypeScript errors
- [ ] `media/icon.png` exists (128×128 PNG) ✅
- [ ] `media/screenshot-*.png` exist for README ✅
- [ ] README reads like a product page, not a dev doc ✅
- [ ] `LICENSE` file present ✅
- [ ] `CHANGELOG.md` updated ✅
- [ ] Tested in VS Code (F5 Extension Development Host)
- [ ] Tested in Cursor (install VSIX or F5)
- [ ] Bridge install command works end-to-end
- [ ] Publisher ID in `package.json` matches marketplace account

### Optional but recommended

- [ ] Replace AI-generated screenshots with real ones from your editor (see below)
- [ ] Publish to [Open VSX](https://open-vsx.org/) for Cursor users who don't use the VS Marketplace
- [ ] Add a GitHub release tag: `git tag v0.3.0 && git push origin v0.3.0`

### Capture real screenshots (recommended before v1.0)

1. Press F5 to open Extension Development Host
2. Seed test data or run Claude Code / Codex
3. Screenshot the status bar → save as `media/screenshot-statusbar.png`
4. Click status bar → screenshot dashboard → `media/screenshot-dashboard.png`
5. Run both CLIs → screenshot dual bar → `media/screenshot-dual.png`

Real screenshots look more trustworthy than mockups on the marketplace.

---

## Phase 4 — Publish (the three commands)

```bash
# 1. Log in (paste your PAT when prompted)
pnpm dlx @vscode/vsce login edwarddjss

# 2. Build the VSIX
pnpm run package

# 3. Publish to VS Code Marketplace
pnpm dlx @vscode/vsce publish
```

After publish, your listing appears at:

`https://marketplace.visualstudio.com/items?itemName=edwarddjss.claude-usage-bar`

Users install with:

```
ext install edwarddjss.claude-usage-bar
```

---

## Phase 5 — Open VSX (optional, for Cursor)

Some Cursor users install from Open VSX instead of the VS Marketplace.

1. Create account at [https://open-vsx.org/](https://open-vsx.org/)
2. Generate an access token in your profile
3. Publish:

```bash
pnpm dlx ovsx publish claude-usage-bar-0.3.0.vsix -p <your-openvsx-token>
```

---

## Updating after the first publish

For each new version:

1. Bump `"version"` in `package.json` (e.g. `0.3.1`)
2. Add entry to `CHANGELOG.md`
3. Run:

```bash
pnpm test
pnpm run package
pnpm dlx @vscode/vsce publish
```

---

## What makes a listing look "real"

| Element | Status in this repo |
|---------|-------------------|
| Professional README with screenshots | ✅ |
| 128×128 icon | ✅ |
| MIT license | ✅ |
| Changelog | ✅ |
| Clear install + setup steps | ✅ |
| Privacy section | ✅ |
| Compatibility table | ✅ |
| GitHub repo link | ⏳ You need to push to GitHub |
| Real product screenshots | ⏳ Replace mockups when ready |
| Publisher account | ⏳ You need to create this once |
| User reviews | — comes after launch |

---

## Common publish errors

| Error | Fix |
|-------|-----|
| `Publisher not found` | Create publisher at marketplace.visualstudio.com/manage |
| `Extension name already taken` | Change `"name"` in package.json to something unique |
| `Invalid PAT` | Regenerate token with **Marketplace → Manage** scope |
| `version must be greater` | Bump version in package.json before re-publishing |
| Missing `repository` | Fill in package.json repository field |
