import * as fs from 'fs';
import * as path from 'path';
import { createLLMClient } from '../src/services/llm/factory';
import { env } from '../src/config/env';
import type { AnalysisResult, AnalysisIssue } from '../src/services/llm/types';

// ── Types ────────────────────────────────────────────────────

interface ExpectedIssue {
  severity: string;
  category: string;
  lineRange: [number, number];
  description: string;
}

interface FixtureResult {
  name: string;
  expected: ExpectedIssue[];
  actual: AnalysisIssue[];
  truePositives: { expected: ExpectedIssue; actual: AnalysisIssue }[];
  falseNegatives: ExpectedIssue[];
  falsePositives: AnalysisIssue[];
  latencyMs: number;
  outputTokens: number | null;
  scoreOverall: number;
  rawResponse: AnalysisResult;
}

interface CategoryMetrics {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

// ── Matching logic ───────────────────────────────────────────

const LINE_TOLERANCE = 3;

function issueMatches(expected: ExpectedIssue, actual: AnalysisIssue): boolean {
  if (expected.severity !== actual.severity) return false;
  if (expected.category !== actual.category) return false;

  if (actual.lineNumber === null) return true; // LLM didn't provide line — match on category+severity only

  const [lo, hi] = expected.lineRange;
  return actual.lineNumber >= lo - LINE_TOLERANCE && actual.lineNumber <= hi + LINE_TOLERANCE;
}

function matchIssues(
  expected: ExpectedIssue[],
  actual: AnalysisIssue[],
): { truePositives: { expected: ExpectedIssue; actual: AnalysisIssue }[]; falseNegatives: ExpectedIssue[]; falsePositives: AnalysisIssue[] } {
  const matched = new Set<number>();
  const truePositives: { expected: ExpectedIssue; actual: AnalysisIssue }[] = [];
  const falseNegatives: ExpectedIssue[] = [];

  for (const exp of expected) {
    let found = false;
    for (let i = 0; i < actual.length; i++) {
      if (matched.has(i)) continue;
      if (issueMatches(exp, actual[i])) {
        truePositives.push({ expected: exp, actual: actual[i] });
        matched.add(i);
        found = true;
        break;
      }
    }
    if (!found) {
      falseNegatives.push(exp);
    }
  }

  const falsePositives = actual.filter((_, i) => !matched.has(i));

  return { truePositives, falseNegatives, falsePositives };
}

// ── Metrics ──────────────────────────────────────────────────

function computeCategoryMetrics(results: FixtureResult[]): Record<string, CategoryMetrics> {
  const categories = ['style', 'best_practice', 'logic', 'readability'];
  const metrics: Record<string, CategoryMetrics> = {};

  for (const cat of categories) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const r of results) {
      tp += r.truePositives.filter((m) => m.expected.category === cat).length;
      fn += r.falseNegatives.filter((e) => e.category === cat).length;
      fp += r.falsePositives.filter((a) => a.category === cat).length;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    metrics[cat] = { tp, fp, fn, precision, recall, f1 };
  }

  return metrics;
}

// ── CSV output ───────────────────────────────────────────────

function generateCSV(results: FixtureResult[]): string {
  const lines: string[] = [];
  lines.push('fixture,expected_count,tp,fp,fn,precision,recall,f1,score_overall,latency_ms');

  for (const r of results) {
    const tp = r.truePositives.length;
    const fp = r.falsePositives.length;
    const fn = r.falseNegatives.length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    lines.push(
      [r.name, r.expected.length, tp, fp, fn, precision.toFixed(3), recall.toFixed(3), f1.toFixed(3), r.scoreOverall, r.latencyMs].join(','),
    );
  }

  return lines.join('\n') + '\n';
}

// ── Markdown output ──────────────────────────────────────────

