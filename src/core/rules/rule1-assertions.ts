import { DiffFile, DiffLine, Finding, RegressionLikelihood } from '../types';
import { matchMovedAssertions } from '../move-matcher';

// Lookbehinds ensure supertest .expect(200) or otherObj.expect( don't trigger.
const ASSERTION_PATTERN = /(?<![\w$.])expect\(|(?<![\w$.])assert\(|(?<![\w$])assert\.(equal|strictEqual|deepEqual|deepStrictEqual)\(|\.should\./;

export function isCommentLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

export function isAssertionLine(text: string): boolean {
  if (isCommentLine(text)) return false;
  return ASSERTION_PATTERN.test(text);
}

/**
 * Rule 1: Deleted Test Assertion
 * Detects removed assertion lines, groups them per file, and applies one-to-one move matching.
 */
export function evaluateRule1(files: DiffFile[]): Finding[] {
  const findings: Finding[] = [];

  // Collect all added lines across all JS/TS files for move matching
  const allAddedLines: DiffLine[] = [];
  for (const file of files) {
    if (!file.isJsTs || file.isGenerated) continue;
    for (const line of file.lines) {
      if (line.kind === 'added') {
        allAddedLines.push(line);
      }
    }
  }

  for (const file of files) {
    if (!file.isJsTs || file.isGenerated) continue;

    // Find all removed assertion lines in this file
    const removedAssertionLines = file.lines.filter(
      (l) => l.kind === 'removed' && isAssertionLine(l.text)
    );

    if (removedAssertionLines.length === 0) continue;

    // Perform one-to-one move matching
    const matchResult = matchMovedAssertions(removedAssertionLines, allAddedLines);

    // Determine group likelihood
    let likelihood: RegressionLikelihood = 'Uncertain';
    if (file.isTest) {
      if (matchResult.deletedCount > 0) {
        likelihood = 'Higher';
      } else if (matchResult.crossFileCount > 0) {
        likelihood = 'Uncertain';
      } else if (matchResult.movedCount > 0 && matchResult.deletedCount === 0) {
        likelihood = 'Lower';
      }
    } else {
      likelihood = 'Uncertain';
    }

    // Compose claim summary
    const total = removedAssertionLines.length;
    const parts: string[] = [];
    if (matchResult.deletedCount > 0) parts.push(`${matchResult.deletedCount} deleted`);
    if (matchResult.movedCount > 0) parts.push(`${matchResult.movedCount} moved`);
    if (matchResult.crossFileCount > 0) parts.push(`${matchResult.crossFileCount} cross-file`);

    const summaryBreakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    const fileLabel = file.path;
    const testPathNote = !file.isTest ? ' [non-test file]' : '';

    const claim = `${total} assertion line${total === 1 ? '' : 's'} removed in ${fileLabel}${summaryBreakdown}${testPathNote}`;

    const citedLineIds = removedAssertionLines.map((l) => l.id);
    const resolvedSnippets = removedAssertionLines.map((l) => ({
      lineId: l.id,
      file: l.file,
      lineNo: l.oldLine ?? 0,
      text: l.text,
      resolved: true,
    }));

    findings.push({
      id: `rule-1-${file.path}`,
      source: 'Rule',
      ruleId: 'R1',
      claim,
      detection: 'Matched',
      likelihood,
      citedLineIds,
      resolvedSnippets,
      guidance: 'Verify whether these tests were intentionally removed, refactored, or replaced elsewhere.',
    });
  }

  return findings;
}
