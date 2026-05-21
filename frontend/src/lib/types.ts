/* ------------------------------------------------------------------ */
/*  Shared types used across multiple pages                            */
/* ------------------------------------------------------------------ */

export interface ScoreBreakdown {
  style: number;
  bestPractices: number;
  logic: number;
  readability: number;
}

export interface Submission {
  _id: string;
  code: string;
  language: string;
  status: string;
  scoreOverall?: number;
  scoreBreakdown?: ScoreBreakdown;
  summary?: string;
  createdAt: string;
}

export interface Issue {
  _id: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  lineNumber: number | null;
  message: string;
  suggestion: string;
}

export interface SubmissionData {
  submission: Submission;
  issues: Issue[];
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementStatus {
  code: string;
  name: string;
  description: string;
  criteria: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: AchievementProgress;
}

export interface SubmissionStats {
  categoryAverages: ScoreBreakdown | null;
  topIssues: {
    category: string;
    severity: string;
    count: number;
  }[];
}
