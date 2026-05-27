import levenshtein from 'fast-levenshtein';
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
  DOC_NOT_AVAILABLE: 'DOC_NOT_AVAILABLE',
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PM_NOT_FOUND: 'PM_NOT_FOUND',
  UPGRADE_FAILED: 'UPGRADE_FAILED',
  VERSION_UNCHANGED: 'VERSION_UNCHANGED',
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
    const dist = levenshtein.get(lower, candidate.toLowerCase());
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
