import type { DiffLine } from './types';

export interface IdentifierVisibility {
  name: string;
  visible: boolean;
}

const JS_TEST_ALLOWLIST = new Set([
  'describe',
  'it',
  'test',
  'expect',
  'toBe',
  'toEqual',
  'toStrictEqual',
  'toBeDefined',
  'toBeUndefined',
  'toBeNull',
  'toBeTruthy',
  'toBeFalsy',
  'toContain',
  'toThrow',
  'toThrowError',
  'rejects',
  'resolves',
  'async',
  'await',
  'const',
  'let',
  'var',
  'function',
  'return',
  'throw',
  'new',
  'Error',
  'Promise',
  'true',
  'false',
  'null',
  'undefined',
  'if',
  'else',
  'try',
  'catch',
  'finally',
  'import',
  'from',
  'export',
  'default',
  'type',
  'interface',
  'as',
  'typeof',
  'instanceof',
  'void',
  'string',
  'number',
  'boolean',
  'any',
  'unknown',
  'never',
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'JSON',
  'Math',
  'Date',
  'RegExp',
  'Map',
  'Set',
  'console',
  'log',
  'warn',
  'error',
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
  'mock',
  'fn',
  'spyOn',
  'vi',
  'jest',
  'req',
  'res',
  'next',
  'e',
  'err',
  'error',
]);

/**
 * Extracts all word tokens from a diff's lines to form an identifier universe.
 */
export function extractDiffIdentifiers(lines: DiffLine[]): Set<string> {
  const set = new Set<string>();
  const tokenRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;

  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(line.text)) !== null) {
      set.add(match[0]);
    }
  }

  return set;
}

/**
 * Checks identifiers in suggested test code against the diff identifier set and common JS allowlist.
 */
export function checkTestIdentifiers(
  testCode: string,
  diffIdentifiers: Set<string>
): IdentifierVisibility[] {
  if (!testCode || typeof testCode !== 'string') {
    return [];
  }

  // 1. Strip block comments and line comments
  let cleaned = testCode.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');

  // 2. Strip string literals (single, double, template)
  cleaned = cleaned.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, ' ');

  // 3. Strip property member access (e.g. .status, .length)
  cleaned = cleaned.replace(/\.[a-zA-Z_$][a-zA-Z0-9_$]*/g, ' ');

  // 4. Extract remaining top-level identifier tokens
  const tokenRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
  const seen = new Set<string>();
  const results: IdentifierVisibility[] = [];

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(cleaned)) !== null) {
    const token = match[0];
    if (seen.has(token) || JS_TEST_ALLOWLIST.has(token)) {
      continue;
    }
    seen.add(token);

    const isVisible = diffIdentifiers.has(token);
    results.push({
      name: token,
      visible: isVisible,
    });
  }

  return results;
}