function generateMarkdown(results: FixtureResult[], categoryMetrics: Record<string, CategoryMetrics>): string {
  const lines: string[] = [];

  lines.push('# LLM Evaluation Report');
  lines.push('');
  lines.push(`**Provider:** ${env.LLM_PROVIDER}`);
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Fixtures:** ${results.length}`);
  lines.push('');

  // Aggregate stats
  const totalTP = results.reduce((s, r) => s + r.truePositives.length, 0);
  const totalFP = results.reduce((s, r) => s + r.falsePositives.length, 0);
  const totalFN = results.reduce((s, r) => s + r.falseNegatives.length, 0);
  const totalExpected = results.reduce((s, r) => s + r.expected.length, 0);
  const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / results.length;
  const overallPrecision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const overallRecall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const overallF1 = overallPrecision + overallRecall > 0
    ? (2 * overallPrecision * overallRecall) / (overallPrecision + overallRecall)
    : 0;

  lines.push('## Aggregate Metrics');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| Total expected issues | ${totalExpected} |`);
  lines.push(`| True positives | ${totalTP} |`);
  lines.push(`| False positives | ${totalFP} |`);
  lines.push(`| False negatives | ${totalFN} |`);
  lines.push(`| **Precision** | **${(overallPrecision * 100).toFixed(1)}%** |`);
  lines.push(`| **Recall** | **${(overallRecall * 100).toFixed(1)}%** |`);
  lines.push(`| **F1 Score** | **${(overallF1 * 100).toFixed(1)}%** |`);
  lines.push(`| Avg latency | ${Math.round(avgLatency)} ms |`);
  lines.push('');

  // Per-category
  lines.push('## Per-Category Metrics');
  lines.push('');
  lines.push('| Category | TP | FP | FN | Precision | Recall | F1 |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [cat, m] of Object.entries(categoryMetrics)) {
    lines.push(
      `| ${cat} | ${m.tp} | ${m.fp} | ${m.fn} | ${(m.precision * 100).toFixed(1)}% | ${(m.recall * 100).toFixed(1)}% | ${(m.f1 * 100).toFixed(1)}% |`,
    );
  }
  lines.push('');

  // Per-fixture
  lines.push('## Per-Fixture Results');
  lines.push('');

  for (const r of results) {
    const tp = r.truePositives.length;
    const fp = r.falsePositives.length;
    const fn = r.falseNegatives.length;

    lines.push(`### ${r.name}`);
    lines.push('');
    lines.push(`Score: ${r.scoreOverall} | Latency: ${r.latencyMs} ms | TP: ${tp} | FP: ${fp} | FN: ${fn}`);
    lines.push('');

    if (r.truePositives.length > 0) {
      lines.push('**Caught:**');
      for (const m of r.truePositives) {
        lines.push(`- [${m.actual.severity}/${m.actual.category}] line ${m.actual.lineNumber ?? '?'}: ${m.actual.message}`);
      }
      lines.push('');
    }

    if (r.falseNegatives.length > 0) {
      lines.push('**Missed (false negatives):**');
      for (const e of r.falseNegatives) {
        lines.push(`- [${e.severity}/${e.category}] lines ${e.lineRange[0]}-${e.lineRange[1]}: ${e.description}`);
      }
      lines.push('');
    }

    if (r.falsePositives.length > 0) {
      lines.push('**Extra (false positives):**');
      for (const a of r.falsePositives) {
        lines.push(`- [${a.severity}/${a.category}] line ${a.lineNumber ?? '?'}: ${a.message}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const resultsDir = path.join(__dirname, 'results');

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Discover fixtures
  const jsFiles = fs.readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  if (jsFiles.length === 0) {
    console.error('No fixture .js files found in', fixturesDir);
    process.exit(1);
  }

  console.log(`Found ${jsFiles.length} fixtures. Provider: ${env.LLM_PROVIDER}\n`);

  const client = createLLMClient(env);
  const results: FixtureResult[] = [];

  for (const jsFile of jsFiles) {
    const name = jsFile.replace('.js', '');
    const expectedFile = path.join(fixturesDir, name + '.expected.json');
    const codeFile = path.join(fixturesDir, jsFile);

    const code = fs.readFileSync(codeFile, 'utf-8');
    const expected: ExpectedIssue[] = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));

    process.stdout.write(`  ${name} ... `);

    const start = Date.now();
    let rawResponse: AnalysisResult;
    try {
      rawResponse = await client.analyseCode(code, 'javascript');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${message}`);
      continue;
    }
    const latencyMs = Date.now() - start;

    const { truePositives, falseNegatives, falsePositives } = matchIssues(expected, rawResponse.issues);

    const result: FixtureResult = {
      name,
      expected,
      actual: rawResponse.issues,
      truePositives,
      falseNegatives,
      falsePositives,
      latencyMs,
      outputTokens: null, // tracked in LLM client logs
      scoreOverall: rawResponse.scoreOverall,
      rawResponse,
    };

    results.push(result);

    const tp = truePositives.length;
    const fn = falseNegatives.length;
    const fp = falsePositives.length;
    console.log(`TP=${tp} FN=${fn} FP=${fp} (${latencyMs}ms)`);
  }

  // Compute metrics
  const categoryMetrics = computeCategoryMetrics(results);

  // Write outputs
  const csvPath = path.join(resultsDir, 'report.csv');
  const mdPath = path.join(resultsDir, 'report.md');

  fs.writeFileSync(csvPath, generateCSV(results), 'utf-8');
  fs.writeFileSync(mdPath, generateMarkdown(results, categoryMetrics), 'utf-8');

  console.log(`\nResults written to:`);
  console.log(`  CSV: ${csvPath}`);
  console.log(`  MD:  ${mdPath}`);

  // Print summary
  const totalTP = results.reduce((s, r) => s + r.truePositives.length, 0);
  const totalFP = results.reduce((s, r) => s + r.falsePositives.length, 0);
  const totalFN = results.reduce((s, r) => s + r.falseNegatives.length, 0);
  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log(`\n── Summary ──────────────────────────`);
  console.log(`  Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`  Recall:    ${(recall * 100).toFixed(1)}%`);
  console.log(`  F1:        ${(f1 * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
