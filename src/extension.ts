// PATH: src/extension.ts
// WHAT: VS Code extension entry point — command registration and provider management
// WHY: activates on first llm.* command, stores provider instances, routes to active provider
// MENTAL MODEL BEFORE: no providers instantiated
// MENTAL MODEL AFTER: providers created from stored API keys, activeProvider set
// FAILURE MODE: secrets.get returns undefined — user must run llm.setKeys first
// VERIFIES WITH: Command Palette shows "LLM: Ask Question" after activation

import * as vscode from 'vscode';
import { LLMProvider } from './provider';
import { OpenAIClient } from './openai-client';
import { AnthropicClient } from './anthropic-client';

let activeProvider: LLMProvider | undefined;
let providerName: string = 'openai';

export async function activate(context: vscode.ExtensionContext) {
  // WHY: initialize providers from stored keys on activation
  // FAILURE MODE: if keys not set, activeProvider remains undefined — handled in llm.ask
  await initializeProviders(context);

  // WHY: llm.setKeys command stores API keys in VS Code SecretStorage
  // Source (Tier 2): VS Code SecretStorage API
  //   https://code.visualstudio.com/api/references/vscode-api#SecretStorage
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

  // WHY: llm.selectProvider switches active provider
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

  // WHY: llm.ask prompts user for input and streams response to output channel
  // MENTAL MODEL: user types prompt → provider streams chunks → output channel displays
  // FAILURE MODE: activeProvider undefined → show error message
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

      // WHY: output channel provides append-only display for streaming responses
      // NOTE: createOutputChannel is one-way — each appendLine adds new line.
      //       For in-place streaming updates, WebviewPanel is required.
      // Source (Tier 2): VS Code OutputChannel API
      //   https://code.visualstudio.com/api/references/vscode-api#OutputChannel
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

async function initializeProviders(context: vscode.ExtensionContext) {
  // WHY: secrets.get retrieves stored API keys — undefined if not set
  // Source (Tier 2): VS Code SecretStorage.get
  //   https://code.visualstudio.com/api/references/vscode-api#SecretStorage
  const openaiKey = await context.secrets.get('openaiKey');
  const anthropicKey = await context.secrets.get('anthropicKey');
  const deepseekKey = await context.secrets.get('deepseekKey');

  // WHY: instantiate active provider based on providerName
  // DeepSeek uses OpenAI SDK with baseURL override
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
