import type { Finding } from '../core/types';
import { FindingCard } from './FindingCard';

export interface BannerInfo {
  id: string;
  type: 'rules-only' | 'truncated' | 'llm-running' | 'llm-unavailable' | 'schema-drop';
  message: string;
  retryAction?: () => void;
}

interface EvidenceLedgerProps {
  findings: Finding[];
  banners: BannerInfo[];
  onJumpToLine: (lineId: string) => void;
}

export function EvidenceLedger({
  findings,
  banners,
  onJumpToLine,
}: EvidenceLedgerProps) {
  const ruleFindings = findings.filter((f) => f.source === 'Rule');
  const citedLLMFindings = findings.filter(
    (f) => f.source === 'LLM' && f.detection === 'Cited'
  );
  const uncitedLLMFindings = findings.filter(
    (f) => f.source === 'LLM' && f.detection === 'Uncited'
  );

  const totalFindingsCount = findings.length;

  return (
    <div class="evidence-ledger" id="evidence-ledger-container">
      {/* Composable Notice Banners */}
      {banners.map((b) => (
        <div key={b.id} class="ledger-banner">
          <div class="ledger-banner-title">
            {b.type === 'rules-only' && 'Notice: Rules Only Mode'}
            {b.type === 'truncated' && 'Notice: Line Truncation'}
            {b.type === 'llm-running' && 'Status: LLM Analysis Running…'}
            {b.type === 'llm-unavailable' && 'Status: LLM Analysis Unavailable'}
            {b.type === 'schema-drop' && 'Warning: Schema Validation Drop'}
          </div>
          <div>{b.message}</div>
          {b.retryAction && (
            <button
              type="button"
              style={{ marginTop: '6px', alignSelf: 'flex-start' }}
              onClick={b.retryAction}
            >
              Retry LLM Analysis
            </button>
          )}
        </div>
      ))}

      {/* Honest Empty State when zero findings */}
      {totalFindingsCount === 0 && banners.every((b) => b.type !== 'llm-running') && (
        <div class="ledger-empty-state">
          <div class="empty-state-headline">
            No findings. This does not mean the diff is safe.
          </div>
          <div class="empty-state-subtext">
            Deterministic rules matched no patterns. LLM analysis produced no
            evidencable hypotheses. Most real regressions depend on repository
            context outside this diff.
          </div>
        </div>
      )}

      {/* Deterministic Findings Section */}
      {ruleFindings.length > 0 && (
        <div class="ledger-section">
          <div class="section-header-row">
            <span class="section-title">Deterministic Findings (Rule-Matched)</span>
            <span class="section-count">{ruleFindings.length}</span>
          </div>
          {ruleFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onJumpToLine={onJumpToLine}
            />
          ))}
        </div>
      )}

      {/* LLM Hypotheses (Cited) Section */}
      {citedLLMFindings.length > 0 && (
        <div class="ledger-section">
          <div class="section-header-row">
            <span class="section-title">LLM Hypotheses (Cited)</span>
            <span class="section-count">{citedLLMFindings.length}</span>
          </div>
          {citedLLMFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onJumpToLine={onJumpToLine}
            />
          ))}
        </div>
      )}

      {/* Collapsed Drawer for Uncited Claims */}
      {uncitedLLMFindings.length > 0 && (
        <details class="uncited-drawer">
          <summary>
            <span>LLM claims without a valid citation ({uncitedLLMFindings.length})</span>
            <span>▼</span>
          </summary>
          <div class="uncited-drawer-content">
            {uncitedLLMFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onJumpToLine={onJumpToLine}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
