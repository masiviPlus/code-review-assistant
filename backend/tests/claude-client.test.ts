import { ClaudeClient } from '../src/services/llm/ClaudeClient';
import { AnalysisResult } from '../src/services/llm/types';

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

function mockAnthropicResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    id: 'msg_mock',
    model: 'claude-sonnet-4-20250514',
    role: 'assistant' as const,
    stop_reason: 'end_turn' as const,
    stop_sequence: null,
    type: 'message' as const,
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}

function createClientWithMock(createFn: jest.Mock) {
  const client = new ClaudeClient('fake-api-key');
  // Replace the internal Anthropic client's messages.create
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).client = { messages: { create: createFn } };
  return client;
}

describe('ClaudeClient', () => {
  it('parses a valid JSON response', async () => {
    const mockCreate = jest.fn().mockResolvedValue(
      mockAnthropicResponse(JSON.stringify(VALID_RESULT)),
    );
    const client = createClientWithMock(mockCreate);

    const result = await client.analyseCode('const x = 1;', 'javascript');

    expect(result).toEqual(VALID_RESULT);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-20250514');
    expect(callArgs.system).toContain('senior JavaScript code reviewer');
    expect(callArgs.messages.at(-1).content).toContain('const x = 1;');
  });

  it('strips markdown code fences from response', async () => {
    const wrapped = '```json\n' + JSON.stringify(VALID_RESULT) + '\n```';
    const mockCreate = jest.fn().mockResolvedValue(
      mockAnthropicResponse(wrapped),
    );
    const client = createClientWithMock(mockCreate);

    const result = await client.analyseCode('const x = 1;', 'javascript');

    expect(result).toEqual(VALID_RESULT);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('retries once when first response is invalid JSON', async () => {
    const mockCreate = jest
      .fn()
      .mockResolvedValueOnce(mockAnthropicResponse('Here is the review: {invalid'))
      .mockResolvedValueOnce(mockAnthropicResponse(JSON.stringify(VALID_RESULT)));

    const client = createClientWithMock(mockCreate);

    const result = await client.analyseCode('let x = 1;', 'javascript');

    expect(result).toEqual(VALID_RESULT);
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Retry message should include the failed response and the retry instruction
    const retryCall = mockCreate.mock.calls[1][0];
    const lastMessage = retryCall.messages.at(-1);
    expect(lastMessage.content).toContain('not valid JSON');
  });

  it('throws when both attempts return invalid JSON', async () => {
    const mockCreate = jest
      .fn()
      .mockResolvedValueOnce(mockAnthropicResponse('not json at all'))
      .mockResolvedValueOnce(mockAnthropicResponse('still not json'));

    const client = createClientWithMock(mockCreate);

    await expect(
      client.analyseCode('const x = 1;', 'javascript'),
    ).rejects.toThrow();

    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('throws when response has valid JSON but wrong shape', async () => {
    const wrongShape = JSON.stringify({ score: 50, feedback: 'nice' });
    const mockCreate = jest
      .fn()
      .mockResolvedValue(mockAnthropicResponse(wrongShape));

    const client = createClientWithMock(mockCreate);

    // First call returns wrong shape, retry also returns wrong shape
    await expect(
      client.analyseCode('const x = 1;', 'javascript'),
    ).rejects.toThrow();
  });

  it('throws when code exceeds 10,000 characters', async () => {
    const mockCreate = jest.fn();
    const client = createClientWithMock(mockCreate);

    await expect(
      client.analyseCode('x'.repeat(10_001), 'javascript'),
    ).rejects.toThrow('exceeds maximum length');

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('includes few-shot examples in the messages', async () => {
    const mockCreate = jest.fn().mockResolvedValue(
      mockAnthropicResponse(JSON.stringify(VALID_RESULT)),
    );
    const client = createClientWithMock(mockCreate);

    await client.analyseCode('const x = 1;', 'javascript');

    const callArgs = mockCreate.mock.calls[0][0];
    // 4 few-shot messages (2 user + 2 assistant) + 1 actual user message = 5
    expect(callArgs.messages).toHaveLength(5);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[1].role).toBe('assistant');
    expect(callArgs.messages[2].role).toBe('user');
    expect(callArgs.messages[3].role).toBe('assistant');
    expect(callArgs.messages[4].role).toBe('user');
  });

  it('validates score ranges', async () => {
    const badScores = {
      ...VALID_RESULT,
      scoreOverall: 150,
    };
    const mockCreate = jest
      .fn()
      .mockResolvedValue(mockAnthropicResponse(JSON.stringify(badScores)));

    const client = createClientWithMock(mockCreate);

    // First parse fails validation, retry also returns bad scores
    await expect(
      client.analyseCode('const x = 1;', 'javascript'),
    ).rejects.toThrow();
  });

  it('passes the language in the user message', async () => {
    const mockCreate = jest.fn().mockResolvedValue(
      mockAnthropicResponse(JSON.stringify(VALID_RESULT)),
    );
    const client = createClientWithMock(mockCreate);

    await client.analyseCode('const x = 1;', 'typescript');

    const lastMsg = mockCreate.mock.calls[0][0].messages.at(-1);
    expect(lastMsg.content).toContain('typescript');
    expect(lastMsg.content).toContain('```typescript');
  });
});
