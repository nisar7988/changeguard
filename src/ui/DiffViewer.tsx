import { useEffect, useState, useMemo } from 'preact/hooks';
import type { ParsedDiff, Finding } from '../core/types';

interface DiffViewerProps {
  parsedDiff: ParsedDiff;
  findings: Finding[];
  highlightedLineId: string | null;
  onLineClick?: (lineId: string) => void;
}

export function DiffViewer({
  parsedDiff,
  findings,
  highlightedLineId,
  onLineClick,
}: DiffViewerProps) {
  // Map of lineId -> 'rule' | 'llm'
  const citationMap = useMemo(() => {
    const map = new Map<string, 'rule' | 'llm'>();
    for (const f of findings) {
      const type = f.source === 'Rule' ? 'rule' : 'llm';
      for (const id of f.citedLineIds) {
        // Rule takes precedence if both cite same line
        if (!map.has(id) || type === 'rule') {
          map.set(id, type);
        }
      }
    }
    return map;
  }, [findings]);

  // Files with rule hits
  const filesWithRuleHits = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      if (f.source === 'Rule') {
        for (const id of f.citedLineIds) {
          const line = parsedDiff.lines.find((l) => l.id === id);
          if (line) set.add(line.file);
        }
      }
    }
    return set;
  }, [findings, parsedDiff]);

  // Default collapse state: collapse if total lines > 1,000 or files > 5, except files with rule hits
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>(() => {
    const isLarge = parsedDiff.lines.length > 1000 || parsedDiff.files.length > 5;
    const initial: Record<string, boolean> = {};
    if (isLarge) {
      for (const file of parsedDiff.files) {
        if (!filesWithRuleHits.has(file.path)) {
          initial[file.path] = true;
        }
      }
    }
    return initial;
  });

  // Toggle file collapse
  const toggleFile = (path: string) => {
    setCollapsedFiles((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // When highlightedLineId changes, expand containing file if collapsed, and scroll into view with flash
  useEffect(() => {
    if (!highlightedLineId) return;

    const line = parsedDiff.lines.find((l) => l.id === highlightedLineId);
    if (line && collapsedFiles[line.file]) {
      setCollapsedFiles((prev) => ({ ...prev, [line.file]: false }));
    }

    // Scroll to row and trigger flash
    const el = document.getElementById(`diff-line-${highlightedLineId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('flash');
      // trigger reflow
      void el.offsetWidth;
      el.classList.add('flash');
    }
  }, [highlightedLineId, parsedDiff, collapsedFiles]);

  return (
    <div class="diff-viewer" id="diff-viewer-container">
      {parsedDiff.files.map((file) => {
        const isCollapsed = !!collapsedFiles[file.path];
        const addedCount = file.lines.filter((l) => l.kind === 'added').length;
        const removedCount = file.lines.filter((l) => l.kind === 'removed').length;

        return (
          <div key={file.path} class="diff-file-block">
            {/* Sticky File Header */}
            <div
              class="diff-file-header"
              onClick={() => toggleFile(file.path)}
              title="Click to toggle file diff"
            >
              <div class="diff-file-path">
                <span>{isCollapsed ? '▶' : '▼'}</span>
                <span>{file.path}</span>
                {file.isTest && <span class="badge badge-detection">test</span>}
                {file.isGenerated && <span class="badge badge-detection">generated</span>}
              </div>
              <div class="diff-file-stats">
                <span class="stat-add">+{addedCount}</span>
                <span class="stat-remove">-{removedCount}</span>
              </div>
            </div>

            {/* Lines Table */}
            {!isCollapsed && (
              <table class="diff-lines-table">
                <tbody>
                  {file.lines.map((line) => {
                    const citationType = citationMap.get(line.id);
                    const marker =
                      line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' ';
                    const rowClass = `diff-line-row ${line.kind}`;

                    return (
                      <tr
                        key={line.id}
                        id={`diff-line-${line.id}`}
                        class={rowClass}
                        onClick={() => onLineClick?.(line.id)}
                      >
                        {/* Gutter Indicator Dot */}
                        <td class="diff-cell-gutter">
                          {citationType && (
                            <span class={`gutter-dot ${citationType}`} title={`Cited by ${citationType.toUpperCase()}`}>
                              ●
                            </span>
                          )}
                        </td>

                        {/* Global Line ID */}
                        <td class="diff-cell-id">{line.id}</td>

                        {/* Old Line Number */}
                        <td class="diff-cell-num">{line.oldLine ?? ''}</td>

                        {/* New Line Number */}
                        <td class="diff-cell-num">{line.newLine ?? ''}</td>

                        {/* Line Marker */}
                        <td class="diff-cell-marker">{marker}</td>

                        {/* Code Text */}
                        <td class="diff-cell-code">
                          {line.text}
                          {line.isTruncated && <span> [line truncated]</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
