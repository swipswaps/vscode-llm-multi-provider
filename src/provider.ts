// PATH: src/provider.ts
// WHAT: unified interface for all LLM providers
// WHY: abstracts provider-specific SDK differences — OpenAI, Anthropic, DeepSeek
//      all expose different APIs but share the same user-facing contract
// MENTAL MODEL: single interface implemented by three concrete clients
// FAILURE MODE: missing method in implementation breaks provider switching
// VERIFIES WITH: TypeScript compiler enforces method presence at build time

export interface LLMProvider {
  /**
   * Send a single prompt and return the complete response.
   * Blocks until generation completes.
   */
  sendPrompt(prompt: string, options?: LLMOptions): Promise<string>;

  /**
   * Stream a response chunk-by-chunk via callback.
   * Returns when generation completes.
   */
  streamResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: LLMOptions
  ): Promise<void>;
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}
