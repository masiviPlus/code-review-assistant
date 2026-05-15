import { GeminiClient } from '../src/services/llm/GeminiClient';
import { AnalysisResult } from '../src/services/llm/types';
import { createLLMClient } from '../src/services/llm/factory';
import type { Env } from '../src/config/env';

const VALID_RESULT: AnalysisResult = {
  scoreOverall: 72,
  scoreBreakdown: { style: 70, bestPractices: 65, logic: 80, readability: 73 },
  issues: [
    {
      severity: 'warning',
      category: 'style',
      lineNumber: 1,
      message: 'Use const instead of let',
      suggestion: 'Replace let with const.',
    },
  ],
  summary: 'Decent code with minor style issues.',
};

function mockGeminiResponse(text: string) {
  return {
    text,
    usageMetadata: { candidatesTokenCount: 150 },
  };
}

function createClientWithMock(generateContentFn: jest.Mock) {
  const client = new GeminiClient('fake-api-key', 'gemini-2.5-flash');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).client = {
    models: { generateContent: generateContentFn },
  };
  return client;
}

// ── GeminiClient ─────────────────────────────────────────────

describe('GeminiClient', () => {
  it('parses a valid JSON response', async () => {
    const mockGenerate = jest.fn().mockResolvedValue(
      mockGeminiResponse(JSON.stringify(VALID_RESULT)),
    );
    const client = createClientWithMock(mockGenerate);

    const result = await client.analyseCode('const x = 1;', 'javascript');

    expect(result).toEqual(VALID_RESULT);
    expect(mockGenerate).toHaveBeenCalledTimes(1);

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-2.5-flash');
    expect(callArgs.config.systemInstruction).toContain('senior JavaScript code reviewer');
    expect(callArgs.config.responseMimeType).toBe('application/json');
  });

  it('strips markdown code fences from response', async () => {
    const wrapped = '```json\n' + JSON.stringify(VALID_RESULT) + '\n```';
    const mockGenerate = jest.fn().mockResolvedValue(
      mockGeminiResponse(wrapped),
    );
    const client = createClientWithMock(mockGenerate);

    const result = await client.analyseCode('const x = 1;', 'javascript');

    expect(result).toEqual(VALID_RESULT);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('retries once when first response is invalid JSON', async () => {
    const mockGenerate = jest
      .fn()
      .mockResolvedValueOnce(mockGeminiResponse('Here is the review: {invalid'))
      .mockResolvedValueOnce(mockGeminiResponse(JSON.stringify(VALID_RESULT)));

    const client = createClientWithMock(mockGenerate);

    const result = await client.analyseCode('let x = 1;', 'javascript');

    expect(result).toEqual(VALID_RESULT);
    expect(mockGenerate).toHaveBeenCalledTimes(2);

    // Retry should include the corrective message
    const retryCall = mockGenerate.mock.calls[1][0];
    const lastContent = retryCall.contents.at(-1);
    expect(lastContent.parts[0].text).toContain('not valid JSON');
  });

  it('throws when both attempts return invalid JSON', async () => {
    const mockGenerate = jest
      .fn()
      .mockResolvedValueOnce(mockGeminiResponse('not json'))
      .mockResolvedValueOnce(mockGeminiResponse('still not json'));

    const client = createClientWithMock(mockGenerate);

    await expect(
      client.analyseCode('const x = 1;', 'javascript'),
    ).rejects.toThrow();

    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('throws when code exceeds 10,000 characters', async () => {
    const mockGenerate = jest.fn();
    const client = createClientWithMock(mockGenerate);

    await expect(
      client.analyseCode('x'.repeat(10_001), 'javascript'),
    ).rejects.toThrow('exceeds maximum length');

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('includes few-shot examples with Gemini role mapping', async () => {
    const mockGenerate = jest.fn().mockResolvedValue(
      mockGeminiResponse(JSON.stringify(VALID_RESULT)),
    );
    const client = createClientWithMock(mockGenerate);

    await client.analyseCode('const x = 1;', 'javascript');

    const callArgs = mockGenerate.mock.calls[0][0];
    // 4 few-shot + 1 actual = 5 contents
    expect(callArgs.contents).toHaveLength(5);
    expect(callArgs.contents[0].role).toBe('user');
    expect(callArgs.contents[1].role).toBe('model'); // assistant → model
    expect(callArgs.contents[2].role).toBe('user');
    expect(callArgs.contents[3].role).toBe('model');
    expect(callArgs.contents[4].role).toBe('user');
  });

  it('passes the language in the user message', async () => {
    const mockGenerate = jest.fn().mockResolvedValue(
      mockGeminiResponse(JSON.stringify(VALID_RESULT)),
    );
    const client = createClientWithMock(mockGenerate);

    await client.analyseCode('const x = 1;', 'typescript');

    const lastContent = mockGenerate.mock.calls[0][0].contents.at(-1);
    expect(lastContent.parts[0].text).toContain('typescript');
    expect(lastContent.parts[0].text).toContain('```typescript');
  });

  it('validates score ranges', async () => {
    const badScores = { ...VALID_RESULT, scoreOverall: 150 };
    const mockGenerate = jest
      .fn()
      .mockResolvedValue(mockGeminiResponse(JSON.stringify(badScores)));

    const client = createClientWithMock(mockGenerate);

    await expect(
      client.analyseCode('const x = 1;', 'javascript'),
    ).rejects.toThrow();
  });
});

// ── Factory ──────────────────────────────────────────────────

describe('createLLMClient (gemini)', () => {
  const baseEnv: Env = {
    PORT: 4000,
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost:27017/test',
    LOG_LEVEL: 'info',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    JWT_ACCESS_SECRET: 'test',
    JWT_REFRESH_SECRET: 'test',
    LLM_PROVIDER: 'gemini',
    ANTHROPIC_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
  };

  it('returns GeminiClient when provider is gemini and key is present', () => {
    const client = createLLMClient({ ...baseEnv, GEMINI_API_KEY: 'test-key' });
    expect(client).toBeInstanceOf(GeminiClient);
  });

  it('throws when provider is gemini but key is missing', () => {
    expect(() => createLLMClient({ ...baseEnv, GEMINI_API_KEY: undefined }))
      .toThrow('GEMINI_API_KEY is required');
  });
});
