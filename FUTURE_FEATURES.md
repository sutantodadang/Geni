# Geni - Future Features & Roadmap

This document outlines planned features, enhancements, and architectural improvements for Geni API Client.

## 📅 Version Roadmap

### v0.2 (Next Release) - Advanced Protocol Support

**Focus: Expanding protocol support and scripting capabilities**

#### GraphQL Support

- [ ] GraphQL query editor with syntax highlighting
- [ ] GraphQL schema introspection and autocomplete
- [ ] Variables panel for GraphQL queries
- [ ] Support for GraphQL subscriptions
- [ ] Schema documentation viewer
- [ ] Query validation against schema
- [ ] GraphQL-specific response viewer with data explorer

**Technical Implementation:**

- Add `GraphQLRequest` variant to `RequestBody` enum
- Integrate GraphQL parser (e.g., `graphql-parser` crate)
- Extend HTTP client to handle GraphQL-specific headers
- Add CodeMirror GraphQL mode to frontend

#### WebSocket Testing

- [ ] WebSocket connection management
- [ ] Real-time message sending/receiving
- [ ] Message history viewer
- [ ] Auto-reconnect on connection loss
- [ ] Support for Socket.IO protocol
- [ ] Binary message support (Base64 encoding)
- [ ] Connection state indicators
- [ ] Ping/pong frame monitoring

**Technical Implementation:**

- Add WebSocket client using `tokio-tungstenite` crate
- Create `WebSocketTab` component type
- Store WebSocket messages in history tree
- Implement connection state machine in Rust backend

#### Request Scripting (Pre/Post Scripts)

- [ ] Pre-request scripts for dynamic data generation
- [ ] Post-response scripts for assertions/testing
- [ ] JavaScript/TypeScript execution environment
- [ ] Script console for logging and debugging
- [ ] Access to environment variables in scripts
- [ ] Script library/snippets management
- [ ] Common script templates (generate UUID, timestamp, hash, etc.)

**Technical Implementation:**

- Integrate JavaScript runtime (e.g., `deno_core` or `rusty_v8`)
- Add `pre_request_script` and `post_request_script` fields to `HttpRequest`
- Create script context with access to request/response/environment
- Add script editor component with Monaco Editor

#### Team Collaboration Features

- [ ] Workspace sharing via cloud sync
- [ ] Real-time collaboration indicators
- [ ] Collection permissions (read/write/admin)
- [ ] Activity feed for workspace changes
- [ ] Team member management
- [ ] Conflict resolution UI for simultaneous edits
- [ ] Comments on requests and collections

**Technical Implementation:**

- Extend sync protocol to support workspace sharing
- Add `workspace_id` and `team_members` tables
- Implement permission system in backend
- Add WebSocket for real-time updates

#### Plugin System

- [ ] Plugin API for extending functionality
- [ ] Plugin marketplace/registry
- [ ] Custom protocol handlers via plugins
- [ ] Custom authentication methods
- [ ] Custom response viewers
- [ ] Plugin sandbox/security model
- [ ] Plugin configuration UI

**Technical Implementation:**

- Use WebAssembly (WASM) for plugin runtime
- Define plugin hooks in `lib.rs`
- Create plugin manifest schema
- Add plugin manager UI component

---

### v0.3 (Future) - Documentation & Testing Tools

**Focus: Professional testing, documentation, and performance tools**

#### API Documentation Generation

- [ ] Generate OpenAPI/Swagger specs from collections
- [ ] Markdown documentation export
- [ ] HTML documentation with hosted viewer
- [ ] Auto-generate code samples (curl, JavaScript, Python, etc.)
- [ ] Collection description with Markdown support
- [ ] Request/response examples storage
- [ ] Documentation versioning

**Technical Implementation:**

- Add `openapi` crate for OpenAPI spec generation
- Create documentation generator service
- Add export formats (JSON, YAML, Markdown, HTML)
- Integrate code snippet generator

#### Mock Server Functionality

- [ ] Start mock server from collections
- [ ] Define mock responses per endpoint
- [ ] Dynamic response generation with templates
- [ ] Request matching rules (path, method, headers)
- [ ] Response delay simulation
- [ ] Mock server logs and analytics
- [ ] Import/export mock configurations
- [ ] CORS configuration for mock servers

**Technical Implementation:**

- Add HTTP server using `axum` or `warp`
- Store mock configs in database
- Create mock server management UI
- Implement request matcher engine

#### Performance Testing Tools

- [ ] Load testing with concurrent requests
- [ ] Response time analysis and charts
- [ ] Throughput measurement (requests/second)
- [ ] Latency percentiles (p50, p95, p99)
- [ ] Memory and CPU usage monitoring
- [ ] Performance comparison between runs
- [ ] Export performance reports (CSV, JSON, PDF)
- [ ] Stress testing with ramp-up/down

