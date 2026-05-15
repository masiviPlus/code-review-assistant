# LLM Evaluation Report

**Provider:** gemini
**Date:** 2026-05-15
**Fixtures:** 17

## Aggregate Metrics

| Metric | Value |
| --- | ---: |
| Total expected issues | 59 |
| True positives | 14 |
| False positives | 64 |
| False negatives | 45 |
| **Precision** | **17.9%** |
| **Recall** | **23.7%** |
| **F1 Score** | **20.4%** |
| Avg latency | 12923 ms |

## Per-Category Metrics

| Category | TP | FP | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| style | 0 | 2 | 10 | 0.0% | 0.0% | 0.0% |
| best_practice | 6 | 43 | 6 | 12.2% | 50.0% | 19.7% |
| logic | 8 | 8 | 20 | 50.0% | 28.6% | 36.4% |
| readability | 0 | 11 | 9 | 0.0% | 0.0% | 0.0% |

## Per-Fixture Results

### 01-var-usage

Score: 56 | Latency: 11285 ms | TP: 0 | FP: 4 | FN: 4

**Missed (false negatives):**
- [warning/style] lines 1-3: Use const instead of var for variables that are never reassigned
- [warning/style] lines 5-5: Use const instead of var for the items array
- [warning/style] lines 7-7: Use let instead of var for loop variable i (block scoping)
- [warning/style] lines 6-6: Use let instead of var for total (reassigned variable)

**Extra (false positives):**
- [warning/best_practice] line 1: Variables `name`, `age`, `greeting`, and `items` are declared with `var` and are never reassigned.
- [warning/best_practice] line 6: Variables `total` and `i` are declared with `var`.
- [info/style] line 3: Using string concatenation for `greeting`.
- [info/readability] line 7: Using a traditional `for` loop to iterate over array elements.

### 02-no-error-handling

Score: 48 | Latency: 12058 ms | TP: 2 | FP: 4 | FN: 1

**Caught:**
- [error/logic] line 4: The `readConfig` function does not handle potential errors from `fs.readFileSync` (e.g., file not found) or `JSON.parse` (e.g., malformed JSON).
- [warning/logic] line 13: Accessing `config.database.host` directly without checking if `config.database` exists can lead to a `TypeError` if the property is missing in the configuration.

**Missed (false negatives):**
- [warning/logic] lines 14-14: Accessing nested property config.database.host without null check

**Extra (false positives):**
- [warning/best_practice] line 4: `fs.readFileSync` is a synchronous operation that blocks the Node.js event loop.
- [error/logic] line 9: The global `fetch` function is typically not available in standard Node.js environments without explicit polyfilling or using a newer Node.js version (18+) with an experimental flag, or importing `node-fetch`.
- [warning/best_practice] line 9: The `fetchData` function does not include error handling for network requests or JSON parsing failures in its Promise chain.
- [info/readability] line 8: The `fetchData` function is defined but never called anywhere in the provided snippet.

### 03-loose-equality

Score: 63 | Latency: 12293 ms | TP: 0 | FP: 3 | FN: 4

**Missed (false negatives):**
- [warning/logic] lines 5-5: Loose equality == 0 can match empty string and false — use ===
- [warning/logic] lines 8-8: Loose equality == '' can match 0 and false — use ===
- [warning/logic] lines 11-11: Loose equality == true has unexpected coercion — use ===
- [warning/logic] lines 18-18: Use === for string comparison

**Extra (false positives):**
- [error/logic] line 6: The `checkValue` function will incorrectly return "zero" for a boolean `false` input due to loose equality (`false == 0` evaluates to true).
- [warning/best_practice] line 2: Consistent use of strict equality (`===`) is generally recommended over loose equality (`==`) to avoid subtle type coercion bugs and improve predictability.
- [info/best_practice] line 14: While `role == "admin"` works correctly here if `role` is always a string, using strict equality (`===`) is a safer default practice.

### 04-unused-variables

Score: 68 | Latency: 11690 ms | TP: 0 | FP: 4 | FN: 6

**Missed (false negatives):**
- [warning/style] lines 2-2: Variable tax is declared but never used
- [warning/style] lines 3-3: Variable discount is declared but never used
- [warning/style] lines 7-7: Variable logger is declared but never used
- [warning/style] lines 8-8: Variable debugMode is declared but never used
- [warning/style] lines 16-16: Constant MAX_RETRIES is declared but never used
- [warning/style] lines 17-17: Constant TIMEOUT is declared but never used

**Extra (false positives):**
- [warning/logic] line 2: The 'tax' variable is calculated but not used in the `finalPrice` calculation or returned.
- [warning/logic] line 3: The 'discount' variable is calculated but not used in the `finalPrice` calculation or returned.
- [warning/best_practice] line 7: The `logger` and `debugMode` variables are defined but never used within the `processOrder` function.
- [info/best_practice] line 19: The `fetchOrder` function returns the raw Promise from `fetch`. Typically, an API wrapper also handles parsing the response body (e.g., `response.json()`) and potential error handling.

