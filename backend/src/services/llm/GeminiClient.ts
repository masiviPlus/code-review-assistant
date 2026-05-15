import { GoogleGenAI } from '@google/genai';
import pino from 'pino';
import { z } from 'zod';
import { AnalysisResult, LLMClient } from './types';
import { REVIEW_SYSTEM_PROMPT, buildReviewMessages, RETRY_MESSAGE } from './prompts/review';

const logger = pino({ name: 'gemini-client' });

const MAX_CODE_LENGTH = 10_000;
const TIMEOUT_MS = 30_000;

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

function parseAnalysisJSON(raw: string): AnalysisResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  return analysisResultSchema.parse(parsed);
}

function buildGeminiContents(messages: Array<{ role: string; content: string }>) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

export class GeminiClient implements LLMClient {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async analyseCode(code: string, language: string): Promise<AnalysisResult> {
    if (code.length > MAX_CODE_LENGTH) {
      throw new Error(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
    }

    const messages = buildReviewMessages(code, language);
    const contents = buildGeminiContents(messages);
    const start = performance.now();
    let retryCount = 0;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: REVIEW_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          abortSignal: controller.signal,
        },
      });

      const duration = Math.round(performance.now() - start);
      const raw = response.text?.trim() ?? '';

      logger.info({
        provider: 'gemini',
        model: this.model,
        input_chars: code.length,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? null,
        duration_ms: duration,
        retry_count: retryCount,
      }, 'Gemini API call completed');

      try {
        return parseAnalysisJSON(raw);
      } catch {
        logger.warn({ raw }, 'First response was not valid JSON, retrying');
      }

      // Retry once with corrective message
      retryCount = 1;
      const retryContents = [
        ...contents,
        { role: 'model', parts: [{ text: raw }] },
        { role: 'user', parts: [{ text: RETRY_MESSAGE.content }] },
      ];

      const retryController = new AbortController();
      const retryTimer = setTimeout(() => retryController.abort(), TIMEOUT_MS);

      try {
        const retryResponse = await this.client.models.generateContent({
          model: this.model,
          contents: retryContents,
          config: {
            systemInstruction: REVIEW_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            abortSignal: retryController.signal,
          },
        });

        const retryDuration = Math.round(performance.now() - start);
        const retryRaw = retryResponse.text?.trim() ?? '';

        logger.info({
          provider: 'gemini',
          model: this.model,
          input_chars: code.length,
          output_tokens: retryResponse.usageMetadata?.candidatesTokenCount ?? null,
          duration_ms: retryDuration,
          retry_count: retryCount,
        }, 'Gemini API retry completed');

        return parseAnalysisJSON(retryRaw);
      } finally {
        clearTimeout(retryTimer);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
