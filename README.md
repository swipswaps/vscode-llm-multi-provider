# vscode-llm-multi-provider

Multi-LLM provider assistant for VS Code supporting **OpenAI**, **Anthropic Claude**, and **DeepSeek** via official APIs only.

## Compliance Foundation

This extension **does not**:
- Use Playwright to automate logged-in sessions
- Copy browser cookies or session tokens
- Perform session impersonation or fingerprint spoofing

All providers are accessed through their **official API endpoints** with user-supplied API keys stored in VS Code's secure `SecretStorage`.

**Sources:**
- OpenAI: https://platform.openai.com/docs/usage-policies
- Anthropic: https://www.anthropic.com/legal/terms

## Installation

1. Clone this repository:
```bash
   git clone https://github.com/swipswaps/vscode-llm-multi-provider.git
   cd vscode-llm-multi-provider
```

2. Install dependencies:
```bash
   npm install
```

3. Compile TypeScript:
```bash
   npm run compile
```

4. Press **F5** in VS Code to open Extension Development Host.

## Usage

### 1. Set API Keys

Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:
LLM: Set API Keys

Enter your API keys when prompted. Keys are stored securely in VS Code's `SecretStorage` and never written to disk in plaintext.

### 2. Select Provider

Run:
LLM: Select Provider

Choose from:
- `openai` (default: `gpt-4o`)
- `anthropic` (default: `claude-sonnet-4-5`)
- `deepseek` (default: `deepseek-chat`)

### 3. Ask Questions

Run:
LLM: Ask Question

Type your prompt. The response streams to the **LLM Response** output channel.

## Architecture
┌─────────────────────────────────────────┐
│          VS Code Extension              │
├─────────────────────────────────────────┤
│  Commands: ask, setKeys, selectProvider │
├─────────────────────────────────────────┤
│         LLMProvider Interface           │
│  - sendPrompt(prompt, options)          │
│  - streamResponse(prompt, onChunk, opts)│
├─────────────────────────────────────────┤
│  OpenAIClient  │ AnthropicClient        │
│  (+ DeepSeek)  │                        │
└─────────────────────────────────────────┘
│                  │
▼                  ▼
OpenAI SDK      Anthropic SDK

### Why DeepSeek uses OpenAI SDK

DeepSeek's API is **OpenAI-compatible**. Instead of adding an `axios` dependency, this extension instantiates the OpenAI SDK with a custom `baseURL`:

```typescript
new OpenAI({
  apiKey: deepseekKey,
  baseURL: 'https://api.deepseek.com/v1'
});
```

**Source:** https://github.com/openai/openai-node#custom-urls

## API Key Security

- Keys are stored in **VS Code SecretStorage** (encrypted at rest)
- Keys are **never logged** or written to files
- Keys are **never transmitted** except to official provider endpoints over HTTPS

## Model Defaults

| Provider   | Default Model         |
|------------|-----------------------|
| OpenAI     | `gpt-4o`              |
| Anthropic  | `claude-sonnet-4-5`   |
| DeepSeek   | `deepseek-chat`       |

Models can be overridden via `LLMOptions` in code (UI config coming soon).

## Development

### Compile
```bash
npm run compile
```

### Watch Mode
```bash
npm run watch
```

### Lint
```bash
npm run lint
```

## Publishing

To package as `.vsix`:

```bash
npm install -g vsce
vsce package
```

Install locally:

```bash
code --install-extension vscode-llm-multi-provider-0.1.0.vsix
```

## License

MIT

## Contributing

PRs welcome. All contributions must maintain the compliance foundation: **official APIs only**.