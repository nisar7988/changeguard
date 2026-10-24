import { useMemo } from 'preact/hooks';

interface LandingViewProps {
  rawDiffText: string;
  onRawDiffChange: (text: string) => void;
  rulesOnly: boolean;
  onRulesOnlyChange: (rulesOnly: boolean) => void;
  onReviewDiff: () => void;
  onSelectFixture: (fixtureId: string) => void;
  errorMessage: string | null;
}

export function LandingView({
  rawDiffText,
  onRawDiffChange,
  rulesOnly,
  onRulesOnlyChange,
  onReviewDiff,
  onSelectFixture,
  errorMessage,
}: LandingViewProps) {
  // Pre-send summary calculations
  const { lineCount, charCount, changedLinesCount, estimatedFiles } = useMemo(() => {
    if (!rawDiffText.trim()) {
      return { lineCount: 0, charCount: 0, changedLinesCount: 0, estimatedFiles: 0 };
    }
    const lines = rawDiffText.split('\n');
    let changed = 0;
    let files = 0;
    for (const line of lines) {
      if (line.startsWith('diff --git')) files++;
      if (
        (line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))
      ) {
        changed++;
      }
    }
    return {
      lineCount: lines.length,
      charCount: rawDiffText.length,
      changedLinesCount: changed,
      estimatedFiles: Math.max(files, files > 0 ? files : 1),
    };
  }, [rawDiffText]);

  // Secret scanner warning
  const secretWarning = useMemo(() => {
    if (!rawDiffText) return null;
    const awsMatch = /AKIA[0-9A-Z]{16}/.test(rawDiffText);
    const keyMatch = /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/.test(rawDiffText);
    const skMatch = /sk-[a-zA-Z0-9_-]{20,}/.test(rawDiffText);

    if (awsMatch || keyMatch || skMatch) {
      return 'Potential secret (API key, private token, or credentials) detected in diff. Consider enabling "Rules only" or removing secrets before sending.';
    }
    return null;
  }, [rawDiffText]);

  const isOverSize = charCount > 5 * 1024 * 1024; // 5 MB

  return (
    <div class="landing-view">
      <header class="landing-header">
        <div class="brand-row">
          <span class="brand-icon">CG</span>
          <h1 class="brand-title">ChangeGuard</h1>
        </div>
        <p class="brand-subtitle">
          Evidence-first review of AI diffs (JS/TS) · Epistemic separation of diff-visible facts from unverified hypotheses
        </p>
      </header>

      {/* Fixtures Selector */}
      <section>
        <div class="section-label">Pre-loaded evaluation fixtures</div>
        <div class="fixture-grid">
          <div
            class="fixture-card"
            onClick={() => onSelectFixture('real-01')}
            role="button"
            tabIndex={0}
          >
            <div>
              <div class="fixture-card-title">Real agent diff 1: Express cart checkout</div>
              <div class="fixture-card-desc">
                Agent refactors discount calculation, removes a test assertion, and adds an empty catch.
              </div>
            </div>
            <span class="fixture-card-badge">Load fixture</span>
          </div>

          <div
            class="fixture-card"
            onClick={() => onSelectFixture('real-02')}
            role="button"
            tabIndex={0}
          >
            <div>
              <div class="fixture-card-title">Real agent diff 2: Auth middleware refactor</div>
              <div class="fixture-card-desc">
                Agent refactors JWT authentication, moves test assertion, and introduces a skipped test.
              </div>
            </div>
            <span class="fixture-card-badge">Load fixture</span>
          </div>

          <div
            class="fixture-card"
            onClick={() => onSelectFixture('adversarial')}
            role="button"
            tabIndex={0}
          >
            <div>
              <div class="fixture-card-title">Adversarial fixture: Synthetic injection & citation test</div>
              <div class="fixture-card-desc">
                Embedded prompt injection attempt, accompanied by an intentional synthetic citation failure.
              </div>
            </div>
            <span class="fixture-card-badge">Load fixture</span>
          </div>
        </div>
      </section>

      {/* Paste Diff Area */}
      <section>
        <div class="section-label">Or paste a unified git diff</div>
        <div class="paste-container">
          <div class="paste-header">
            <span class="paste-meta">Unified Git Diff (JS/TS)</span>
            <span class="paste-meta">
              {lineCount} lines · {(charCount / 1024).toFixed(1)} KB / 5 MB max
            </span>
          </div>

          <textarea
            class="diff-textarea"
            placeholder="diff --git a/src/app.ts b/src/app.ts&#10;index 1234..5678 100644&#10;--- a/src/app.ts&#10;+++ b/src/app.ts&#10;@@ -10,4 +10,5 @@..."
            value={rawDiffText}
            onInput={(e) => onRawDiffChange((e.target as HTMLTextAreaElement).value)}
            spellcheck={false}
          />

          {rawDiffText.trim().length > 0 && (
            <div class="pre-send-summary">
              {rulesOnly
                ? `Rules-only: Will evaluate ${changedLinesCount} changed lines locally in browser`
                : `Will send ~${estimatedFiles} file(s), ${changedLinesCount} changed lines to third-party LLM`}
            </div>
          )}

          {secretWarning && (
            <div class="inline-warning-banner">⚠️ {secretWarning}</div>
          )}
        </div>
      </section>

      {/* Error Banner */}
      {errorMessage && (
        <div class="inline-error-banner">❌ {errorMessage}</div>
      )}
      {isOverSize && (
        <div class="inline-error-banner">
          ❌ Diff size exceeds 5 MB limit. Please truncate or review individual file diffs.
        </div>
      )}

      {/* Controls & Privacy */}
      <div class="controls-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={rulesOnly}
            onChange={(e) => onRulesOnlyChange((e.target as HTMLInputElement).checked)}
          />
          <span>Rules only (don't send my diff to external LLM)</span>
        </label>

        <div class="privacy-notice">
          <strong>Privacy Disclosure:</strong> Live LLM review forwards parsed JS/TS diff content to a third-party LLM provider via our stateless proxy. Platform logs or provider retention policies may apply. Use "Rules only" for confidential or proprietary diffs to ensure zero diff content leaves the browser.
        </div>

        <div class="honesty-disclaimer-card">
          <strong>Honesty Disclaimer:</strong> ChangeGuard separates diff-visible facts from LLM hypotheses. Findings are potential regressions, not verified bugs. <em>Matched</em> means a regex pattern is present; <em>Cited</em> means a cited line ID exists in the sent diff.
        </div>

        <div class="action-row">
          <button
            type="button"
            class="primary-cta"
            onClick={onReviewDiff}
            disabled={!rawDiffText.trim() || isOverSize}
          >
            Review diff →
          </button>
        </div>
      </div>
    </div>
  );
}
