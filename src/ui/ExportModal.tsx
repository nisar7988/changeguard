import { useState, useMemo, useRef } from 'preact/hooks';
import type { Finding, ParsedDiff } from '../core/types';
import { generatePRReport } from '../core/export/pr-report';
import { generateAgentPrompt } from '../core/export/agent-prompt';

interface ExportModalProps {
  parsedDiff: ParsedDiff;
  findings: Finding[];
  isCached: boolean;
  isRulesOnly: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({
  parsedDiff,
  findings,
  isCached,
  isRulesOnly,
  isOpen,
  onClose,
}: ExportModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'pr' | 'agent'>('pr');
  const [includeUncited, setIncludeUncited] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const exportText = useMemo(() => {
    if (activeTab === 'pr') {
      return generatePRReport(parsedDiff, findings, {
        includeUncited,
        isCached,
        isRulesOnly,
      });
    } else {
      return generateAgentPrompt(parsedDiff, findings, {
        includeUncited,
      });
    }
  }, [activeTab, includeUncited, parsedDiff, findings, isCached, isRulesOnly]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch {
      // Fallback: select text in textarea so user can Ctrl+C
      if (textareaRef.current) {
        textareaRef.current.select();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleDownload = () => {
    const filename =
      activeTab === 'pr'
        ? 'changeguard-pr-report.md'
        : 'changeguard-agent-prompt.md';
    const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const charCount = exportText.length;
  const isOverGitHubLimit = activeTab === 'pr' && charCount > 65536;

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class="modal-header">
          <div class="modal-title">Export ChangeGuard Review</div>
          <button
            type="button"
            class="modal-close-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div class="modal-tabs">
          <button
            type="button"
            class={`modal-tab ${activeTab === 'pr' ? 'active' : ''}`}
            onClick={() => setActiveTab('pr')}
          >
            GitHub PR Report
          </button>
          <button
            type="button"
            class={`modal-tab ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            Hardened Agent Prompt
          </button>
        </div>

        {/* Options */}
        <div class="modal-options-row">
          <label class="checkbox-label" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={includeUncited}
              onChange={(e) => setIncludeUncited((e.target as HTMLInputElement).checked)}
            />
            <span>Include unevidenced LLM claims</span>
          </label>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              color: isOverGitHubLimit ? '#f85149' : 'var(--text-muted)',
            }}
          >
            {charCount.toLocaleString()} / 65,536 chars
            {isOverGitHubLimit && ' (exceeds GitHub limit)'}
          </span>
        </div>

        {/* Preview */}
        <div class="modal-preview-area">
          <textarea
            ref={textareaRef}
            class="modal-textarea"
            readonly
            value={exportText}
            spellcheck={false}
          />
        </div>

        {/* Footer */}
        <div class="modal-footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <div class="modal-footer-actions">
            <button type="button" onClick={handleDownload}>
              Download .md
            </button>
            <button
              type="button"
              class="primary-cta"
              onClick={handleCopy}
              style={{ padding: '6px 14px' }}
            >
              {copied ? '✓ Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
