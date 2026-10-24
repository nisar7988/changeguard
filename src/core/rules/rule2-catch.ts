import { DiffFile, DiffLine, Finding } from '../types';

// Matches single-line empty catch blocks e.g. catch {} or catch (e) {} or catch (err) { /* ignore */ }
const SINGLE_LINE_EMPTY_CATCH = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*\}/;

// Matches single-line empty promise catches e.g. .catch(() => {}) or .catch(function() {}) or .catch(() => null)
const EMPTY_PROMISE_CATCH = /\.catch\s*\(\s*(?:\(\s*\)\s*=>\s*\{\s*\}|function\s*\([^)]*\)\s*\{\s*\}|\(\s*(?:[a-zA-Z_$][\w$]*)?\s*\)\s*=>\s*(?:null|undefined|\{\s*\}))\s*\)/;

// Detects catch start line
const CATCH_START_REGEX = /\bcatch\s*(?:\([^)]*\))?\s*\{/;

/**
 * Checks if a string contains non-comment code
 */
function containsExecutableCode(code: string): boolean {
  // Strip single-line comments
  let stripped = code.replace(/\/\/[^\n]*/g, '');
  // Strip multi-line comments
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');
  return stripped.trim().length > 0;
}

/**
 * Rule 2: Introduced Empty Error Handler
 * Detects newly introduced empty catch blocks or swallow .catch handlers.
 */
export function evaluateRule2(files: DiffFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (!file.isJsTs || file.isGenerated) continue;

    const newViewLines = file.lines.filter((l) => l.kind === 'added' || l.kind === 'context');

    for (let i = 0; i < newViewLines.length; i++) {
      const line = newViewLines[i];

      // 1. Check for single-line promise .catch(() => {}) or .catch(() => null) where line is added
      if (line.kind === 'added' && EMPTY_PROMISE_CATCH.test(line.text)) {
        findings.push({
          id: `rule-2-${file.path}-${line.id}`,
          source: 'Rule',
          ruleId: 'R2',
          claim: `Introduced empty promise error handler in ${file.path}`,
          detection: 'Matched',
          likelihood: 'Higher',
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
          guidance: 'Verify that error handling was not dropped to bypass runtime exceptions.',
        });
        continue;
      }

      // 2. Check for single-line empty try/catch block
      if (SINGLE_LINE_EMPTY_CATCH.test(line.text)) {
        // Must contain at least one added line
        if (line.kind === 'added') {
          findings.push({
            id: `rule-2-${file.path}-${line.id}`,
            source: 'Rule',
            ruleId: 'R2',
            claim: `Introduced empty catch block in ${file.path}`,
            detection: 'Matched',
            likelihood: 'Higher',
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
            guidance: 'Verify that error handling was not dropped to bypass runtime exceptions.',
          });
          continue;
        }
      }

      // 3. Check for multi-line catch block (e.g. catch (e) { \n } )
      if (CATCH_START_REGEX.test(line.text)) {
        let blockText = '';
        const blockLines: DiffLine[] = [line];
        let hasAddedLine = line.kind === 'added';
        let foundClosingBrace = false;

        // Scan ahead up to 10 lines
        for (let j = i + 1; j < Math.min(newViewLines.length, i + 10); j++) {
          const nextLine = newViewLines[j];
          blockLines.push(nextLine);
          if (nextLine.kind === 'added') hasAddedLine = true;

          const closeIndex = nextLine.text.indexOf('}');
          if (closeIndex !== -1) {
            foundClosingBrace = true;
            // Extract body text between { and }
            blockText += nextLine.text.slice(0, closeIndex);
            break;
          } else {
            blockText += nextLine.text + '\n';
          }
        }

        if (foundClosingBrace && hasAddedLine && !containsExecutableCode(blockText)) {
          const citedLineIds = blockLines.map((l) => l.id);
          const resolvedSnippets = blockLines.map((l) => ({
            lineId: l.id,
            file: l.file,
            lineNo: l.newLine ?? 0,
            text: l.text,
            resolved: true,
          }));

          findings.push({
            id: `rule-2-${file.path}-${line.id}`,
            source: 'Rule',
            ruleId: 'R2',
            claim: `Introduced multi-line empty catch block in ${file.path}`,
            detection: 'Matched',
            likelihood: 'Higher',
            citedLineIds,
            resolvedSnippets,
            guidance: 'Verify that error handling was not dropped to bypass runtime exceptions.',
          });

          // Advance i past the scanned block
          i += blockLines.length - 1;
        }
      }
    }
  }

  return findings;
}
