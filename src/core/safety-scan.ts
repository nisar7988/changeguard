/**
 * Heuristic test-code safety scanner.
 * Scans suggested test code against sensitive environment, process, filesystem, and network primitives.
 *
 * NOTE: Absence of a warning does not guarantee test safety. Always read test code before running it.
 */

const DANGEROUS_PATTERNS = [
  /\bchild_process\b/,
  /\bexec\b/,
  /\bspawn\b/,
  /\bfs\b/,
  /\breadFile\b/,
  /\bwriteFile\b/,
  /\bunlink\b/,
  /\brimraf\b/,
  /\bshelljs\b/,
  /\beval\b/,
  /\bFunction\b/,
  /\bfetch\b/,
  /\baxios\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bprocess\.env\b/,
  /\bnet\b/,
  /\bhttp\b/,
  /\bhttps\b/,
];

export interface SafetyScanResult {
  hasWarning: boolean;
  detectedPrimitives: string[];
}

export function scanTestSafety(testCode?: string): SafetyScanResult {
  if (!testCode || typeof testCode !== 'string') {
    return { hasWarning: false, detectedPrimitives: [] };
  }

  const detected: string[] = [];

  for (const pattern of DANGEROUS_PATTERNS) {
    const match = testCode.match(pattern);
    if (match) {
      detected.push(match[0]);
    }
  }

  return {
    hasWarning: detected.length > 0,
    detectedPrimitives: Array.from(new Set(detected)),
  };
}
