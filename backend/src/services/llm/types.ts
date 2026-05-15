export interface AnalysisIssue {
  severity: 'info' | 'warning' | 'error';
  category: 'style' | 'best_practice' | 'logic' | 'readability';
  lineNumber: number | null;
  message: string;
  suggestion: string;
}

export interface ScoreBreakdown {
  style: number;
  bestPractices: number;
  logic: number;
  readability: number;
}

export interface AnalysisResult {
  scoreOverall: number;
  scoreBreakdown: ScoreBreakdown;
  issues: AnalysisIssue[];
  summary: string;
}

export interface LLMClient {
  analyseCode(code: string, language: string): Promise<AnalysisResult>;
}