### 05-callback-hell

Score: 35 | Latency: 11785 ms | TP: 1 | FP: 6 | FN: 1

**Caught:**
- [warning/best_practice] line 5: Error messages are generic and do not include the actual error object.

**Missed (false negatives):**
- [error/readability] lines 3-29: Deeply nested callbacks (4 levels) — refactor to async/await or promises

**Extra (false positives):**
- [error/best_practice] line 4: The code suffers from 'callback hell' due to deeply nested asynchronous operations using traditional Node.js callbacks.
- [warning/best_practice] line 8: Error messages are generic and do not include the actual error object.
- [warning/best_practice] line 13: Error messages are generic and do not include the actual error object.
- [info/logic] line 16: Reading `output.txt` immediately after writing it to verify `length` might be redundant.
- [warning/best_practice] line 17: Error messages are generic and do not include the actual error object.
- [info/readability] line 1: The use of `require` is common in older Node.js projects, but ES module syntax (`import/export`) is becoming standard.

### 06-sql-injection

Score: 45 | Latency: 14713 ms | TP: 1 | FP: 7 | FN: 3

**Caught:**
- [error/logic] line 26: The `connection.query` call for `deleteUser` does not include a callback function, leading to silent failures if the database operation encounters an error.

**Missed (false negatives):**
- [error/logic] lines 5-5: SQL injection — user input concatenated directly into query string
- [error/logic] lines 15-15: SQL injection — template literal interpolation of user input in query
- [warning/logic] lines 26-26: No error handling on DELETE query — errors are silently ignored

**Extra (false positives):**
- [error/best_practice] line 5: Direct string concatenation of user input (`userId`) into the SQL query creates a severe SQL injection vulnerability.
- [error/best_practice] line 15: Direct string concatenation of user input (`name`) into the SQL query creates a severe SQL injection vulnerability.
- [error/best_practice] line 25: Direct string concatenation of user input (`req.params.id`) into the SQL query creates a severe SQL injection vulnerability.
- [warning/best_practice] line 24: The `deleteUser` function uses a callback-style query without returning a Promise, making it inconsistent with `getUser` and `searchUsers` and harder to use with `async/await`.
- [warning/best_practice] line 2: The database connection is opened but never explicitly closed.
- [info/best_practice] line 2: Database credentials are hardcoded directly in the source file.
- [info/best_practice] line 24: The `deleteUser` function directly depends on the `req` object from an HTTP context.

### 07-magic-numbers

Score: 75 | Latency: 8656 ms | TP: 0 | FP: 3 | FN: 4

**Missed (false negatives):**
- [warning/readability] lines 4-5: Magic numbers 10 and 0.85 — extract to named constants (e.g. BULK_THRESHOLD, BULK_DISCOUNT)
- [warning/readability] lines 8-11: Magic numbers 500, 12.99, 4.99 — extract shipping cost constants
- [warning/readability] lines 14-14: Magic number 1.21 — extract to TAX_RATE constant
- [warning/readability] lines 16-17: Magic numbers 1000 and 50 — extract to named constants

**Extra (false positives):**
- [warning/best_practice] line 1: The `calculatePrice` function uses multiple 'magic numbers' (e.g., 0.85, 12.99, 1.21) without clear context.
- [info/readability] line 1: The `calculatePrice` function performs several distinct calculations in sequence, modifying the `price` variable multiple times.
- [info/readability] line 1: The sequence of operations in `calculatePrice` could benefit from comments explaining what each step (discount, shipping, tax) represents.

### 08-deep-nesting

Score: 45 | Latency: 10202 ms | TP: 0 | FP: 2 | FN: 2

**Missed (false negatives):**
- [error/readability] lines 1-31: Deeply nested conditionals (7 levels) — use early returns / guard clauses to flatten
- [info/best_practice] lines 5-6: Email validation with just includes('@') is too naive — use a proper check

**Extra (false positives):**
- [warning/readability] line 1: The function uses deeply nested `if` statements (8 levels deep!), which is often referred to as the 'pyramid of doom'. This significantly reduces readability and makes the code difficult to understand and maintain.
- [info/best_practice] line 1: Repeated null/undefined checks for nested properties can be made more concise in some contexts.

### 09-console-in-prod

Score: 59 | Latency: 12784 ms | TP: 1 | FP: 4 | FN: 2

**Caught:**
- [warning/best_practice] line 14: The `getUser` function is not defined in this snippet. While likely an external dependency, its implementation details (e.g., throwing an error for not found vs. returning null) affect the route's behavior.

