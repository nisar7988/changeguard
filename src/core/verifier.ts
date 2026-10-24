import type { DiffLine, Finding, LLMRawFinding, ResolvedSnippet } from './types';

export interface VerifierOptions {
  provenanceMap?: Record<number, 'real' | 'synthetic'>;
}

/**
 * Resolves and verifies citations against sentLineIds and diff line models.
 * - Cited: cited_line_ids is non-empty, EVERY cited ID exists in sentLineIds,
 *   and AT LEAST ONE cited ID is an added or removed line.
 * - Uncited: cited_line_ids is empty, OR any cited ID not in sentLineIds,
 *   OR all cited IDs are purely context lines.
 * - Resolves actual line snippets directly from diff line models.
 * - Hardcodes source to 'LLM' and likelihood to 'Uncertain'.
 */
export function verifyCitations(
  rawFindings: LLMRawFinding[],
  sentLineIds: string[],
  allLines: DiffLine[],
  options?: VerifierOptions
): Finding[] {
  const sentSet = new Set(sentLineIds);
  const lineMap = new Map<string, DiffLine>();
  for (const line of allLines) {
    lineMap.set(line.id, line);
  }

  return rawFindings.map((raw, idx) => {
    const citedIds = raw.cited_line_ids || [];

    // Resolve code snippets from diff lines
    const resolvedSnippets: ResolvedSnippet[] = citedIds.map((id) => {
      const line = lineMap.get(id);
      if (line) {
        return {
          lineId: id,
          file: line.file,
          lineNo: line.newLine ?? line.oldLine ?? 1,
          text: line.text,
          resolved: true,
          isSent: sentSet.has(id),
        };
      }
      return {
        lineId: id,
        file: 'unknown',
        lineNo: 0,
        text: '[Not found in sent diff]',
        resolved: false,
        isSent: false,
      };
    });

    // Verification check:
    // 1. Non-empty citations
    const hasCitations = citedIds.length > 0;

    // 2. Every cited ID must exist in sentLineIds
    const allInSentSet = hasCitations && citedIds.every((id) => sentSet.has(id));

    // 3. At least one cited ID must be an added or removed line (not purely context)
    const hasChangedLine = citedIds.some((id) => {
      const line = lineMap.get(id);
      return line && (line.kind === 'added' || line.kind === 'removed');
    });

    const isCited = hasCitations && allInSentSet && hasChangedLine;
    const detection = isCited ? 'Cited' : 'Uncited';

    const provenance = options?.provenanceMap?.[idx];

    return {
      id: `llm-${idx + 1}`,
      source: 'LLM',
      claim: raw.claim,
      detection,
      likelihood: 'Uncertain',
      citedLineIds: citedIds,
      resolvedSnippets,
      suggestedTest: raw.suggested_test,
      blindSpots: raw.blind_spots,
      provenance,
    };
  });
}
