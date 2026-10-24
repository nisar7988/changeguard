import type { Finding } from '../core/types';

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

            return (
              <button
                type="button"
                key={lineId}
                class={`citation-chip ${isUnresolved ? 'unresolved' : ''}`}
                onClick={() => onJumpToLine(lineId)}
                title={isUnresolved ? `${lineId} (not found in sent diff)` : `Jump to ${lineId} in diff`}
              >
                {lineId}
                {isUnresolved ? ' (not found)' : ''}
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
                <strong>{s.file}:{s.lineNo}</strong> ({s.lineId})
                <div>{s.text}</div>
              </div>
            ))}
        </div>
      )}

      {/* Suggested Test */}
      {finding.suggestedTest && (
        <div class="suggested-test-block">
          <div class="suggested-test-header">Suggested Verification Test</div>
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