**Missed (false negatives):**
- [warning/best_practice] lines 5-7: console.log in middleware — use a proper logger (e.g. pino, winston) for production
- [info/best_practice] lines 6-6: Logging full headers may leak sensitive information (cookies, auth tokens)

**Extra (false positives):**
- [error/logic] line 7: `req.body` will be `undefined` by default without a body-parser middleware.
- [info/style] line 5: Using string concatenation for logging.
- [info/best_practice] line 24: The port number `3000` is a magic number.
- [info/best_practice] line 19: Logging both the error object and its stack in production can be overly verbose or expose sensitive information.

### 10-global-mutation

Score: 71 | Latency: 14785 ms | TP: 1 | FP: 3 | FN: 2

**Caught:**
- [warning/best_practice] line ?: All functions (`handleLogin`, `handleRequest`, `resetState`) modify global state directly, leading to implicit side effects.

**Missed (false negatives):**
- [error/logic] lines 1-3: Global mutable state — will cause race conditions in concurrent/multi-request environments
- [warning/logic] lines 17-17: Cache keyed by path but includes user-specific data — different users will see stale/wrong data

**Extra (false positives):**
- [error/best_practice] line ?: The code heavily relies on global mutable state (currentUser, requestCount, cache), which is a significant anti-pattern.
- [info/best_practice] line ?: While `resetState` clears everything, consider adding a specific `handleLogout` function if `currentUser` state changes are common and distinct from a full system reset.
- [info/readability] line ?: For larger codebases or shared modules, adding JSDoc comments to functions would improve readability and tooling support.

### 11-type-coercion

Score: 58 | Latency: 14565 ms | TP: 2 | FP: 3 | FN: 2

**Caught:**
- [warning/logic] line 8: Using `parseInt()` for `taxAmount` will truncate any decimal values, which can lead to imprecise monetary calculations.
- [error/logic] line 14: The condition `value + 0 === value` is an unreliable way to check if a value is a number for parsing purposes. It returns `true` for `NaN` and `false` for string numbers (e.g., '10').

**Missed (false negatives):**
- [warning/logic] lines 11-11: discount + 0 is an implicit type coercion trick — use Number() or explicit check
- [warning/logic] lines 17-17: value + 0 === value is a fragile type check — use typeof instead

**Extra (false positives):**
- [warning/best_practice] line 1: The property `cart.items` seems to represent a count rather than an array of actual items.
- [info/readability] line 7: The expression `cart.discount + 0 > 0` is an indirect way to check if a discount exists.
- [warning/best_practice] line 13: The `parseInput` function can be simplified as `Number(value) || 0` already provides robust conversion and a default.

### 12-promise-antipatterns

Score: 54 | Latency: 23870 ms | TP: 1 | FP: 3 | FN: 2

**Caught:**
- [warning/best_practice] line 17: In `saveUser`, `await` is used directly before a `.then()` chain. While syntactically valid, it's generally clearer and more idiomatic in `async/await` functions to `await` each Promise sequentially, separating the fetch call from the JSON parsing.

**Missed (false negatives):**
- [error/best_practice] lines 1-13: Promise constructor anti-pattern — wrapping fetch (already a promise) in new Promise is unnecessary
- [warning/logic] lines 26-30: Sequential await in loop — use Promise.all for parallel execution

**Extra (false positives):**
- [warning/best_practice] line 2: The `getUser` function uses an explicit `new Promise` constructor to wrap an already Promise-based `fetch` chain. This is generally an anti-pattern known as the 'Promise constructor anti-pattern'. Additionally, it lacks a check for `response.ok` to handle HTTP error statuses (e.g., 404, 500) gracefully, meaning a resolved `fetch` for an error response might still return invalid data.
- [warning/best_practice] line 17: The `saveUser` function lacks explicit error handling for network requests or non-OK HTTP responses. Network failures or server errors could lead to unhandled rejections or incorrect data without a `try...catch` block or a check for `response.ok`.
- [warning/best_practice] line 26: The `loadAll` function fetches users sequentially using `await` inside a `for...of` loop. This can be inefficient for large lists of IDs as each request waits for the previous one to complete, increasing total execution time.

### 13-eval-usage

Score: 44 | Latency: 9986 ms | TP: 0 | FP: 4 | FN: 4

**Missed (false negatives):**
- [error/logic] lines 2-2: eval() with user input is a critical security vulnerability — allows arbitrary code execution
- [error/logic] lines 6-6: new Function() is essentially eval — same security risk
- [error/logic] lines 10-10: eval() with script parameter — remote code execution vulnerability
- [warning/logic] lines 15-15: Using eval to parse JSON — use JSON.parse instead

