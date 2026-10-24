import { DiffLine } from './types';

export type AssertionLineStatus = 'deleted' | 'moved' | 'cross-file';

export interface EvaluatedAssertionLine {
  line: DiffLine;
  status: AssertionLineStatus;
  matchedAddedLineId?: string;
}

export interface MoveMatchResult {
  lines: EvaluatedAssertionLine[];
  deletedCount: number;
  movedCount: number;
  crossFileCount: number;
}

/**
 * Normalizes code line for assertion move matching:
 * trims leading/trailing whitespace and removes trailing semicolons.
 */
export function normalizeCodeLine(text: string): string {
  return text.trim().replace(/;+$/, '').trim();
}

/**
 * Performs one-to-one assertion move matching:
 * 1. Same-file matching: each added line can cancel at most ONE removed line.
 * 2. If no same-file match exists, checks for cross-file additions (not cancelled, marked cross-file).
 * 3. Otherwise marked deleted.
 */
export function matchMovedAssertions(
  removedLines: DiffLine[],
  allAddedLines: DiffLine[]
): MoveMatchResult {
  const result: EvaluatedAssertionLine[] = [];
  let deletedCount = 0;
  let movedCount = 0;
  let crossFileCount = 0;

  // Track consumed added lines (by line.id) to enforce strict 1-to-1 matching
  const consumedAddedLineIds = new Set<string>();

  for (const removed of removedLines) {
    const normRemoved = normalizeCodeLine(removed.text);
    if (!normRemoved) {
      result.push({ line: removed, status: 'deleted' });
      deletedCount++;
      continue;
    }

    // 1. Try to find an unconsumed identical added line in the SAME file
    let foundSameFile: DiffLine | undefined;
    for (const added of allAddedLines) {
      if (
        added.file === removed.file &&
        !consumedAddedLineIds.has(added.id) &&
        normalizeCodeLine(added.text) === normRemoved
      ) {
        foundSameFile = added;
        break;
      }
    }

    if (foundSameFile) {
      consumedAddedLineIds.add(foundSameFile.id);
      result.push({
        line: removed,
        status: 'moved',
        matchedAddedLineId: foundSameFile.id,
      });
      movedCount++;
      continue;
    }

    // 2. Check if an identical added line exists in ANOTHER file (cross-file match)
    let foundCrossFile: DiffLine | undefined;
    for (const added of allAddedLines) {
      if (
        added.file !== removed.file &&
        normalizeCodeLine(added.text) === normRemoved
      ) {
        foundCrossFile = added;
        break;
      }
    }

    if (foundCrossFile) {
      result.push({
        line: removed,
        status: 'cross-file',
        matchedAddedLineId: foundCrossFile.id,
      });
      crossFileCount++;
      continue;
    }

    // 3. Completely deleted
    result.push({
      line: removed,
      status: 'deleted',
    });
    deletedCount++;
  }

  return {
    lines: result,
    deletedCount,
    movedCount,
    crossFileCount,
  };
}
