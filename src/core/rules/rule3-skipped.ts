import { DiffFile, Finding, RegressionLikelihood } from '../types';

// Lookbehind ensures commit.skip( or process.exit( or otherMethod.only( don't match
const SKIP_ONLY_PATTERN = /(?<![\w$.])(it|test|describe)\.(skip|only)\(|(?<![\w$.])(xit|xdescribe|xtest|fit|fdescribe)\(/;
const TODO_PATTERN = /(?<![\w$.])(it|test|describe)\.todo\(/;

export function isCommentLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

/**
 * Rule 3: Skipped or Focused Tests
 * Detects newly introduced .skip, .only, xit, or .todo calls in test files.
 */
export function evaluateRule3(files: DiffFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (!file.isJsTs || file.isGenerated || !file.isTest) continue;

    for (const line of file.lines) {
      if (line.kind !== 'added') continue;
      if (isCommentLine(line.text)) continue;

      let matched = false;
      let likelihood: RegressionLikelihood = 'Higher';
      let claimType = '';

      if (SKIP_ONLY_PATTERN.test(line.text)) {
        matched = true;
        likelihood = 'Higher';
        claimType = 'Skipped or focused test introduced';
      } else if (TODO_PATTERN.test(line.text)) {
        matched = true;
        likelihood = 'Uncertain';
        claimType = 'Unimplemented test stub (.todo) introduced';
      }

      if (matched) {
        findings.push({
          id: `rule-3-${file.path}-${line.id}`,
          source: 'Rule',
          ruleId: 'R3',
          claim: `${claimType} in ${file.path}`,
          detection: 'Matched',
          likelihood,
          citedLineIds: [line.id],
          resolvedSnippets: [
            {
              lineId: line.id,
              file: line.file,
              lineNo: line.newLine ?? 0,
              text: line.text,
              resolved: true,
            },
          ],
          guidance:
            likelihood === 'Higher'
              ? 'Verify whether test skipping or focusing was introduced to mask a regression.'
              : 'Verify whether test stub represents planned work.',
        });
      }
    }
  }

  return findings;
}