**Extra (false positives):**
- [error/best_practice] line 2: Using `eval()` poses a severe security risk by executing arbitrary code from untrusted sources.
- [error/best_practice] line 6: Using `new Function()` dynamically creates and executes code, which is a major security vulnerability similar to `eval()`.
- [error/best_practice] line 11: The `runUserScript` function uses `eval()`, which is extremely dangerous as it executes arbitrary user-provided JavaScript code.
- [error/best_practice] line 15: Using `eval()` to parse JSON is insecure and inefficient. It can execute malicious code if the input JSON contains JavaScript.

### 14-redundant-else

Score: 84 | Latency: 8589 ms | TP: 0 | FP: 2 | FN: 3

**Missed (false negatives):**
- [info/readability] lines 1-15: Redundant else after return — can flatten with early returns
- [info/readability] lines 17-25: Redundant else after return statements
- [info/readability] lines 27-37: Chain of if-else returning — consider a lookup object or switch

**Extra (false positives):**
- [warning/readability] line 2: The `getDiscount` function uses deeply nested `if/else` statements, which can reduce readability.
- [info/best_practice] line 26: The `getStatus` function uses an `if/else if` chain for mapping discrete values.

### 15-missing-null-checks

Score: 53 | Latency: 11061 ms | TP: 1 | FP: 5 | FN: 3

**Caught:**
- [error/logic] line 6: Accessing `list[0]` without first checking if the list is empty will cause a runtime error if `list` is `null`, `undefined`, or an empty array.

**Missed (false negatives):**
- [error/logic] lines 2-2: Deep property access without null checks — will throw TypeError if any level is null/undefined
- [error/logic] lines 10-11: Deep property chain without null checks — any missing level causes TypeError
- [warning/logic] lines 16-18: Accessing user.address properties without checking if address exists

**Extra (false positives):**
- [warning/best_practice] line 2: Accessing deeply nested properties (e.g., `response.data.user.profile.email`) without safety checks can lead to runtime errors if any intermediate property is `null` or `undefined`.
- [warning/best_practice] line 10: Accessing deeply nested properties (e.g., `config.settings.theme.name`) without safety checks can lead to runtime errors if any intermediate property is `null` or `undefined`.
- [info/readability] line 19: String concatenation can become less readable with multiple variables and static text.
- [info/readability] line 17: Repeating `user.address` multiple times can be made more concise.
- [warning/best_practice] line 17: Accessing deeply nested properties (e.g., `user.address.street`) without safety checks can lead to runtime errors if `user.address` is `null` or `undefined`.

### 16-hardcoded-secrets

Score: 49 | Latency: 13372 ms | TP: 2 | FP: 5 | FN: 1

**Caught:**
- [error/best_practice] line 1: Sensitive information (API key, DB password, JWT secret, and a hardcoded API secret) is directly embedded in the source code.
- [warning/best_practice] line 11: When sending a JSON body with `fetch`, the `Content-Type` header should be explicitly set to `application/json`.

**Missed (false negatives):**
- [error/best_practice] lines 6-6: Hardcoded database credentials in connection string

**Extra (false positives):**
- [error/logic] line 7: The `mongoose` variable is used without being declared or imported.
- [error/logic] line 21: The `jwt` variable is used without being declared or imported.
- [warning/best_practice] line 10: When sending a `body` with `fetch`, the HTTP method should typically be specified (e.g., 'POST' or 'PUT'). By default, `fetch` uses 'GET', which usually ignores the request body.
- [warning/best_practice] line 10: The `callExternalAPI` function does not include error handling for the network request or processing the API response (e.g., checking `response.ok`, parsing JSON).
- [warning/best_practice] line 5: The `connectDB` function does not include error handling for the `mongoose.connect` call, which can fail due to network issues or incorrect credentials.

### 17-array-mutation-in-loop

Score: 34 | Latency: 18004 ms | TP: 2 | FP: 2 | FN: 1

**Caught:**
- [error/logic] line 2: The `removeInactive` function's logic of modifying an array with `splice` while iterating forwards with a `for` loop is flawed. When an element is removed, subsequent elements shift their indices, causing the loop to potentially skip the next element.
- [error/logic] line 9: The `deduplicate` function suffers from the same logic flaw as `removeInactive`. Splicing elements while iterating forwards in a nested loop can skip over subsequent duplicates or lead to incorrect comparisons, failing to fully deduplicate the array.

**Missed (false negatives):**
- [warning/best_practice] lines 23-27: Mutating the source array inside forEach — use map/filter for immutable approach

**Extra (false positives):**
- [warning/best_practice] line 8: The nested loop with `splice` for deduplication is highly inefficient, resulting in a time complexity closer to O(n^3) in the worst case. This can lead to very slow performance for large arrays.
- [warning/best_practice] line 17: The `processItems` function exhibits mixed responsibilities by both mutating the original `items` array (`items[index] = ...`) and returning a new `results` array. This dual behavior can lead to unexpected side effects for callers and makes the function's intent less clear.