**Technical Implementation:**

- Add load testing engine with tokio tasks
- Integrate charting library (Chart.js or D3.js)
- Store performance metrics in separate database tree
- Create performance dashboard component

#### CLI Interface

- [ ] Send requests from command line
- [ ] Import/export collections via CLI
- [ ] Run request collections as test suites
- [ ] CI/CD integration support
- [ ] Environment variable override from CLI
- [ ] JSON/XML output formatting
- [ ] Exit codes for test results
- [ ] Watch mode for continuous testing

**Technical Implementation:**

- Add CLI using `clap` crate
- Share core logic with GUI app
- Add headless mode for CI/CD
- Create CLI test runner

---

## 🔧 Technical Enhancements

### Security Improvements

- [ ] OAuth 2.0 flow support (Authorization Code, Client Credentials)
- [ ] API key management with encryption
- [ ] Certificate-based authentication (mTLS)
- [ ] JWT token auto-refresh
- [ ] Session token storage in OS keychain/credential manager
- [ ] Request signing (AWS Signature v4, HMAC)
- [ ] SSL certificate validation options
- [ ] Proxy authentication support

### Database & Storage

- [ ] Database migration system for schema changes
- [ ] Database backup and restore functionality
- [ ] Full-text search across requests and collections
- [ ] Request tagging and filtering
- [ ] Advanced history filtering (by date, status, collection)
- [ ] Export all data to JSON/SQLite
- [ ] Automatic database cleanup (old history)
- [ ] Database encryption at rest

### UI/UX Enhancements

- [ ] Keyboard shortcuts customization
- [ ] Dark/light/auto theme with system detection (✅ partially done)
- [ ] Request diff viewer (compare two requests)
- [ ] Response diff viewer (compare two responses)
- [ ] Split view for multiple requests
- [ ] Request templates/boilerplate
- [ ] Drag-and-drop file upload for request body
- [ ] Request cloning/duplication
- [ ] Bulk operations (delete multiple, move multiple)
- [ ] Search across all collections and requests
- [ ] Recent requests quick access
- [ ] Starred/favorite requests

### HTTP Client Features

- [ ] HTTP/2 and HTTP/3 support
- [ ] Request timeout configuration per request
- [ ] Request cancellation
- [ ] Request retry logic with exponential backoff
- [ ] Follow redirects configuration
- [ ] Proxy support (HTTP, HTTPS, SOCKS5)
- [ ] Custom DNS resolver
- [ ] Cookie jar management
- [ ] Request chaining (use response from one in another)
- [ ] File download with progress indicator
- [ ] Streaming response support
- [ ] Compression support (gzip, brotli)

### Environment & Variables

- [ ] Global variables (shared across environments)
- [ ] Computed/dynamic variables (JavaScript expressions)
- [ ] Secret variables (encrypted, not exported)
- [ ] Environment inheritance/nesting
- [ ] Variable autocomplete in editors
- [ ] Bulk import variables from CSV/JSON
- [ ] Variable usage analytics
- [ ] Unused variable detection

### Import/Export Features

- [ ] Import from Postman collections (v2.1 format)
- [ ] Import from Insomnia workspace
- [ ] Import from OpenAPI/Swagger specs
- [ ] Import from HAR (HTTP Archive) files
- [ ] Import from curl commands
- [ ] Export to various formats (Postman, Insomnia, curl)
- [ ] Selective export (choose specific requests)
- [ ] Auto-backup collections on changes

### Cloud Sync Enhancements

- [ ] Conflict resolution UI when syncing
- [ ] Sync status per collection/request
- [ ] Selective sync (choose what to sync)
- [ ] Offline mode indicator
- [ ] Sync encryption for sensitive data
- [ ] Multiple workspace support
- [ ] Sync history/audit log
- [ ] Automatic sync on changes
- [ ] Dropbox, OneDrive sync providers

### Developer Experience

- [ ] Request/response validation with JSON Schema
- [ ] Request snippets/macros
- [ ] Response assertions and testing
- [ ] CI/CD export (GitHub Actions, GitLab CI templates)
- [ ] Git integration (version control for collections)
- [ ] VSCode extension for Geni
- [ ] Browser extension for capturing requests
- [ ] Request recorder/proxy mode

### Accessibility & Internationalization

- [ ] Full keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Multi-language support (i18n)
- [ ] Localization for major languages (ES, FR, DE, JA, ZH)
- [ ] Accessibility compliance (WCAG 2.1)

### Performance Optimizations

- [ ] Virtual scrolling for large collections
- [ ] Lazy loading for collection tree
- [ ] Response body streaming for large payloads
- [ ] Background database compaction
- [ ] Memory usage optimization
- [ ] Startup time optimization
- [ ] Response caching

---

## 🛠️ Architecture Improvements

