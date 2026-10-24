import type { Finding } from '../core/types';
import { Tooltip } from './Tooltip';

interface FindingCardProps {
  finding: Finding;
  onJumpToLine: (lineId: string) => void;
}

export function FindingCard({ finding, onJumpToLine }: FindingCardProps) {
  const isRule = finding.source === 'Rule';
  const cardClass = isRule ? 'finding-card rule-card' : 'finding-card llm-card';

  // Likelihood chip class
  const likelihoodClass =
    finding.likelihood === 'Higher'
      ? 'chip-higher'
      : finding.likelihood === 'Lower'
      ? 'chip-lower'
      : 'chip-uncertain';

  return (
    <div class={cardClass} id={`finding-${finding.id}`}>
      <div class="card-top-row">
        <div class="chip-group">
          {/* Epistemic Source Badge */}
          <span class={`badge ${isRule ? 'badge-rule' : 'badge-llm'}`}>
            [{finding.source}]
          </span>

          {/* Detection Status Badge */}
          <span class="badge badge-detection">
            [{finding.detection}]
          </span>

          {/* Regression Likelihood Chip */}
          <span class={`badge ${likelihoodClass}`}>
            [{finding.likelihood}]
          </span>

          {/* Citation Verification Badge with Tooltip for LLM */}
          {!isRule && (
            <Tooltip
              content={
                finding.detection === 'Cited'
                  ? 'All cited line IDs were sent to the LLM and include at least one added or removed line.'
                  : 'Citation not verified: cited line was not present in the sent diff, or cites purely unchanged context lines.'
              }
            >
              <span class="badge badge-detection" style={{ cursor: 'help' }}>
                [{finding.detection === 'Cited' ? 'Citation verified' : 'Citation not verified'}] ℹ️
              </span>
            </Tooltip>
          )}

          {/* Adversarial Provenance Badge */}
          {finding.provenance === 'real' && (
            <span class="badge badge-detection">[Real LLM output]</span>
          )}
          {finding.provenance === 'synthetic' && (
            <span class="badge badge-detection">[Synthetic LLM response]</span>
          )}
        </div>
      </div>

      {/* Claim Title */}
      <div class="card-claim">{finding.claim}</div>

      {/* Citations Row */}
      {finding.citedLineIds && finding.citedLineIds.length > 0 && (
        <div class="citation-row">
          <span class="citation-label">Citations:</span>
          {finding.citedLineIds.map((lineId) => {
            const snippet = finding.resolvedSnippets?.find((s) => s.lineId === lineId);
            const isUnresolved = snippet && !snippet.resolved;
            const isUnsent = snippet && !snippet.isSent;

            let statusLabel = '';
            if (isUnresolved) {
              statusLabel = ' (not found in diff)';
            } else if (isUnsent) {
              statusLabel = ' (not in sent diff)';
            }

            return (
              <button
                type="button"
                key={lineId}
                class={`citation-chip ${isUnresolved || isUnsent ? 'unresolved' : ''}`}
                onClick={() => onJumpToLine(lineId)}
                title={
                  isUnresolved
                    ? `${lineId} (not found in diff)`
                    : isUnsent
                    ? `${lineId} (not in sent diff)`
                    : `Jump to ${lineId} in diff`
                }
              >
                {lineId}
                {statusLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Resolved Snippets */}
      {finding.resolvedSnippets && finding.resolvedSnippets.some((s) => s.resolved) && (
        <div class="snippet-box">
          {finding.resolvedSnippets
            .filter((s) => s.resolved)
            .map((s) => (
              <div key={s.lineId}>
                <strong>
                  {s.file}:{s.lineNo}
                </strong>{' '}
                ({s.lineId})
                <div>{s.text}</div>
              </div>
            ))}
        </div>
      )}

      {/* Suggested Test */}
      {finding.suggestedTest && (
        <div class="suggested-test-block">
          <div class="suggested-test-header">Suggested Verification Test</div>

          {finding.testSafetyWarning && (
            <div class="inline-warning-banner" style={{ margin: 0, padding: '6px 10px' }}>
              ⚠️ <strong>[Warning: Suggested test references environment/network APIs]</strong>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Absence of a warning does not guarantee test safety. Always read test code before running it.
              </div>
            </div>
          )}

          {finding.testIdentifiers && finding.testIdentifiers.some((t) => !t.visible) && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Identifiers outside diff:</span>
              {finding.testIdentifiers
                .filter((t) => !t.visible)
                .map((t) => (
                  <span key={t.name} class="badge badge-detection" title="Identifier not found in diff tokens">
                    {t.name} [Not visible in diff]
                  </span>
                ))}
            </div>
          )}

          <pre class="test-code-pre">{finding.suggestedTest}</pre>
        </div>
      )}

      {/* Blind Spots */}
      {finding.blindSpots && finding.blindSpots.length > 0 && (
        <div class="card-guidance">
          {finding.blindSpots.map((spot, i) => (
            <div key={i}>⚠️ {spot}</div>
          ))}
        </div>
      )}

      {/* Guidance */}
      {finding.guidance && (
        <div class="card-guidance">
          ℹ️ {finding.guidance}
        </div>
      )}
    </div>
  );
}
