# Scoring Rules

This document describes the deterministic scoring layer applied on
top of the LLM's raw code-review scores. The LLM returns a
subjective `scoreOverall` (0–100); the scoring service adjusts it
with fixed, reproducible rules so that identical issues always
produce identical point deductions.

## Why a deterministic layer?

LLM scores are non-deterministic — the same code may receive
slightly different scores across calls. The deterministic layer
ensures that the final score is **explainable** and
**reproducible**: every deduction maps to a concrete issue the
reviewer surfaced.

## Penalty rules

Each issue returned by the LLM carries a severity. The following
penalties are subtracted from `scoreOverall`:

| Severity  | Penalty per issue |
| --------- | ----------------: |
| `error`   |               −15 |
| `warning` |                −5 |
| `info`    |                −1 |

Penalties are additive. If the LLM returns 2 errors and 1 warning,
the total deduction is 2 × 15 + 1 × 5 = **35 points**.

## Clean-code bonus

A bonus of **+5 points** is awarded when **both** conditions are met:

1. The submitted code is **50 lines or longer**.
2. The review contains **zero error-level issues**.

The bonus rewards authors who write longer, non-trivial code that
is free from critical problems.

## Score floor

The adjusted score is **capped at 0**. It can never go negative,
regardless of how many issues are found.

## Calculation order

```
adjusted  = rawScore
adjusted -= Σ penalty(issue.severity) for each issue
adjusted += 5   (if lineCount ≥ 50 AND errors == 0)
adjusted  = max(adjusted, 0)
```

## Example

| Input                                     | Calculation            | Final score |
| ----------------------------------------- | ---------------------- | ----------: |
| Raw 85, 1 error, 2 warnings, 60 lines    | 85 − 15 − 10 = 60     |          60 |
| Raw 90, 0 errors, 1 info, 80 lines       | 90 − 1 + 5 = 94       |          94 |
| Raw 20, 2 errors, 10 lines               | 20 − 30 = −10 → 0     |           0 |
| Raw 75, 0 errors, 0 warnings, 30 lines   | 75 (no bonus, < 50 L) |          75 |

## Implementation

The scoring logic lives in `backend/src/services/scoring.ts` and is
invoked in the submission POST handler immediately after the LLM
responds. It is a pure function with no side effects — unit tests
cover every rule and edge case.
