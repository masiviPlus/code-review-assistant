import type { Env } from '../../config/env';
import type { LLMClient } from './types';
import { FakeLLMClient } from './FakeLLMClient';
import { ClaudeClient } from './ClaudeClient';
import { GeminiClient } from './GeminiClient';

export function createLLMClient(env: Env): LLMClient {
  switch (env.LLM_PROVIDER) {
    case 'claude':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER is "claude"');
      }
      return new ClaudeClient(env.ANTHROPIC_API_KEY);
    case 'gemini':
      if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER is "gemini"');
      }
      return new GeminiClient(env.GEMINI_API_KEY);
    case 'fake':
      return new FakeLLMClient();
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${env.LLM_PROVIDER as string}`);
  }
}
