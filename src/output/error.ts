import type { CLIError } from '../types.js';

export const ErrorCodes = {
  COMPONENT_NOT_FOUND: 'COMPONENT_NOT_FOUND',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  NO_PROJECT_DETECTED: 'NO_PROJECT_DETECTED',
  METADATA_FETCH_FAILED: 'METADATA_FETCH_FAILED',
  UNSUPPORTED_VERSION_FEATURE: 'UNSUPPORTED_VERSION_FEATURE',
  DEMO_NOT_FOUND: 'DEMO_NOT_FOUND',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  TITLE_REQUIRED: 'TITLE_REQUIRED',
  GH_NOT_FOUND: 'GH_NOT_FOUND',
  GH_SUBMIT_FAILED: 'GH_SUBMIT_FAILED',
} as const;

export function createError(code: string, message: string, suggestion?: string): CLIError {
  return { error: true, code, message, suggestion };
}

export function printError(err: CLIError, format: string): void {
  if (format === 'json') {
    console.error(JSON.stringify(err, null, 2));
  } else {
    console.error(`Error: ${err.message}`);
    if (err.suggestion) {
      console.error(`Suggestion: ${err.suggestion}`);
    }
  }
}

export function fuzzyMatch(input: string, candidates: string[]): string | undefined {
  if (candidates.length === 0) return undefined;
  const lower = input.toLowerCase();

  // Exact match (case-insensitive)
  const exact = candidates.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  // Prefix match
  const prefix = candidates.find((c) => c.toLowerCase().startsWith(lower));
  if (prefix) return prefix;

  // Contains match
  const contains = candidates.find((c) => c.toLowerCase().includes(lower));
  if (contains) return contains;

  // Levenshtein distance for close matches
  // Tie-break by preferring candidates that start with the same letter as input
  let best: string | undefined;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = levenshtein(lower, candidate.toLowerCase());
    if (dist <= 3) {
      const sameFirstLetter = lower[0] === candidate[0]?.toLowerCase();
      const bestSameFirstLetter = best ? lower[0] === best[0]?.toLowerCase() : false;
      if (dist < bestDist || (dist === bestDist && sameFirstLetter && !bestSameFirstLetter)) {
        bestDist = dist;
        best = candidate;
      }
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
