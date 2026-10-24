import { useState } from 'preact/hooks';
import type { ParsedDiff, Finding } from '../core/types';
import { DiffViewer } from './DiffViewer';
import { EvidenceLedger, type BannerInfo } from './EvidenceLedger';
import { ExportModal } from './ExportModal';

interface WorkbenchViewProps {
  parsedDiff: ParsedDiff;
  findings: Finding[];
  banners: BannerInfo[];
  isCached: boolean;
  isRulesOnly: boolean;
  onNewDiff: () => void;
}

export function WorkbenchView({
  parsedDiff,
  findings,
  banners,
  isCached,
  isRulesOnly,
  onNewDiff,
}: WorkbenchViewProps) {
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const ruleFindingsCount = findings.filter((f) => f.source === 'Rule').length;
  const citedLLMCount = findings.filter(
    (f) => f.source === 'LLM' && f.detection === 'Cited'
  ).length;
  const uncitedLLMCount = findings.filter(
    (f) => f.source === 'LLM' && f.detection === 'Uncited'
  ).length;

  const handleJumpToLine = (lineId: string) => {
    setHighlightedLineId(lineId);
  };

  return (
    <div class="workbench-view">
      {/* Top Bar */}
      <header class="top-bar">
        <div class="top-bar-left">
          <span class="brand-icon">CG</span>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>ChangeGuard</span>
          <span class={`provenance-pill ${isCached ? 'cached' : 'live'}`}>
            {isCached ? '[Cached result]' : '[Live]'}
          </span>
        </div>

        <div class="top-bar-right">
          <button type="button" onClick={onNewDiff}>
            ← New diff
          </button>
          <button type="button" class="primary-cta" style={{ padding: '4px 12px', fontSize: '13px' }} onClick={() => setIsExportOpen(true)}>
            Export
          </button>
        </div>
      </header>

      {/* Summary Metric Strip */}
      <div class="summary-strip">
        <span class="summary-metric">
          {ruleFindingsCount} deterministic {ruleFindingsCount === 1 ? 'finding' : 'findings'}
        </span>
        <span class="summary-sep">·</span>
        <span class="summary-metric">
          {citedLLMCount} LLM {citedLLMCount === 1 ? 'hypothesis' : 'hypotheses'} (cited)
        </span>
        <span class="summary-sep">·</span>
        <span class="summary-metric">
          {uncitedLLMCount} uncited {uncitedLLMCount === 1 ? 'claim' : 'claims'}
        </span>
        <span class="summary-sep">·</span>
        <span>
          {parsedDiff.files.length} {parsedDiff.files.length === 1 ? 'file' : 'files'},{' '}
          {parsedDiff.totalChangedLines} changed lines
        </span>
      </div>

      {/* Two-Pane Workbench */}
      <main class="workbench-grid">
        <DiffViewer
          parsedDiff={parsedDiff}
          findings={findings}
          highlightedLineId={highlightedLineId}
          onLineClick={handleJumpToLine}
        />
        <EvidenceLedger
          findings={findings}
          banners={banners}
          onJumpToLine={handleJumpToLine}
        />
      </main>

      {/* Export Dialog */}
      <ExportModal
        parsedDiff={parsedDiff}
        findings={findings}
        isCached={isCached}
        isRulesOnly={isRulesOnly}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
