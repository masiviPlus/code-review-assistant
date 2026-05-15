import type { AnalysisResult } from './llm/types';

const PENALTY: Record<string, number> = {
  error: 15,
  warning: 5,
  info: 1,
};

const CLEAN_CODE_BONUS = 5;
const CLEAN_CODE_MIN_LINES = 50;

/**
 * Applies deterministic scoring rules on top of the raw LLM scores.
 *
 * Penalties per issue severity:
 *   error   → −15
 *   warning → −5
 *   info    → −1
 *
 * Bonus: +5 if code is ≥ 50 lines and has zero error-level issues.
 * Floor: score is capped at 0 (never negative).
 */
export function applyScoring(
  raw: AnalysisResult,
  codeLineCount: number,
): AnalysisResult {
  let adjusted = raw.scoreOverall;

  for (const issue of raw.issues) {
    adjusted -= PENALTY[issue.severity] ?? 0;
  }

  const hasErrors = raw.issues.some((i) => i.severity === 'error');
  if (codeLineCount >= CLEAN_CODE_MIN_LINES && !hasErrors) {
    adjusted += CLEAN_CODE_BONUS;
  }

  adjusted = Math.max(adjusted, 0);

  return { ...raw, scoreOverall: adjusted };
}
