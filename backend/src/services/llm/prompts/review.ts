export const REVIEW_SYSTEM_PROMPT = `You are a senior JavaScript code reviewer. Be specific, kind, and educational. Cite line numbers when possible.

You will receive a code snippet and must return a JSON object with this exact shape:

{
  "scoreOverall": <number 0-100>,
  "scoreBreakdown": {
    "style": <number 0-100>,
    "bestPractices": <number 0-100>,
    "logic": <number 0-100>,
    "readability": <number 0-100>
  },
  "issues": [
    {
      "severity": "info" | "warning" | "error",
      "category": "style" | "best_practice" | "logic" | "readability",
      "lineNumber": <number or null>,
      "message": "<what is wrong>",
      "suggestion": "<how to fix it>"
    }
  ],
  "summary": "<1-2 sentence overall feedback>"
}

Rules:
- scoreOverall is the rounded average of the four breakdown scores.
- Every issue MUST have a message and a suggestion.
- Return ONLY the JSON object. No markdown, no code fences, no explanation outside the JSON.`;

export const FEW_SHOT_EXAMPLES = [
  {
    role: 'user' as const,
    content: `Review this javascript code:\n\`\`\`javascript\nlet x = 10\nlet y = 20\nfunction add(a,b){\nreturn a+b\n}\nconsole.log(add(x,y))\n\`\`\``,
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      scoreOverall: 58,
      scoreBreakdown: {
        style: 40,
        bestPractices: 55,
        logic: 85,
        readability: 50,
      },
      issues: [
        {
          severity: 'warning',
          category: 'style',
          lineNumber: 1,
          message: 'Variables "x" and "y" are never reassigned.',
          suggestion: 'Use `const` instead of `let` for variables that do not change.',
        },
        {
          severity: 'info',
          category: 'style',
          lineNumber: 3,
          message: 'Missing space after comma in function parameters and no space before opening brace.',
          suggestion: 'Format as `function add(a, b) {` for consistent style.',
        },
        {
          severity: 'warning',
          category: 'readability',
          lineNumber: 1,
          message: 'Single-letter variable names like "x" and "y" are not descriptive.',
          suggestion: 'Rename to meaningful names like `firstNumber` and `secondNumber`.',
        },
        {
          severity: 'info',
          category: 'best_practice',
          lineNumber: 6,
          message: 'Using console.log directly in module-level code.',
          suggestion: 'Wrap the call in a main function or use a proper logging utility.',
        },
      ],
      summary:
        'The logic is correct but the code lacks consistent formatting and uses non-descriptive variable names. Small style fixes would improve readability significantly.',
    }),
  },
  {
    role: 'user' as const,
    content: `Review this javascript code:\n\`\`\`javascript\nasync function fetchUsers() {\n  try {\n    var response = await fetch("/api/users")\n    var data = response.json()\n    return data\n  } catch(e) {\n    console.log(e)\n  }\n}\n\nconst result = fetchUsers()\nif (result.length > 0) {\n  document.getElementById("count").innerText = result.length\n}\n\`\`\``,
  },
  {
    role: 'assistant' as const,
    content: JSON.stringify({
      scoreOverall: 35,
      scoreBreakdown: {
        style: 45,
        bestPractices: 25,
        logic: 20,
        readability: 50,
      },
      issues: [
        {
          severity: 'error',
          category: 'logic',
          lineNumber: 4,
          message: 'Missing `await` on `response.json()` — it returns a Promise, not the parsed data.',
          suggestion: 'Change to `const data = await response.json()`.',
        },
        {
          severity: 'error',
          category: 'logic',
          lineNumber: 11,
          message: '`fetchUsers()` returns a Promise but the result is used synchronously without `await`.',
          suggestion: 'Use `const result = await fetchUsers()` inside an async context.',
        },
        {
          severity: 'error',
          category: 'logic',
          lineNumber: 12,
          message: 'Accessing `.length` on a Promise will always be undefined, causing a silent failure.',
          suggestion: 'Await the result before checking its properties.',
        },
        {
          severity: 'warning',
          category: 'best_practice',
          lineNumber: 3,
          message: 'Using `var` instead of `const` or `let`.',
          suggestion: 'Replace `var` with `const` since neither variable is reassigned.',
        },
        {
          severity: 'warning',
          category: 'best_practice',
          lineNumber: 6,
          message: 'Catch block swallows the error with only a console.log.',
          suggestion: 'Re-throw the error or return a meaningful fallback. Log with `console.error` at minimum.',
        },
        {
          severity: 'info',
          category: 'best_practice',
          lineNumber: 13,
          message: '`getElementById` result could be null if the element does not exist.',
          suggestion: 'Add a null check: `const el = document.getElementById("count"); if (el) el.innerText = ...`.',
        },
      ],
      summary:
        'The code has critical async/await bugs that will cause silent failures at runtime. The fetch result is never awaited and response.json() is missing await, so the data will always be a pending Promise.',
    }),
  },
];

export function buildReviewMessages(code: string, language: string) {
  return [
    ...FEW_SHOT_EXAMPLES,
    {
      role: 'user' as const,
      content: `Review this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``,
    },
  ];
}

export const RETRY_MESSAGE = {
  role: 'user' as const,
  content: 'Your last response was not valid JSON. Return ONLY the JSON object, with no other text.',
};
