import Anthropic from '@anthropic-ai/sdk';
import { AnalysisResult, LLMClient } from './types';

export class ClaudeClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyseCode(_code: string, _language: string): Promise<AnalysisResult> {
    // TODO: wire up actual Claude API call with structured prompt
    // For now, throw so we don't accidentally call this without implementation
    void this.client;
    throw new Error('ClaudeClient.analyseCode is not yet implemented');
  }
}
