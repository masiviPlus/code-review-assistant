import { applyScoring } from '../src/services/scoring';
import type { AnalysisResult, AnalysisIssue } from '../src/services/llm/types';

function makeResult(
  scoreOverall: number,
  issues: AnalysisIssue[] = [],
): AnalysisResult {
  return {
    scoreOverall,
    scoreBreakdown: { style: 70, bestPractices: 65, logic: 80, readability: 73 },
    issues,
    summary: 'Test summary.',
  };
}

function makeIssue(severity: AnalysisIssue['severity']): AnalysisIssue {
  return {
    severity,
    category: 'style',
    lineNumber: 1,
    message: `A ${severity} issue`,
    suggestion: 'Fix it.',
  };
}

describe('applyScoring', () => {
  it('returns the raw score when there are no issues and code < 50 lines', () => {
    const result = applyScoring(makeResult(80), 10);
    expect(result.scoreOverall).toBe(80);
  });

  it('subtracts 15 per error issue', () => {
    const result = applyScoring(
      makeResult(80, [makeIssue('error'), makeIssue('error')]),
      10,
    );
    expect(result.scoreOverall).toBe(50); // 80 - 30
  });

  it('subtracts 5 per warning issue', () => {
    const result = applyScoring(
      makeResult(80, [makeIssue('warning'), makeIssue('warning'), makeIssue('warning')]),
      10,
    );
    expect(result.scoreOverall).toBe(65); // 80 - 15
  });

  it('subtracts 1 per info issue', () => {
    const result = applyScoring(
      makeResult(80, [makeIssue('info'), makeIssue('info')]),
      10,
    );
    expect(result.scoreOverall).toBe(78); // 80 - 2
  });

  it('applies mixed penalties correctly', () => {
    const result = applyScoring(
      makeResult(90, [makeIssue('error'), makeIssue('warning'), makeIssue('info')]),
      10,
    );
    expect(result.scoreOverall).toBe(69); // 90 - 15 - 5 - 1
  });

  it('caps score at 0 (never negative)', () => {
    const result = applyScoring(
      makeResult(20, [makeIssue('error'), makeIssue('error')]),
      10,
    );
    expect(result.scoreOverall).toBe(0); // 20 - 30 → 0
  });

  it('awards +5 bonus for code ≥ 50 lines with no errors', () => {
    const result = applyScoring(makeResult(80), 50);
    expect(result.scoreOverall).toBe(85); // 80 + 5
  });

  it('awards bonus even with warnings/info (just no errors)', () => {
    const result = applyScoring(
      makeResult(80, [makeIssue('warning'), makeIssue('info')]),
      60,
    );
    expect(result.scoreOverall).toBe(79); // 80 - 5 - 1 + 5
  });

  it('does not award bonus when errors exist even if code ≥ 50 lines', () => {
    const result = applyScoring(
      makeResult(80, [makeIssue('error')]),
      100,
    );
    expect(result.scoreOverall).toBe(65); // 80 - 15, no bonus
  });

  it('does not award bonus for code < 50 lines even with no errors', () => {
    const result = applyScoring(makeResult(80), 49);
    expect(result.scoreOverall).toBe(80);
  });

  it('does not mutate the original result', () => {
    const original = makeResult(80, [makeIssue('error')]);
    const adjusted = applyScoring(original, 10);
    expect(original.scoreOverall).toBe(80);
    expect(adjusted.scoreOverall).toBe(65);
  });

  it('preserves all other fields from the raw result', () => {
    const original = makeResult(80, [makeIssue('warning')]);
    const adjusted = applyScoring(original, 10);
    expect(adjusted.scoreBreakdown).toEqual(original.scoreBreakdown);
    expect(adjusted.issues).toEqual(original.issues);
    expect(adjusted.summary).toBe(original.summary);
  });

  it('handles exactly 50 lines as qualifying for the bonus', () => {
    const result = applyScoring(makeResult(70), 50);
    expect(result.scoreOverall).toBe(75); // 70 + 5
  });
});
