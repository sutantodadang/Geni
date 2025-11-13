# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-11-13

### Fixed

- **Critical macOS crash fix**: Fixed database initialization crash on macOS by using proper app data directory instead of relative path. The app was crashing during startup due to permission/sandboxing issues.
- Added proper macOS app data directory handling using Tauri's `app.path().app_data_dir()`

### Changed

- Database now stores data in the system's app data directory instead of the current working directory
- Updated README with macOS installation workaround for notarization issue

## [0.1.0] - 2025-11-13

### Added

- Initial release
- HTTP request support (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- Request configuration with headers and body (JSON, form-data, raw, URL-encoded)
- Response viewer with syntax highlighting
- Collection management with folders
- Environment variables support
- Request history
- Offline-first architecture with embedded Sled database
- Cloud sync support (API Server, Supabase, Google Drive)
- Import/Export collections
- Native desktop app built with Tauri + Rust + React

### Known Issues

- macOS: App is not notarized (requires Apple Developer account). Users need to run `xattr -cr /Applications/geni.app` to bypass Gatekeeper
