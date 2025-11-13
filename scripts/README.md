# Version Management Scripts

This folder contains scripts for managing version numbers across the project.

## Scripts

### `sync-version.mjs`

Syncs the version from `package.json` to `Cargo.toml` and `tauri.conf.json`.

**Usage:**

```bash
bun run version:sync
```

This script is automatically run before `dev` and `build` commands via npm hooks.

### `bump-version.mjs`

Bumps the version number and syncs it across all configuration files.

**Usage:**

```bash
# Bump patch version (0.1.1 -> 0.1.2)
bun run bump patch

# Bump minor version (0.1.1 -> 0.2.0)
bun run bump minor

# Bump major version (0.1.1 -> 1.0.0)
bun run bump major

# Set specific version
bun run bump 1.2.3
```

After bumping, the script will show suggested git commands for committing and tagging.

## Version Flow

```
package.json (source of truth)
    ↓
    ├── src-tauri/Cargo.toml
    └── src-tauri/tauri.conf.json
```

**Important:** Always update version in `package.json` first, then run `bun run version:sync` to propagate changes.

## Automatic Syncing

Version syncing happens automatically:

- Before `bun run dev` (via `predev` hook)
- Before `bun run build` (via `prebuild` hook)
- When running `npm version` commands (via `version` hook)

## Manual Workflow

If you prefer manual version updates:

1. Edit version in `package.json`
2. Run `bun run version:sync`
3. Commit changes
4. Create git tag: `git tag v0.1.2`
5. Push: `git push && git push --tags`

## Recommended Workflow

Use the bump script for automated workflow:

```bash
# 1. Bump version
bun run bump patch

# 2. Review changes
git diff

# 3. Commit and tag
git add .
git commit -m "chore: bump version to v0.1.2"
git tag v0.1.2

# 4. Push
git push && git push --tags
```