### Backend (Rust/Tauri)

- [ ] Replace Sled with SQLite for better query capabilities
- [ ] Add database migration system (e.g., `refinery` crate)
- [ ] Implement proper error types instead of `String`
- [ ] Add comprehensive logging system (e.g., `tracing`)
- [ ] Implement background task queue
- [ ] Add telemetry and crash reporting
- [ ] Unit and integration tests for all commands
- [ ] Benchmark suite for performance tracking
- [ ] API versioning for Tauri commands

### Frontend (React/TypeScript)

- [ ] Split Zustand store into domain-specific stores
- [ ] Add React Query for server state management
- [ ] Implement code splitting and lazy loading
- [ ] Add Storybook for component development
- [ ] Comprehensive TypeScript strict mode
- [ ] Unit tests with Vitest
- [ ] E2E tests with Playwright
- [ ] Component library documentation
- [ ] Error boundary implementation

### Code Quality

- [ ] Pre-commit hooks (formatting, linting)
- [ ] Automated dependency updates (Dependabot)
- [ ] Security vulnerability scanning
- [ ] Code coverage tracking
- [ ] Performance regression testing
- [ ] Automated release process
- [ ] Changelog generation

---

## 🎯 Priority Features (Community Requested)

### High Priority

1. **Postman Collection Import** - Most requested migration feature
2. **Request Scripting** - Critical for automation
3. **Environment Variable Autocomplete** - DX improvement
4. **Request Chaining** - Workflow efficiency
5. **OAuth 2.0 Support** - Essential for modern APIs

### Medium Priority

1. **GraphQL Support** - Growing protocol adoption
2. **Mock Server** - Development workflow tool
3. **CLI Interface** - CI/CD integration
4. **Performance Testing** - Professional tool requirement
5. **WebSocket Testing** - Real-time API support

### Low Priority (Nice to Have)

1. **Plugin System** - Extensibility
2. **VSCode Extension** - IDE integration
3. **Git Integration** - Version control
4. **Multi-language Support** - Global reach
5. **Browser Extension** - Request capturing

---

## 🔄 Technical Debt & Refactoring

### Current Issues to Address

- [ ] Implement proper error handling (replace `.map_err(|e| e.to_string())`)
- [ ] Add request/response size limits
- [ ] Implement proper database transaction support
- [ ] Refactor recursive collection deletion to avoid stack overflow
- [ ] Add rate limiting for sync operations
- [ ] Implement proper authentication token refresh
- [ ] Add request validation before sending
- [ ] Improve UUID handling consistency (String vs Uuid)
- [ ] Add database index for faster queries
- [ ] Implement proper logging throughout codebase

### Code Improvements

- [ ] Extract common UI patterns into reusable components
- [ ] Standardize error messages and toast notifications
- [ ] Add JSDoc/TSDoc documentation
- [ ] Add Rust doc comments for all public APIs
- [ ] Implement proper TypeScript discriminated unions
- [ ] Reduce component prop drilling with context
- [ ] Add loading states for all async operations
- [ ] Implement optimistic UI updates

---

## 📊 Metrics & Analytics (Optional)

### Anonymous Usage Analytics

- [ ] Feature usage tracking (opt-in)
- [ ] Crash reporting (opt-in)
- [ ] Performance metrics collection
- [ ] Error frequency tracking
- [ ] Popular features identification
- [ ] User feedback collection

---

## 🤝 Community & Ecosystem

### Community Features

- [ ] Plugin/extension marketplace
- [ ] Collection sharing community
- [ ] Request template gallery
- [ ] Tutorial and documentation site
- [ ] YouTube video tutorials
- [ ] Blog with tips and tricks
- [ ] Discord/Slack community
- [ ] Monthly release notes

### Professional Features (Potential Paid Tier)

- [ ] Team workspaces with advanced permissions
- [ ] Advanced sync with conflict resolution
- [ ] Priority support
- [ ] Extended history retention
- [ ] Advanced performance testing (unlimited load)
- [ ] Custom branding
- [ ] SSO/SAML authentication
- [ ] Audit logs and compliance reports

---

## 📝 Notes for Contributors

When implementing new features:

1. **Add Tauri Command** - Start in `src-tauri/src/commands/mod.rs`
2. **Update Database Schema** - Add to `db/mod.rs` if needed
3. **Define Models** - Add types to `models/mod.rs`
4. **Update Frontend Store** - Add to `src/store/index.ts`
5. **Create UI Component** - Add to `src/components/`
6. **Update Instructions** - Document in `.github/copilot-instructions.md`
7. **Add to Changelog** - Document user-facing changes
8. **Test Thoroughly** - Manual testing + automated tests

---

**Last Updated**: November 13, 2025  
**Maintainer**: Geni Development Team  
**Contributions**: Features can be proposed via GitHub Issues with `enhancement` label
