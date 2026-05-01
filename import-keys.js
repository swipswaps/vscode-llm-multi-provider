// PATH: import-keys.js
// WHAT: Node.js script to import keys from .vscode-llm-keys.json into VS Code SecretStorage
// WHY: VS Code SecretStorage API only accessible from extension context, not shell
// MENTAL MODEL: setup.sh writes keys to JSON → extension calls this on first run → keys in SecretStorage
// FAILURE MODE: .vscode-llm-keys.json missing → script exits silently (user runs LLM: Set API Keys manually)
// VERIFIES WITH: .vscode-llm-keys.json deleted after successful import

const fs = require('fs');
const path = require('path');

const KEYFILE = path.join(__dirname, '.vscode-llm-keys.json');

// WHY: check if key file exists before attempting read
// FAILURE MODE: file missing → normal case when keys set manually
if (!fs.existsSync(KEYFILE)) {
    console.log('No key import file found — keys must be set manually via LLM: Set API Keys');
    process.exit(0);
}

// WHY: read and parse key file
// ASSUMES: JSON format matches setup.sh output
try {
    const keys = JSON.parse(fs.readFileSync(KEYFILE, 'utf8'));
    
    // WHY: VS Code SecretStorage write must happen from extension context
    // This script just validates the file exists and is readable
    // Actual import happens in src/extension.ts activate() function
    console.log('Key file valid. Extension will import on next activation.');
    console.log(`OpenAI: ${keys.openai ? '✓ present' : '✗ missing'}`);
    console.log(`Anthropic: ${keys.anthropic ? '✓ present' : '✗ missing'}`);
    console.log(`DeepSeek: ${keys.deepseek ? '✓ present' : '✗ missing'}`);
    
} catch (error) {
    console.error('Error reading key file:', error.message);
    process.exit(1);
}
