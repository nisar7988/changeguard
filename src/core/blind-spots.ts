import type { ParsedDiff } from './types';

interface FuncSig {
  name: string;
  params: string;
  file: string;
}

const FUNC_DECL_PATTERNS = [
  /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/,
  /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
];

function extractFunctionSignature(text: string, file: string): FuncSig | null {
  for (const pattern of FUNC_DECL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        name: match[1],
        params: match[2].trim(),
        file,
      };
    }
  }
  return null;
}

/**
 * Detects repository-level blind spots where a function signature was changed in the diff,
 * but no callers exist within the diff to verify compatibility.
 */
export function detectSignatureBlindSpots(parsedDiff: ParsedDiff): string[] {
  const blindSpots: string[] = [];

  for (const file of parsedDiff.files) {
    if (file.isTest) continue; // Skip test files

    const removedSigs = new Map<string, string>(); // name -> params
    const addedSigs = new Map<string, string>(); // name -> params

    for (const line of file.lines) {
      if (line.kind === 'removed') {
        const sig = extractFunctionSignature(line.text, file.path);
        if (sig) removedSigs.set(sig.name, sig.params);
      } else if (line.kind === 'added') {
        const sig = extractFunctionSignature(line.text, file.path);
        if (sig) addedSigs.set(sig.name, sig.params);
      }
    }

    // Check for matching function names where parameters changed
    for (const [name, oldParams] of removedSigs) {
      const newParams = addedSigs.get(name);
      if (newParams !== undefined && oldParams !== newParams) {
        // Function signature changed! Now check if any callers exist in the diff
        const callRegex = new RegExp(`\\b${name}\\s*\\(`, 'g');
        let callCount = 0;

        for (const line of parsedDiff.lines) {
          // Exclude the definition lines themselves
          if (extractFunctionSignature(line.text, line.file)) continue;
          if (callRegex.test(line.text)) {
            callCount++;
          }
        }

        if (callCount === 0) {
          blindSpots.push(
            `[Computed: Callers not visible in diff] Function '${name}' signature changed, but callers are not visible in this diff.`
          );
        }
      }
    }
  }

  return blindSpots;
}
