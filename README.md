# CodeLens AI

Keyword-driven Java automation framework intelligence — architecture graph, keyword inventory, dependency flow.

## Packages

| Package | Description |
|---------|-------------|
| `packages/core` | Shared analysis engine (TypeScript) |
| `packages/web` | React frontend (web + VS Code webview) |
| `packages/server` | FastAPI backend (web app only) |
| `packages/vscode` | VS Code extension |

## Quick Start

```bash
# Install dependencies
pnpm install

# Dev mode (web app)
pnpm dev
# Open http://localhost:5173 → Settings → add LLM API key → paste GitHub URL → Analyze

# Build VS Code extension
pnpm build:ext
code --install-extension packages/vscode/codelens-ai-0.1.0.vsix

# Docker
pnpm build:docker
docker-compose up -d
```

## Architecture

The React app (`packages/web`) runs in **two environments**:
- **Web**: communicates with FastAPI backend via HTTP
- **VS Code**: communicates with extension host via `postMessage`

The single `api.ts` client handles the environment branching — all other code is environment-agnostic.
