export type LineKind = 'added' | 'removed' | 'context';

export interface DiffLine {
  id: string;               // Global permanent ID: "L0001", "L0002"
  file: string;             // Normalized file path: "src/cart.ts"
  kind: LineKind;
  oldLine: number | null;   // null for added lines
  newLine: number | null;   // null for removed lines
  text: string;             // Line text without leading +/- marker
  isTruncated?: boolean;    // true if line exceeded 2,000 chars
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  isTest: boolean;
  isJsTs: boolean;
  isGenerated: boolean;     // dist/, min.js, bundle.js
  lines: DiffLine[];
}

export interface ParsedDiff {
  files: DiffFile[];
  lines: DiffLine[];
  totalChangedLines: number;
}

export type FindingSource = 'Rule' | 'LLM';
export type DetectionStatus = 'Matched' | 'Cited' | 'Uncited';
export type RegressionLikelihood = 'Higher' | 'Lower' | 'Uncertain';

export interface ResolvedSnippet {
  lineId: string;
  file: string;
  lineNo: number;
  text: string;
  resolved: boolean;
  isSent?: boolean;
}

export interface Finding {
  id: string;
  source: FindingSource;
  ruleId?: 'R1' | 'R2' | 'R3';
  claim: string;
  detection: DetectionStatus;
  likelihood: RegressionLikelihood;
  citedLineIds: string[];
  resolvedSnippets: ResolvedSnippet[];
  suggestedTest?: string;
  testSafetyWarning?: boolean;
  testIdentifiers?: { name: string; visible: boolean }[];
  blindSpots?: string[];
  guidance?: string;
  provenance?: 'real' | 'synthetic';
}

export interface LLMRawFinding {
  claim: string;
  cited_line_ids: string[];
  suggested_test: string;
  blind_spots?: string[];
}

export interface LLMRawResponse {
  findings: LLMRawFinding[];
}

export interface FixtureData {
  id: string;
  name: string;
  rawDiff: string;
  sentLineIds: string[];
  rawLLMResponse: LLMRawResponse;
  provenanceMap?: Record<number, 'real' | 'synthetic'>;
}
