import { describe, it, expect } from 'vitest';
import { validateLLMResponse } from '../src/core/schema';

describe('validateLLMResponse', () => {
  it('passes valid findings through', () => {
    const raw = {
      findings: [
        {
          claim: 'Potential null pointer dereference',
          cited_line_ids: ['L0001', 'L0002'],
          suggested_test: 'it("handles null", () => {});',
          blind_spots: ['External helper'],
        },
      ],
    };

    const result = validateLLMResponse(raw);
    expect(result.rootError).toBeUndefined();
    expect(result.droppedCount).toBe(0);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].claim).toBe('Potential null pointer dereference');
    expect(result.findings[0].cited_line_ids).toEqual(['L0001', 'L0002']);
  });

  it('fails entire tier if root is not an object or lacks findings array', () => {
    expect(validateLLMResponse(null).rootError).toBeDefined();
    expect(validateLLMResponse('string').rootError).toBeDefined();
    expect(validateLLMResponse([1, 2, 3]).rootError).toBeDefined();
    expect(validateLLMResponse({ other: [] }).rootError).toBeDefined();
  });

  it('clamps over-length claims (>300 chars) with ellipsis', () => {
    const longClaim = 'A'.repeat(350);
    const raw = {
      findings: [
        {
          claim: longClaim,
          cited_line_ids: ['L0001'],
          suggested_test: 'test();',
        },
      ],
    };

    const result = validateLLMResponse(raw);
    expect(result.findings[0].claim).toHaveLength(300);
    expect(result.findings[0].claim.endsWith('...')).toBe(true);
  });

  it('clamps over-length suggested_test (>1500 chars) with ellipsis', () => {
    const longTest = 'B'.repeat(1600);
    const raw = {
      findings: [
        {
          claim: 'Valid claim',
          cited_line_ids: ['L0001'],
          suggested_test: longTest,
        },
      ],
    };

    const result = validateLLMResponse(raw);
    expect(result.findings[0].suggested_test).toHaveLength(1500);
    expect(result.findings[0].suggested_test.endsWith('...')).toBe(true);
  });

  it('clamps cited_line_ids to maximum 10 citations', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `L000${i}`);
    const raw = {
      findings: [
        {
          claim: 'Valid claim',
          cited_line_ids: ids,
          suggested_test: 'test();',
        },
      ],
    };

    const result = validateLLMResponse(raw);
    expect(result.findings[0].cited_line_ids).toHaveLength(10);
  });

  it('clamps findings array to maximum 10 items', () => {
    const findings = Array.from({ length: 15 }, (_, i) => ({
      claim: `Claim ${i}`,
      cited_line_ids: ['L0001'],
      suggested_test: 'test();',
    }));

    const result = validateLLMResponse({ findings });
    expect(result.findings).toHaveLength(10);
  });

  it('drops malformed items and reports dropped count', () => {
    const raw = {
      findings: [
        { claim: 'Good item', cited_line_ids: ['L0001'], suggested_test: 'ok()' },
        { claim: '', cited_line_ids: ['L0001'], suggested_test: 'empty claim' }, // empty claim
        { claim: 'No citations', cited_line_ids: 'not-an-array', suggested_test: 'bad' }, // invalid cited_line_ids
        { claim: 'Invalid ids', cited_line_ids: [123, null], suggested_test: 'bad' }, // non-string citations
        { claim: 'Missing test', cited_line_ids: ['L0001'] }, // missing suggested_test
        null, // null item
      ],
    };

    const result = validateLLMResponse(raw);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].claim).toBe('Good item');
    expect(result.droppedCount).toBe(5);
  });
});
