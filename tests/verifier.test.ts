import { describe, it, expect } from 'vitest';
import { verifyCitations } from '../src/core/verifier';
import type { DiffLine, LLMRawFinding } from '../src/core/types';

describe('verifyCitations', () => {
  const dummyLines: DiffLine[] = [
    { id: 'L0001', file: 'src/app.ts', kind: 'context', oldLine: 1, newLine: 1, text: 'const a = 1;' },
    { id: 'L0002', file: 'src/app.ts', kind: 'removed', oldLine: 2, newLine: null, text: 'const b = 2;' },
    { id: 'L0003', file: 'src/app.ts', kind: 'added', oldLine: null, newLine: 2, text: 'const b = 3;' },
    { id: 'L0004', file: 'src/app.ts', kind: 'context', oldLine: 3, newLine: 3, text: 'return a + b;' },
  ];

  it('marks finding as Cited when all cited IDs are in sentLineIds and includes changed lines', () => {
    const raw: LLMRawFinding[] = [
      {
        claim: 'Value changed from 2 to 3',
        cited_line_ids: ['L0002', 'L0003'],
        suggested_test: 'test();',
      },
    ];

    const sent = ['L0001', 'L0002', 'L0003'];
    const results = verifyCitations(raw, sent, dummyLines);

    expect(results).toHaveLength(1);
    expect(results[0].detection).toBe('Cited');
    expect(results[0].source).toBe('LLM');
    expect(results[0].likelihood).toBe('Uncertain');
    expect(results[0].resolvedSnippets).toHaveLength(2);
    expect(results[0].resolvedSnippets[0].resolved).toBe(true);
    expect(results[0].resolvedSnippets[0].text).toBe('const b = 2;');
  });

  it('marks finding as Uncited if cited_line_ids is empty', () => {
    const raw: LLMRawFinding[] = [
      {
        claim: 'Vague assertion with no line citations',
        cited_line_ids: [],
        suggested_test: 'test();',
      },
    ];

    const results = verifyCitations(raw, ['L0002'], dummyLines);
    expect(results[0].detection).toBe('Uncited');
  });

  it('marks finding as Uncited if any cited ID is not in sentLineIds', () => {
    const raw: LLMRawFinding[] = [
      {
        claim: 'Claim citing line not sent to LLM',
        cited_line_ids: ['L0002', 'L9999'],
        suggested_test: 'test();',
      },
    ];

    const sent = ['L0002'];
    const results = verifyCitations(raw, sent, dummyLines);

    expect(results[0].detection).toBe('Uncited');
    const unresolved = results[0].resolvedSnippets.find((s) => s.lineId === 'L9999');
    expect(unresolved?.resolved).toBe(false);
    expect(unresolved?.isSent).toBe(false);
  });

  it('marks finding as Uncited if all citations are purely context lines', () => {
    const raw: LLMRawFinding[] = [
      {
        claim: 'Claim citing only unchanged context',
        cited_line_ids: ['L0001', 'L0004'],
        suggested_test: 'test();',
      },
    ];

    const sent = ['L0001', 'L0004'];
    const results = verifyCitations(raw, sent, dummyLines);

    expect(results[0].detection).toBe('Uncited');
  });

  it('attaches provenance from provenanceMap', () => {
    const raw: LLMRawFinding[] = [
      { claim: 'Finding 1', cited_line_ids: ['L0002'], suggested_test: 't1()' },
      { claim: 'Finding 2', cited_line_ids: ['L0003'], suggested_test: 't2()' },
    ];

    const sent = ['L0002', 'L0003'];
    const results = verifyCitations(raw, sent, dummyLines, {
      provenanceMap: { 0: 'real', 1: 'synthetic' },
    });

    expect(results[0].provenance).toBe('real');
    expect(results[1].provenance).toBe('synthetic');
  });
});
