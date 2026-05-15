import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import { z } from 'zod';
import { AnalysisResult, LLMClient } from './types';
import { REVIEW_SYSTEM_PROMPT, buildReviewMessages, RETRY_MESSAGE } from './prompts/review';

const logger = pino({ name: 'claude-client' });

const MAX_CODE_LENGTH = 10_000;

const analysisResultSchema = z.object({
  scoreOverall: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    style: z.number().min(0).max(100),
    bestPractices: z.number().min(0).max(100),
    logic: z.number().min(0).max(100),
    readability: z.number().min(0).max(100),
  }),
  issues: z.array(
    z.object({
      severity: z.enum(['info', 'warning', 'error']),
      category: z.enum(['style', 'best_practice', 'logic', 'readability']),
      lineNumber: z.number().nullable(),
      message: z.string(),
      suggestion: z.string(),
    }),
  ),
  summary: z.string(),
});

function extractText(response: Anthropic.Message): string {
  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text.trim() : '';
}

function parseAnalysisJSON(raw: string): AnalysisResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  return analysisResultSchema.parse(parsed);
}

export class ClaudeClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyseCode(code: string, language: string): Promise<AnalysisResult> {
    if (code.length > MAX_CODE_LENGTH) {
      throw new Error(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
    }

    const messages = buildReviewMessages(code, language);
    const start = performance.now();

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: REVIEW_SYSTEM_PROMPT,
      messages,
    });

    const latency = Math.round(performance.now() - start);
    logger.info({ latency, model: 'claude-sonnet-4-20250514' }, 'Claude API call completed');

    const raw = extractText(response);

    try {
      return parseAnalysisJSON(raw);
    } catch {
      logger.warn({ raw }, 'First response was not valid JSON, retrying');
    }

    const retryResponse = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: REVIEW_SYSTEM_PROMPT,
      messages: [
        ...messages,
        { role: 'assistant' as const, content: raw },
        RETRY_MESSAGE,
      ],
    });

    const retryLatency = Math.round(performance.now() - start);
    logger.info({ latency: retryLatency, retry: true }, 'Claude API retry completed');

    const retryRaw = extractText(retryResponse);
    return parseAnalysisJSON(retryRaw);
  }
}
