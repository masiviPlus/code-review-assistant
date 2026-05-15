import { AnalysisResult, LLMClient } from './types';

export class FakeLLMClient implements LLMClient {
  async analyseCode(code: string): Promise<AnalysisResult> {
    const lines = code.split('\n');

    const scoreBreakdown = {
      style: 72,
      bestPractices: 65,
      logic: 80,
      readability: 78,
    };

    const scoreOverall = Math.round(
      (scoreBreakdown.style +
        scoreBreakdown.bestPractices +
        scoreBreakdown.logic +
        scoreBreakdown.readability) /
        4,
    );

    return {
      scoreOverall,
      scoreBreakdown,
      issues: [
        {
          severity: 'warning',
          category: 'style',
          lineNumber: 1,
          message: 'Consider using descriptive variable names',
          suggestion: 'Rename short variable names to reflect their purpose.',
        },
        {
          severity: 'info',
          category: 'best_practice',
          lineNumber: Math.min(lines.length, 3),
          message: 'Use const instead of let when the variable is never reassigned',
          suggestion: 'Replace let with const for variables that do not change.',
        },
        {
          severity: 'error',
          category: 'logic',
          lineNumber: Math.min(lines.length, 5),
          message: 'Potential null reference detected',
          suggestion: 'Add a null check before accessing the property.',
        },
      ],
      summary: 'The code has some style and logic issues. Consider using descriptive names and adding null checks.',
    };
  }
}
