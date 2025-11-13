# Geni - A Postman-like API Client

A lightweight, fast, and native API client built with Rust and Tauri. Geni provides a modern alternative to Postman with full offline support and native performance.

![Geni Screenshot](https://via.placeholder.com/800x500?text=Geni+API+Client)

## ✨ Features

### Core Features (v0.1)

- 🚀 **HTTP Requests**: Send GET, POST, PUT, DELETE, PATCH, HEAD, and OPTIONS requests
- 📝 **Request Configuration**: Custom headers and request body (JSON, form-data, raw text, URL-encoded)
- 👀 **Response Viewer**: View response status, headers, and pretty-printed body with JSON syntax highlighting
- 📚 **Request History**: Automatically save request history locally with SQLite
- 📁 **Collections**: Simple collection management with folders and saved requests
- 🌍 **Environment Variables**: Support for environment variables (e.g., `{{base_url}}`, `{{token}}`)
- 💾 **Offline Support**: Full offline functionality with local data storage
- ⚡ **Native Performance**: Built with Rust for maximum speed and efficiency

### Architecture

- **Backend**: Rust with Tauri framework
  - `reqwest` for HTTP requests
  - `serde` and `serde_json` for JSON parsing
  - `sqlx` with SQLite for local data storage
  - `syntect` for response syntax highlighting
- **Frontend**: React + TypeScript + TailwindCSS
  - Modern UI similar to Postman
  - Sidebar for collections and environment management
  - Tab support for multiple request sessions
  - Responsive design

## 🚀 Getting Started

### Prerequisites

- **Rust**: Install from [rustup.rs](https://rustup.rs/)
- **Node.js**: Install from [nodejs.org](https://nodejs.org/) (v16 or later)
- **Bun**: Install from [bun.sh](https://bun.sh/) (or use npm/yarn)

### Download Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/sutantodadang/Geni/releases) page.

#### macOS Installation Note

**⚠️ Important for v0.1.0 users:** Version 0.1.0 has a critical bug that causes the app to crash on macOS. Please use version **v0.1.1 or later** from the [Releases](https://github.com/sutantodadang/Geni/releases) page.

If you encounter a **"geni is damaged and can't be opened"** error on macOS:

1. Open **Terminal**
2. Run the following command:
   ```bash
   xattr -cr /Applications/geni.app
   ```
3. Try opening Geni again

**Why does this happen?** The app is not notarized by Apple because we currently don't have an Apple Developer account ($99/year). This command removes the quarantine attribute that macOS adds to downloaded apps. The app is safe to use - you can verify the source code in this repository.

#### Windows & Linux

Simply run the installer or executable. No additional steps required.

### Building from Source

1. **Clone the repository**

   ```bash
   git clone https://github.com/sutantodadang/Geni.git
   cd geni
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Run in development mode**

   ```bash
   bun run tauri dev
   ```

4. **Build for production**
   ```bash
   bun run tauri build
   ```

### Project Structure

```
Geni/
├── src-tauri/              # Rust backend (Tauri commands)
│   ├── src/
│   │   ├── main.rs         # Main entry point
│   │   ├── lib.rs          # Library setup
│   │   ├── db/             # Database operations
│   │   ├── models/         # Data models
│   │   ├── http/           # HTTP client
│   │   └── commands/       # Tauri commands
│   └── Cargo.toml         # Rust dependencies
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── store/             # Zustand state management
│   └── App.tsx            # Main app component
├── package.json           # Node.js dependencies
└── tailwind.config.js     # TailwindCSS configuration
```

## 🎯 Usage

### Basic Request

1. **Create a new request**: Click the "New Request" button or use `Cmd+N`
2. **Set the method**: Choose from GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
3. **Enter the URL**: Type your API endpoint URL
4. **Add headers** (optional): Click "Add Header" to add custom headers
5. **Set request body** (optional): Choose from JSON, Raw, Form Data, or URL Encoded
6. **Send the request**: Click the "Send" button or use `Cmd+Enter`

### Collections

1. **Create a collection**: Click the "+" icon next to Collections in the sidebar
2. **Save requests**: Use the "Save" button in any request tab
3. **Organize requests**: Drag and drop requests into collections
4. **Import/Export**: Right-click on collections for import/export options

### Environment Variables

1. **Create an environment**: Click the "+" icon next to the Environment dropdown
2. **Define variables**: Add key-value pairs (e.g., `base_url` = `https://api.example.com`)
3. **Use variables**: Reference them in URLs, headers, or body using `{{variable_name}}`
4. **Switch environments**: Select different environments from the dropdown

### Keyboard Shortcuts

- `Cmd+N` / `Ctrl+N`: New request tab
- `Cmd+W` / `Ctrl+W`: Close current tab
- `Cmd+T` / `Ctrl+T`: New collection
- `Cmd+Enter` / `Ctrl+Enter`: Send request
- `Cmd+S` / `Ctrl+S`: Save request

## 🛠️ Development

### Backend Development

The Rust backend is located in `src-tauri/`. Key components:

- **Database**: SQLite with `sqlx` for request history, collections, and environments
- **HTTP Client**: `reqwest` for making HTTP requests with full feature support
- **Commands**: Tauri commands that expose Rust functionality to the frontend

### Frontend Development

The React frontend is in `src/`. Key technologies:

- **State Management**: Zustand for lightweight state management
- **Styling**: TailwindCSS for utility-first styling
- **Icons**: Lucide React for consistent iconography
- **TypeScript**: Full type safety throughout the application

### Adding New Features

1. **Backend**: Add new Tauri commands in `src-tauri/src/commands/`
2. **Frontend**: Update the store in `src/store/` and add UI components
3. **Database**: Modify schemas in `src-tauri/src/db/mod.rs`

## 📋 API

### Tauri Commands

The following commands are exposed from Rust to the frontend:

#### HTTP Requests

- `send_request(payload)` - Send HTTP request
- `format_json(content)` - Format JSON string
- `validate_url(url)` - Validate URL format

#### Collections

- `create_collection(payload)` - Create new collection
- `get_collections()` - Get all collections
- `delete_collection(id)` - Delete collection
- `export_collection(id)` - Export collection
- `import_collection(data)` - Import collection

#### Requests

- `save_request(payload)` - Save request to collection
- `get_requests(collection_id?)` - Get requests from collection
- `delete_request(id)` - Delete saved request

#### Environments

- `create_environment(payload)` - Create new environment
- `get_environments()` - Get all environments
- `set_active_environment(id?)` - Set active environment
- `get_active_environment()` - Get current active environment

#### History

- `get_request_history(limit?)` - Get request history
- `clear_request_history()` - Clear all history

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `cargo test` (backend) and `bun test` (frontend)
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - For the amazing Rust + Web framework
- [Postman](https://postman.com/) - For inspiration on API client UX
- [Insomnia](https://insomnia.rest/) - For additional API client inspiration
- [Thunder Client](https://www.thunderclient.com/) - For VS Code integration ideas

## 🔮 Roadmap

### v0.2 (Planned)

- [ ] GraphQL support
- [ ] WebSocket testing
- [ ] Request scripting (Pre/Post request scripts)
- [ ] Team collaboration features
- [ ] Plugin system

### v0.3 (Future)

- [ ] API documentation generation
- [ ] Mock server functionality
- [ ] Performance testing tools
- [ ] CLI interface

## 📞 Support

- 📧 Email: support@geni-api.com
- 💬 Discord: [Join our community](https://discord.gg/geni)
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/geni/issues)
- 📖 Documentation: [docs.geni-api.com](https://docs.geni-api.com)

---

Made with ❤️ by the Geni team
