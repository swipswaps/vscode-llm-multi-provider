// PATH: src/openai-client.ts
// WHAT: OpenAI and DeepSeek client using official openai SDK
// WHY: DeepSeek API is OpenAI-compatible — baseURL override avoids axios dependency
// MENTAL MODEL BEFORE: separate axios client for DeepSeek
// MENTAL MODEL AFTER: single SDK handles both via baseURL parameter
// FAILURE MODE: apiKey not set — sendPrompt throws 401 error
// VERIFIES WITH: streaming produces multiple onChunk calls before resolve

import OpenAI from 'openai';
import { LLMProvider, LLMOptions } from './provider';

export class OpenAIClient implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    // WHY: baseURL override allows DeepSeek to reuse OpenAI SDK
    // Source (Tier 2): OpenAI SDK custom URLs
    //   https://github.com/openai/openai-node#custom-urls
    this.client = new OpenAI({
      apiKey,
      ...(baseURL && { baseURL })
    });
  }

  async sendPrompt(prompt: string, options?: LLMOptions): Promise<string> {
    // WHY: chat.completions.create is the standard endpoint for text generation
    // Source (Tier 2): OpenAI API Reference — Create chat completion
    //   https://platform.openai.com/docs/api-reference/chat/create
    const response = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature || 0.7
    });

    return response.choices[0]?.message?.content || '';
  }

  async streamResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: LLMOptions
  ): Promise<void> {
    // WHY: stream: true enables Server-Sent Events response
    // Source (Tier 2): OpenAI API Reference — Streaming
    //   https://platform.openai.com/docs/api-reference/streaming
    const stream = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature || 0.7,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        onChunk(content);
      }
    }
  }
}
