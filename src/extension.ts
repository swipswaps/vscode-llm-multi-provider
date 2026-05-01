// PATH: src/extension.ts
// WHAT: VS Code extension entry point with auto-import from setup.sh
// WHY: eliminates manual key entry step — setup.sh writes JSON, extension imports on activate
// MENTAL MODEL: .vscode-llm-keys.json present → auto-import → delete file → keys in SecretStorage
// FAILURE MODE: key file missing → user must run LLM: Set API Keys manually (expected behavior)
// VERIFIES WITH: LLM: Ask Question works immediately after F5

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LLMProvider } from './provider';
import { OpenAIClient } from './openai-client';
import { AnthropicClient } from './anthropic-client';

let activeProvider: LLMProvider | undefined;
let providerName: string = 'openai';

export async function activate(context: vscode.ExtensionContext) {
  // WHY: auto-import keys from setup.sh if key file exists
  // Source (Tier 2): VS Code SecretStorage.store
  //   https://code.visualstudio.com/api/references/vscode-api#SecretStorage
  await autoImportKeysFromSetup(context);
  
  // WHY: initialize providers from stored keys on activation
  await initializeProviders(context);

  // WHY: llm.setKeys command stores API keys in VS Code SecretStorage
  context.subscriptions.push(
    vscode.commands.registerCommand('llm.setKeys', async () => {
      const openaiKey = await vscode.window.showInputBox({
        prompt: 'Enter OpenAI API Key (or leave empty)',
        password: true
      });
      const anthropicKey = await vscode.window.showInputBox({
        prompt: 'Enter Anthropic API Key (or leave empty)',
        password: true
      });
      const deepseekKey = await vscode.window.showInputBox({
        prompt: 'Enter DeepSeek API Key (or leave empty)',
        password: true
      });

      if (openaiKey) await context.secrets.store('openaiKey', openaiKey);
      if (anthropicKey) await context.secrets.store('anthropicKey', anthropicKey);
      if (deepseekKey) await context.secrets.store('deepseekKey', deepseekKey);

      await initializeProviders(context);
      vscode.window.showInformationMessage('API keys saved');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('llm.selectProvider', async () => {
      const choice = await vscode.window.showQuickPick(
        ['openai', 'anthropic', 'deepseek'],
        { placeHolder: 'Select LLM provider' }
      );
      if (choice) {
        providerName = choice;
        await initializeProviders(context);
        vscode.window.showInformationMessage(`Switched to ${choice}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('llm.ask', async () => {
      if (!activeProvider) {
        vscode.window.showErrorMessage('No provider configured. Run "LLM: Set API Keys" first.');
        return;
      }

      const prompt = await vscode.window.showInputBox({
        prompt: 'Enter your question',
        placeHolder: 'What would you like to ask?'
      });

      if (!prompt) return;

      const output = vscode.window.createOutputChannel('LLM Response');
      output.show();
      output.appendLine(`[${providerName}] ${prompt}\n`);

      try {
        await activeProvider.streamResponse(prompt, (chunk) => {
          output.append(chunk);
        });
        output.appendLine('\n---');
      } catch (error) {
        output.appendLine(`\nError: ${error}`);
      }
    })
  );
}

// WHY: auto-import keys from .vscode-llm-keys.json if present
// MENTAL MODEL: setup.sh creates key file → extension imports → deletes file
// FAILURE MODE: file missing → silent no-op (expected when keys set manually)
async function autoImportKeysFromSetup(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) return;

  const keyFilePath = path.join(workspaceFolder, '.vscode-llm-keys.json');
  
  if (!fs.existsSync(keyFilePath)) return;

  try {
    const keyData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    
    if (keyData.openai) await context.secrets.store('openaiKey', keyData.openai);
    if (keyData.anthropic) await context.secrets.store('anthropicKey', keyData.anthropic);
    if (keyData.deepseek) await context.secrets.store('deepseekKey', keyData.deepseek);
    
    // WHY: delete key file after successful import for security
    // Source (Tier 2): fs.unlinkSync removes file synchronously
    //   https://nodejs.org/api/fs.html#fsunlinksyncpath
    fs.unlinkSync(keyFilePath);
    
    vscode.window.showInformationMessage('API keys imported from setup.sh');
  } catch (error) {
    console.error('Failed to import keys from setup:', error);
  }
}

async function initializeProviders(context: vscode.ExtensionContext) {
  const openaiKey = await context.secrets.get('openaiKey');
  const anthropicKey = await context.secrets.get('anthropicKey');
  const deepseekKey = await context.secrets.get('deepseekKey');

  switch (providerName) {
    case 'openai':
      if (openaiKey) activeProvider = new OpenAIClient(openaiKey);
      break;
    case 'anthropic':
      if (anthropicKey) activeProvider = new AnthropicClient(anthropicKey);
      break;
    case 'deepseek':
      if (deepseekKey) {
        activeProvider = new OpenAIClient(deepseekKey, 'https://api.deepseek.com/v1');
      }
      break;
  }
}

export function deactivate() {}
