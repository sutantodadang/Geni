#!/usr/bin/env node

/**
 * Version Sync Script
 * Syncs version from package.json to Cargo.toml and tauri.conf.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();

// Read version from package.json
const packageJsonPath = join(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

console.log(`📦 Syncing version: ${version}`);

// Update Cargo.toml
const cargoTomlPath = join(rootDir, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf8");
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync(cargoTomlPath, cargoToml, "utf8");
console.log("✅ Updated src-tauri/Cargo.toml");

// Update tauri.conf.json
const tauriConfPath = join(rootDir, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n", "utf8");
console.log("✅ Updated src-tauri/tauri.conf.json");

console.log("🎉 Version sync complete!");
