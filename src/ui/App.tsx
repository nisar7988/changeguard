import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import type { ParsedDiff, Finding, FixtureData, ResolvedSnippet } from '../core/types';
import { parseDiff } from '../core/parser';
import { runAllRules } from '../core/rules';
import { LandingView } from './LandingView';
import { WorkbenchView } from './WorkbenchView';
import type { BannerInfo } from './EvidenceLedger';

export function App() {
  const [view, setView] = useState<'landing' | 'workbench'>('landing');
  const [rawDiffText, setRawDiffText] = useState<string>('');
  const [rulesOnly, setRulesOnly] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [parsedDiff, setParsedDiff] = useState<ParsedDiff | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [banners, setBanners] = useState<BannerInfo[]>([]);
  const [isCached, setIsCached] = useState<boolean>(false);

  // Worker reference
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../worker/diff-worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch {
      // In environments where module workers are unsupported, we fall back to synchronous core calls
      workerRef.current = null;
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Parse and run rules either via worker or direct fallback
  const executeAnalysis = useCallback(
    (
      diffText: string,
      onComplete: (parsed: ParsedDiff, ruleFindings: Finding[]) => void,
      onError: (err: string) => void
    ) => {
      if (workerRef.current) {
        const handleMessage = (e: MessageEvent) => {
          workerRef.current?.removeEventListener('message', handleMessage);
          if (e.data.type === 'SUCCESS') {
            onComplete(e.data.parsedDiff, e.data.ruleFindings);
          } else {
            onError(e.data.error || 'Parsing error');
          }
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'PARSE_AND_RUN_RULES',
          rawDiff: diffText,
        });
      } else {
        // Direct fallback
        try {
          const parsed = parseDiff(diffText);
          const rules = runAllRules(parsed);
          onComplete(parsed, rules);
        } catch (err: unknown) {
          onError(err instanceof Error ? err.message : 'Parsing error');
        }
      }
    },
    []
  );

  // Load a sample fixture
  const handleSelectFixture = async (fixtureId: string) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/fixtures/${fixtureId}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load fixture ${fixtureId}`);
      }
      const fixture: FixtureData = await res.json();
      setRawDiffText(fixture.rawDiff);

      executeAnalysis(
        fixture.rawDiff,
        (parsed, ruleFindings) => {
          setParsedDiff(parsed);

          // Resolve snippets for LLM findings
          const llmFindings: Finding[] = (fixture.rawLLMResponse?.findings || []).map(
            (raw, idx) => {
              const citedIds = raw.cited_line_ids || [];
              const resolvedSnippets: ResolvedSnippet[] = citedIds.map((id) => {
                const line = parsed.lines.find((l) => l.id === id);
                if (line) {
                  return {
                    lineId: id,
                    file: line.file,
                    lineNo: line.newLine ?? line.oldLine ?? 1,
                    text: line.text,
                    resolved: true,
                  };
                }
                return {
                  lineId: id,
                  file: 'unknown',
                  lineNo: 0,
                  text: '[Not found in sent diff]',
                  resolved: false,
                };
              });

              // Check if all citations are present in sentLineIds
              const allCitationsSent = citedIds.length > 0 && citedIds.every((id) =>
                fixture.sentLineIds.includes(id)
              );

              const provenance =
                fixture.provenanceMap && fixture.provenanceMap[idx]
                  ? fixture.provenanceMap[idx]
                  : undefined;

              return {
                id: `llm-${idx + 1}`,
                source: 'LLM',
                claim: raw.claim,
                detection: allCitationsSent ? 'Cited' : 'Uncited',
                likelihood: 'Uncertain',
                citedLineIds: citedIds,
                resolvedSnippets,
                suggestedTest: raw.suggested_test,
                blindSpots: raw.blind_spots,
                provenance,
              };
            }
          );

          setFindings([...ruleFindings, ...llmFindings]);

          // Banners
          const activeBanners: BannerInfo[] = [];
          if (parsed.lines.some((l) => l.isTruncated)) {
            activeBanners.push({
              id: 'truncated',
              type: 'truncated',
              message:
                'One or more lines exceeded 2,000 characters and were truncated for analysis. IDs and counts are intact.',
            });
          }

          setBanners(activeBanners);
          setIsCached(true);
          setView('workbench');
        },
        (err) => {
          setErrorMessage(err);
        }
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading fixture');
    }
  };

  // Review user pasted diff
  const handleReviewDiff = () => {
    if (!rawDiffText.trim()) {
      setErrorMessage('Please paste a diff or select a pre-loaded fixture.');
      return;
    }
    setErrorMessage(null);

    executeAnalysis(
      rawDiffText,
      (parsed, ruleFindings) => {
        setParsedDiff(parsed);
        setFindings(ruleFindings);

        const activeBanners: BannerInfo[] = [];
        if (rulesOnly) {
          activeBanners.push({
            id: 'rules-only',
            type: 'rules-only',
            message:
              'Rules-only mode active. Diff was analyzed locally in your browser and not sent to external LLMs.',
          });
        } else {
          activeBanners.push({
            id: 'llm-unavailable',
            type: 'llm-unavailable',
            message:
              'Live LLM analysis disabled in this offline build. Showing deterministic results only.',
          });
        }

        if (parsed.lines.some((l) => l.isTruncated)) {
          activeBanners.push({
            id: 'truncated',
            type: 'truncated',
            message:
              'One or more lines exceeded 2,000 characters and were truncated for analysis. IDs and counts are intact.',
          });
        }

        setBanners(activeBanners);
        setIsCached(false);
        setView('workbench');
      },
      (err) => {
        setErrorMessage(`Failed to parse diff: ${err}`);
      }
    );
  };

  return (
    <div class="app-container">
      {view === 'landing' ? (
        <LandingView
          rawDiffText={rawDiffText}
          onRawDiffChange={setRawDiffText}
          rulesOnly={rulesOnly}
          onRulesOnlyChange={setRulesOnly}
          onReviewDiff={handleReviewDiff}
          onSelectFixture={handleSelectFixture}
          errorMessage={errorMessage}
        />
      ) : (
        parsedDiff && (
          <WorkbenchView
            parsedDiff={parsedDiff}
            findings={findings}
            banners={banners}
            isCached={isCached}
            onNewDiff={() => setView('landing')}
          />
        )
      )}
    </div>
  );
}
