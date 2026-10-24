import type { LLMRawFinding } from './types';

export interface ValidatedLLMOutput {
  findings: LLMRawFinding[];
  droppedCount: number;
  rootError?: string;
}

/**
 * Validates and clamps raw LLM JSON response.
 * - Root must be an object with a `findings` array.
 * - Per-item validation: claim, cited_line_ids, suggested_test.
 * - Clamps over-length strings and arrays instead of discarding.
 * - Malformed items (missing required fields or invalid types) are dropped with count reported.
 */
export function validateLLMResponse(data: unknown): ValidatedLLMOutput {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      findings: [],
      droppedCount: 0,
      rootError: 'Root must be a JSON object containing a "findings" array.',
    };
  }

  const rawObj = data as Record<string, unknown>;
  if (!Array.isArray(rawObj.findings)) {
    return {
      findings: [],
      droppedCount: 0,
      rootError: 'Missing or invalid "findings" array in root object.',
    };
  }

  const rawFindings = rawObj.findings.slice(0, 10);
  const validatedFindings: LLMRawFinding[] = [];
  let droppedCount = 0;

  for (const item of rawFindings) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      droppedCount++;
      continue;
    }

    const findingObj = item as Record<string, unknown>;

    // 1. Validate claim
    if (typeof findingObj.claim !== 'string' || !findingObj.claim.trim()) {
      droppedCount++;
      continue;
    }
    const claim =
      findingObj.claim.length > 300
        ? findingObj.claim.slice(0, 297) + '...'
        : findingObj.claim;

    // 2. Validate cited_line_ids
    if (!Array.isArray(findingObj.cited_line_ids)) {
      droppedCount++;
      continue;
    }
    const isValidStringArray = findingObj.cited_line_ids.every(
      (id) => typeof id === 'string'
    );
    if (!isValidStringArray) {
      droppedCount++;
      continue;
    }
    const cited_line_ids = (findingObj.cited_line_ids as string[]).slice(0, 10);

    // 3. Validate suggested_test
    if (typeof findingObj.suggested_test !== 'string') {
      droppedCount++;
      continue;
    }
    const suggested_test =
      findingObj.suggested_test.length > 1500
        ? findingObj.suggested_test.slice(0, 1497) + '...'
        : findingObj.suggested_test;

    // 4. Validate blind_spots (optional)
    let blind_spots: string[] | undefined = undefined;
    if (Array.isArray(findingObj.blind_spots)) {
      blind_spots = findingObj.blind_spots
        .filter((bs): bs is string => typeof bs === 'string')
        .map((bs) => (bs.length > 200 ? bs.slice(0, 197) + '...' : bs));
    }

    validatedFindings.push({
      claim,
      cited_line_ids,
      suggested_test,
      blind_spots,
    });
  }

  return {
    findings: validatedFindings,
    droppedCount,
  };
}
