#!/usr/bin/env node

/**
 * Version Bump Script
 * Bump version in package.json and sync to Cargo.toml and tauri.conf.json
 *
 * Usage:
 *   bun run bump patch  (0.1.1 -> 0.1.2)
 *   bun run bump minor  (0.1.1 -> 0.2.0)
 *   bun run bump major  (0.1.1 -> 1.0.0)
 *   bun run bump 1.2.3  (set specific version)
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();
const bumpType = process.argv[2];

if (!bumpType) {
  console.error(
    "❌ Error: Please specify bump type (patch, minor, major) or version number"
  );
  console.log("Usage:");
  console.log("  bun run bump patch  (0.1.1 -> 0.1.2)");
  console.log("  bun run bump minor  (0.1.1 -> 0.2.0)");
  console.log("  bun run bump major  (0.1.1 -> 1.0.0)");
  console.log("  bun run bump 1.2.3  (set specific version)");
  process.exit(1);
}

// Read current version from package.json
const packageJsonPath = join(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const currentVersion = packageJson.version;

console.log(`📦 Current version: ${currentVersion}`);

// Calculate new version
let newVersion;
const versionParts = currentVersion.split(".").map(Number);

if (bumpType === "patch") {
  versionParts[2]++;
  newVersion = versionParts.join(".");
} else if (bumpType === "minor") {
  versionParts[1]++;
  versionParts[2] = 0;
  newVersion = versionParts.join(".");
} else if (bumpType === "major") {
  versionParts[0]++;
  versionParts[1] = 0;
  versionParts[2] = 0;
  newVersion = versionParts.join(".");
} else if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
  newVersion = bumpType;
} else {
  console.error("❌ Error: Invalid bump type or version format");
  console.log("Valid bump types: patch, minor, major");
  console.log("Valid version format: X.Y.Z (e.g., 1.2.3)");
  process.exit(1);
}

console.log(`🚀 New version: ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
writeFileSync(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2) + "\n",
  "utf8"
);
console.log("✅ Updated package.json");

// Update Cargo.toml
const cargoTomlPath = join(rootDir, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf8");
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
writeFileSync(cargoTomlPath, cargoToml, "utf8");
console.log("✅ Updated src-tauri/Cargo.toml");

// Update tauri.conf.json
const tauriConfPath = join(rootDir, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = newVersion;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n", "utf8");
console.log("✅ Updated src-tauri/tauri.conf.json");

console.log(`\n🎉 Version bumped from ${currentVersion} to ${newVersion}`);
console.log("\n💡 Next steps:");
console.log("  1. Review the changes");
console.log(
  '  2. Commit: git add . && git commit -m "chore: bump version to v' +
    newVersion +
    '"'
);
console.log("  3. Tag: git tag v" + newVersion);
console.log("  4. Push: git push && git push --tags");
