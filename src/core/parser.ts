import { DiffFile, DiffLine, LineKind, ParsedDiff } from './types';

const JS_TS_REGEX = /\.(js|jsx|ts|tsx|mjs|cjs)$/i;
const TEST_PATH_REGEX = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\./i;
const GENERATED_PATH_REGEX = /(\.min\.(js|css)|\.map|\.bundle\.js)$|(^|\/)(dist|build|node_modules|coverage)\//i;
const HUNK_HEADER_REGEX = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

/**
 * Normalizes a file path from a diff line (e.g., "a/src/index.ts" -> "src/index.ts").
 * Handles /dev/null, quotes, and git prefixes.
 */
export function normalizeDiffPath(rawPath: string): string {
  let cleaned = rawPath.trim();
  if (cleaned === '/dev/null') return '/dev/null';

  // Handle quoted paths (e.g., '"a/my file.ts"')
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }

  // Strip leading a/ or b/
  if (cleaned.startsWith('a/') || cleaned.startsWith('b/')) {
    cleaned = cleaned.slice(2);
  }

  return cleaned;
}

/**
 * Checks if a path is classified as JS/TS.
 */
export function isJsTsPath(path: string): boolean {
  return JS_TS_REGEX.test(path);
}

/**
 * Checks if a path is classified as a test file.
 */
export function isTestPath(path: string): boolean {
  return TEST_PATH_REGEX.test(path);
}

/**
 * Checks if a path is generated/minified.
 */
export function isGeneratedPath(path: string): boolean {
  return GENERATED_PATH_REGEX.test(path);
}

/**
 * Parses a unified git diff string into structured file and line models
 * with sequential global IDs (L0001, L0002, ...).
 */
export function parseDiff(rawDiff: string): ParsedDiff {
  if (!rawDiff || typeof rawDiff !== 'string') {
    return { files: [], lines: [], totalChangedLines: 0 };
  }

  // Normalize CRLF to LF and trim trailing newlines
  const normalized = rawDiff.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  if (!normalized) {
    return { files: [], lines: [], totalChangedLines: 0 };
  }
  const rawLines = normalized.split('\n');

  const files: DiffFile[] = [];
  const allLines: DiffLine[] = [];
  let globalLineCounter = 1;
  let totalChangedLines = 0;

  let currentFile: DiffFile | null = null;
  let currentOldLine = 0;
  let currentNewLine = 0;
  let inHunk = false;

  function padLineId(num: number): string {
    return `L${num.toString().padStart(4, '0')}`;
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Check for "diff --git a/... b/..."
    if (line.startsWith('diff --git ')) {
      inHunk = false;
      // Parse file paths from "diff --git a/path b/path"
      const rest = line.slice('diff --git '.length).trim();
      let path = '';
      let oldPath: string | undefined;

      // Handle quotes or standard split
      if (rest.startsWith('"')) {
        const parts = rest.match(/^"([^"]+)"\s+"([^"]+)"$/);
        if (parts) {
          oldPath = normalizeDiffPath(parts[1]);
          path = normalizeDiffPath(parts[2]);
        } else {
          path = normalizeDiffPath(rest);
        }
      } else {
        const parts = rest.split(/\s+/);
        if (parts.length >= 2) {
          oldPath = normalizeDiffPath(parts[0]);
          path = normalizeDiffPath(parts[1]);
        } else {
          path = normalizeDiffPath(rest);
        }
      }

      currentFile = {
        path,
        oldPath: oldPath !== path ? oldPath : undefined,
        isTest: isTestPath(path),
        isJsTs: isJsTsPath(path),
        isGenerated: isGeneratedPath(path),
        lines: [],
      };
      files.push(currentFile);
      continue;
    }

    // Check for "--- a/path" or "+++ b/path" when diff header wasn't present
    if (line.startsWith('--- ')) {
      const rawPath = line.slice(4).trim();
      const norm = normalizeDiffPath(rawPath);
      if (norm !== '/dev/null' && (!currentFile || currentFile.path === '/dev/null')) {
        if (!currentFile) {
          currentFile = {
            path: norm,
            isTest: isTestPath(norm),
            isJsTs: isJsTsPath(norm),
            isGenerated: isGeneratedPath(norm),
            lines: [],
          };
          files.push(currentFile);
        } else {
          currentFile.oldPath = norm;
        }
      }
      continue;
    }

    if (line.startsWith('+++ ')) {
      const rawPath = line.slice(4).trim();
      const norm = normalizeDiffPath(rawPath);
      if (norm !== '/dev/null') {
        if (!currentFile) {
          currentFile = {
            path: norm,
            isTest: isTestPath(norm),
            isJsTs: isJsTsPath(norm),
            isGenerated: isGeneratedPath(norm),
            lines: [],
          };
          files.push(currentFile);
        } else if (currentFile.path === '/dev/null' || currentFile.path === '') {
          currentFile.path = norm;
          currentFile.isTest = isTestPath(norm);
          currentFile.isJsTs = isJsTsPath(norm);
          currentFile.isGenerated = isGeneratedPath(norm);
        }
      }
      continue;
    }

    // Skip git metadata headers
    if (
      line.startsWith('index ') ||
      line.startsWith('new file mode ') ||
      line.startsWith('deleted file mode ') ||
      line.startsWith('similarity index ') ||
      line.startsWith('rename from ') ||
      line.startsWith('rename to ') ||
      line.startsWith('old mode ') ||
      line.startsWith('new mode ') ||
      line.startsWith('Binary files ') ||
      line.startsWith('GIT binary patch')
    ) {
      continue;
    }

    // Check for Hunk header @@ -oldStart,oldLen +newStart,newLen @@
    const hunkMatch = line.match(HUNK_HEADER_REGEX);
    if (hunkMatch) {
      if (!currentFile) {
        currentFile = {
          path: 'unknown',
          isTest: false,
          isJsTs: false,
          isGenerated: false,
          lines: [],
        };
        files.push(currentFile);
      }
      inHunk = true;
      currentOldLine = parseInt(hunkMatch[1], 10);
      currentNewLine = parseInt(hunkMatch[3], 10);
      continue;
    }

    // Inside a hunk
    if (inHunk && currentFile) {
      // Ignore "\ No newline at end of file"
      if (line.startsWith('\\ No newline at end of file')) {
        continue;
      }

      const marker = line.charAt(0);
      let kind: LineKind | null = null;
      let text = line.slice(1);
      let oldLine: number | null = null;
      let newLine: number | null = null;
      let isTruncated = false;

      // Truncate lines exceeding 2,000 characters
      if (text.length > 2000) {
        text = text.slice(0, 2000) + ' [line truncated]';
        isTruncated = true;
      }

      if (marker === '+') {
        kind = 'added';
        oldLine = null;
        newLine = currentNewLine++;
        totalChangedLines++;
      } else if (marker === '-') {
        kind = 'removed';
        oldLine = currentOldLine++;
        newLine = null;
        totalChangedLines++;
      } else if (marker === ' ' || line === '') {
        kind = 'context';
        oldLine = currentOldLine++;
        newLine = currentNewLine++;
        // If empty line in hunk without marker, treat as empty context
        if (line === '') text = '';
      }

      if (kind) {
        const diffLine: DiffLine = {
          id: padLineId(globalLineCounter++),
          file: currentFile.path,
          kind,
          oldLine,
          newLine,
          text,
          isTruncated,
        };
        currentFile.lines.push(diffLine);
        allLines.push(diffLine);
      }
    }
  }

  return {
    files,
    lines: allLines,
    totalChangedLines,
  };
}
