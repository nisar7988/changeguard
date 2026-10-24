import { describe, it, expect } from 'vitest';
import { matchMovedAssertions, normalizeCodeLine } from '../src/core/move-matcher';
import { DiffLine } from '../src/core/types';

function createLine(id: string, file: string, kind: 'added' | 'removed', text: string): DiffLine {
  return {
    id,
    file,
    kind,
    oldLine: kind === 'removed' ? 1 : null,
    newLine: kind === 'added' ? 1 : null,
    text,
  };
}

describe('Assertion Move Matcher', () => {
  it('normalizes lines by stripping whitespace and trailing semicolons', () => {
    expect(normalizeCodeLine('  expect(x).toBe(10);  ')).toBe('expect(x).toBe(10)');
    expect(normalizeCodeLine('assert.equal(a, b);;;')).toBe('assert.equal(a, b)');
  });

  it('enforces strict one-to-one cancellation in the same file', () => {
    // 3 identical removed lines, but only 1 added line in the same file
    const removed: DiffLine[] = [
      createLine('L0001', 'cart.test.ts', 'removed', 'expect(true).toBe(true);'),
      createLine('L0002', 'cart.test.ts', 'removed', 'expect(true).toBe(true);'),
      createLine('L0003', 'cart.test.ts', 'removed', 'expect(true).toBe(true);'),
    ];

    const added: DiffLine[] = [
      createLine('L0010', 'cart.test.ts', 'added', '  expect(true).toBe(true)  '),
    ];

    const result = matchMovedAssertions(removed, added);

    expect(result.movedCount).toBe(1);
    expect(result.deletedCount).toBe(2);
    expect(result.crossFileCount).toBe(0);

    // The first removed line matched the added line
    expect(result.lines[0].status).toBe('moved');
    expect(result.lines[0].matchedAddedLineId).toBe('L0010');

    // The second and third removed lines cannot reuse L0010
    expect(result.lines[1].status).toBe('deleted');
    expect(result.lines[2].status).toBe('deleted');
  });

  it('marks identical lines in different files as cross-file rather than moved', () => {
    const removed: DiffLine[] = [
      createLine('L0001', 'cart.test.ts', 'removed', 'expect(isValid).toBe(true);'),
    ];

    const added: DiffLine[] = [
      createLine('L0020', 'other.test.ts', 'added', 'expect(isValid).toBe(true);'),
    ];

    const result = matchMovedAssertions(removed, added);

    expect(result.movedCount).toBe(0);
    expect(result.deletedCount).toBe(0);
    expect(result.crossFileCount).toBe(1);

    expect(result.lines[0].status).toBe('cross-file');
    expect(result.lines[0].matchedAddedLineId).toBe('L0020');
  });
});
