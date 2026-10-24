import type { Finding, ParsedDiff } from '../types';

export interface ExportOptions {
  includeUncited?: boolean;
  isCached?: boolean;
  isRulesOnly?: boolean;
}

/**
 * Sanitizes markdown string to prevent injection, unwanted mentions, links, or HTML execution.
 */
export function sanitizeMarkdown(input: string): string {
  if (!input) return '';

  return (
    input
      // 1. Strip raw HTML tags
      .replace(/<[^>]*>/g, '')
      // 2. Neutralize markdown images: ![alt](url) -> [image: alt]
      .replace(/!\[(.*?)\]\(.*?\)/g, '[image: $1]')
      // 3. Neutralize markdown links: [text](url) -> `text`
      .replace(/\[(.*?)\]\(.*?\)/g, '`$1`')
      // 4. Neutralize GitHub mentions: @user -> @ user
      .replace(/@([a-zA-Z0-9_-]+)/g, '@ $1')
      // 5. Neutralize GitHub issue/PR auto-links: #123 -> # 123
      .replace(/#(\d+)/g, '# $1')
  );
}

/**
 * Computes a backtick fence longer than any consecutive backticks inside code content.
 */
export function getSafeFence(content: string): string {
  const matches = content.match(/`+/g);
  if (!matches) return '```';
  const maxLen = Math.max(...matches.map((m) => m.length));
  return '`'.repeat(Math.max(3, maxLen + 1));
}

/**
 * Generates an injection-safe Markdown report formatted for GitHub PR comments.
 */
export function generatePRReport(
  parsedDiff: ParsedDiff,
  findings: Finding[],
  options: ExportOptions = {}
): string {
  const { includeUncited = false, isCached = false, isRulesOnly = false } = options;

  const ruleFindings = findings.filter((f) => f.source === 'Rule');
  const citedLLMFindings = findings.filter(
    (f) => f.source === 'LLM' && f.detection === 'Cited'
  );
  const uncitedLLMFindings = findings.filter(
    (f) => f.source === 'LLM' && f.detection === 'Uncited'
  );

  const lines: string[] = [];

  // Header & Provenance
  lines.push('### ChangeGuard Regression Review');
  lines.push(
    `> **Status:** ${isCached ? '[Cached result]' : '[Live]'} · ${
      isRulesOnly ? '[Rules only]' : '[Rules + LLM]'
    }`
  );
  lines.push('');

  // Summary Metrics
  lines.push(
    `**Summary:** ${ruleFindings.length} deterministic findings · ${citedLLMFindings.length} LLM hypotheses (cited)${
      includeUncited ? ` · ${uncitedLLMFindings.length} uncited claims` : ''
    } · ${parsedDiff.files.length} files reviewed (${parsedDiff.totalChangedLines} changed lines)`
  );
  lines.push('');

  // Truncation Notice
  if (parsedDiff.lines.some((l) => l.isTruncated)) {
    lines.push(
      '> ⚠️ *Notice: One or more diff lines exceeded 2,000 characters and were truncated for analysis.*'
    );
    lines.push('');
  }

  // Empty State
  const totalReported =
    ruleFindings.length +
    citedLLMFindings.length +
    (includeUncited ? uncitedLLMFindings.length : 0);

  if (totalReported === 0) {
    lines.push('#### No findings. This does not mean the diff is safe.');
    lines.push(
      '_Deterministic rules matched no patterns. LLM analysis produced no evidencable hypotheses. Most real regressions depend on repository context outside this diff._'
    );
    return lines.join('\n');
  }

  // Deterministic Findings Section
  if (ruleFindings.length > 0) {
    lines.push('#### Deterministic Findings (Rule-Matched)');
    lines.push('');
    for (const f of ruleFindings) {
      lines.push(`- **[Rule] [${f.detection}] [${f.likelihood}]** ${sanitizeMarkdown(f.claim)}`);
      if (f.citedLineIds.length > 0) {
        lines.push(`  - Citations: ${f.citedLineIds.map((id) => `\`${id}\``).join(', ')}`);
      }
      if (f.guidance) {
        lines.push(`  - *Guidance:* ${sanitizeMarkdown(f.guidance)}`);
      }
      lines.push('');
    }
  }

  // LLM Hypotheses (Cited) Section
  if (citedLLMFindings.length > 0) {
    lines.push('#### LLM Hypotheses (Cited)');
    lines.push('');
    for (const f of citedLLMFindings) {
      lines.push(`- **[LLM] [Cited] [${f.likelihood}]** ${sanitizeMarkdown(f.claim)}`);
      if (f.citedLineIds.length > 0) {
        lines.push(`  - Citations: ${f.citedLineIds.map((id) => `\`${id}\``).join(', ')}`);
      }
      if (f.suggestedTest) {
        const fence = getSafeFence(f.suggestedTest);
        lines.push('  - *Suggested Test:*');
        lines.push(`  ${fence}typescript`);
        for (const testLine of f.suggestedTest.split('\n')) {
          lines.push(`  ${testLine}`);
        }
        lines.push(`  ${fence}`);
      }
      if (f.blindSpots && f.blindSpots.length > 0) {
        lines.push(`  - *Blind Spots:* ${f.blindSpots.map(sanitizeMarkdown).join('; ')}`);
      }
      lines.push('');
    }
  }

  // Uncited Section (if enabled)
  if (includeUncited && uncitedLLMFindings.length > 0) {
    lines.push('<details>');
    lines.push(`<summary><strong>LLM claims without a valid citation (${uncitedLLMFindings.length})</strong></summary>`);
    lines.push('');
    for (const f of uncitedLLMFindings) {
      lines.push(`- **[LLM] [Uncited] [${f.likelihood}]** ${sanitizeMarkdown(f.claim)}`);
      if (f.citedLineIds.length > 0) {
        lines.push(`  - Citations: ${f.citedLineIds.map((id) => `\`${id}\``).join(', ')}`);
      }
      lines.push('');
    }
    lines.push('</details>');
    lines.push('');
  }

  // Honesty Disclaimer Footer
  lines.push('---');
  lines.push(
    '_ChangeGuard separates diff-visible facts from LLM hypotheses. Findings are potential regressions, not verified bugs._'
  );

  const output = lines.join('\n');

  if (output.length > 65536) {
    return (
      `> ⚠️ **Warning: Report exceeds GitHub comment limit (65,536 characters). Review sections individually.**\n\n` +
      output.slice(0, 65000) +
      `\n\n...[Report truncated to fit GitHub comment limit]`
    );
  }

  return output;
}
