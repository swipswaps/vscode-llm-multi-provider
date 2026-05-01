// PATH: src/anthropic-client.ts
// WHAT: Anthropic Claude client using official SDK
// WHY: Messages API is the standard endpoint for Claude models
// MENTAL MODEL: messages array format differs from OpenAI but interface is unified
// FAILURE MODE: max_tokens missing — API returns 400 "max_tokens is required"
// VERIFIES WITH: sendPrompt returns non-empty string on valid apiKey

import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMOptions } from './provider';

export class AnthropicClient implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async sendPrompt(prompt: string, options?: LLMOptions): Promise<string> {
    // WHY: messages.create is the Messages API entry point
    // max_tokens is required by Anthropic (no default)
    // Source (Tier 2): Anthropic Messages API Reference
    //   https://docs.anthropic.com/en/api/messages
    const message = await this.client.messages.create({
      model: options?.model || 'claude-sonnet-4-5',
      max_tokens: options?.maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    // WHY: response.content is an array — extract text block
    // Source (Tier 2): Anthropic Messages API — Response format
    //   https://docs.anthropic.com/en/api/messages#response
    const textBlock = message.content.find(block => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  async streamResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: LLMOptions
  ): Promise<void> {
    // WHY: stream method enables Server-Sent Events
    // Source (Tier 2): Anthropic Streaming API
    //   https://docs.anthropic.com/en/api/messages-streaming
    const stream = await this.client.messages.stream({
      model: options?.model || 'claude-sonnet-4-5',
      max_tokens: options?.maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text);
      }
    }
  }
}
