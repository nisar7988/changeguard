import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import type { ParsedDiff, Finding, FixtureData } from '../core/types';
import { parseDiff } from '../core/parser';
import { runAllRules } from '../core/rules';
import { validateLLMResponse } from '../core/schema';
import { verifyCitations } from '../core/verifier';
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

          // Validate LLM JSON schema per item
          const validated = validateLLMResponse(fixture.rawLLMResponse);

          // Verify citations against sentLineIds and diff line models dynamically
          const verifiedLLMFindings = verifyCitations(
            validated.findings,
            fixture.sentLineIds,
            parsed.lines,
            { provenanceMap: fixture.provenanceMap }
          );

          setFindings([...ruleFindings, ...verifiedLLMFindings]);

          // Banners
          const activeBanners: BannerInfo[] = [];

          if (validated.rootError) {
            activeBanners.push({
              id: 'root-schema-error',
              type: 'schema-drop',
              message: `LLM analysis dropped: ${validated.rootError}`,
            });
          }

          if (validated.droppedCount > 0) {
            activeBanners.push({
              id: 'schema-drop',
              type: 'schema-drop',
              message: `${validated.droppedCount} LLM finding(s) dropped due to invalid schema.`,
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
