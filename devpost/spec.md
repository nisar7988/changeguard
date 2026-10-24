---
doc: spec
status: approved
---

# ChangeGuard — Technical Specification

An honest regression reviewer for AI-generated JS/TS diffs that separates diff-visible facts from unverified hypotheses.  
Source: `prd.md`, `scope.md` (Revision 5)

---

## How This Works, In Plain Language

ChangeGuard is designed as an offline-capable, client-side workbench paired with an optional stateless serverless proxy.

1. **Pure TypeScript Core (`src/core/`):** All parsing, rule evaluation, move matching, citation verification, safety scanning, identifier extraction, and export sanitization are written as pure functions with zero DOM or framework dependencies. This allows 100% automated test coverage in Node via Vitest without needing browser mocks.
2. **Dedicated Web Worker (`src/worker/`):** Diff parsing and regex rule execution run off the main browser thread. When a developer pastes a multi-megabyte diff (up to the 5 MB cap), the UI remains completely responsive with no dropped frames or thread freezes.
3. **Reactive UI (`src/ui/` with Preact):** Preact (3kB) manages the interactive workbench: bi-directional line-to-card jumping, gutter indicators, file collapse/expansion, expandable drawers, focusable tooltips, composable banners, and the dual-tab export modal. Preact provides declarative reactivity without the overhead of heavy frameworks.
4. **Self-Hosted Typography:** IBM Plex Sans and IBM Plex Mono are packaged locally via `@fontsource`. When the user toggles "Rules only (don't send my diff)", literally zero network packets leave the browser—no third-party font calls or telemetry.
5. **Stateless Serverless Proxy (`api/review.ts`):** Live LLM analysis sends prioritized diff hunks (~400 changed lines) through an isolated serverless endpoint that holds the API key. An adapter file (`api/adapter.ts`) isolates model invocation from the application logic. Upstash Redis handles rate limiting (10 req/hr per IP plus daily spend cap), failing gracefully to deterministic results if limits are met.

---

## The Core Journey Through the System

Traced step by step through the technical architecture:

```
[User Input: Paste or Sample]
         │
         ▼
[Web Worker: src/worker/diff-worker.ts]
  ├── src/core/parser.ts: Normalize paths, strip a/b, assign permanent L0001.. IDs
  └── src/core/rules/: Run Rules 1-3, move-matcher, and computed caller checks
         │
         ▼ (Instant postMessage)
[Preact State: src/ui/App.tsx]
  ├── Renders Unified Diff View (src/ui/DiffViewer.tsx) with colored gutter markers
  └── Renders Deterministic Findings in Evidence Ledger (src/ui/EvidenceLedger.tsx)
         │
         ├── If Fixture: Loads raw JSON from public/fixtures/
         │     └── Runs src/core/verifier.ts & schema.ts client-side dynamically
         │
         └── If Live Diff & Rules-Only unchecked:
               │
               ▼ (fetch /api/review)
         [Vercel Serverless Function: api/review.ts]
           ├── Upstash Rate Limiter check (10/hr per IP + daily cap)
           └── api/adapter.ts: Calls LLM with structured output schema
               │
               ▼ (JSON response)
         [Client Verification Pipeline]
           ├── src/core/schema.ts: Per-item validation & clamping
           ├── src/core/verifier.ts: Checks citations against sentLineIds & resolves snippets
           ├── src/core/safety-scan.ts: Scans suggested tests for sensitive APIs
           └── src/core/identifiers.ts: Checks test identifiers against diff allowlist
               │
               ▼
[Preact State Update: Slots LLM Hypotheses into Ledger & auto-expands cited files]
         │
         ▼
[Export Modal: src/ui/ExportModal.tsx]
  ├── src/core/export/pr-report.ts: Formats GitHub PR comment, strips HTML/links/mentions
  └── src/core/export/agent-prompt.ts: Fences untrusted diff & LLM text inside data block
```

PRD ref: `prd.md > The Core Journey`

---

## Stack

| Layer | Technology | Version | Rationale & Tradeoff | Documentation |
|---|---|---|---|---|
| **Language** | TypeScript | `^5.6` | Type safety for line models, schemas, and findings. Prevents runtime property misresolutions. | [typescriptlang.org](https://www.typescriptlang.org/docs/) |
| **Bundler & Dev Server** | Vite | `^6.0` | Instant HMR, zero-config native Web Worker bundling (`new Worker(new URL(...), { type: 'module' })`), fast build. | [vite.dev](https://vite.dev/) |
| **UI Framework** | Preact | `^10.25` | 3kB reactive runtime with standard React-like hooks (`useState`, `useMemo`, `useRef`). Eliminates manual DOM sync bugs across cross-linked diffs and cards. | [preactjs.com](https://preactjs.com/) |
| **Test Runner** | Vitest | `^3.0` | Native Vite test runner. Executes pure-function unit tests in Node with zero configuration. | [vitest.dev](https://vitest.dev/) |
| **Styling** | Vanilla CSS | CSS3 | CSS Custom Properties matching the design token table. Zero utility-class bloat or setup friction. | [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS) |
| **Typography** | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | Latest | Self-hosted webfonts. Guarantees zero network calls to Google Fonts in "Rules only" mode. | [fontsource.org](https://fontsource.org/) |
| **Serverless Hosting** | Vercel | Latest | Single-command deployment of static Vite assets and `/api/review.ts` serverless route. | [vercel.com/docs](https://vercel.com/docs) |
| **Rate Limiter** | `@upstash/ratelimit`, `@upstash/redis` | Latest | Stateless Redis-backed rate limiting per IP + global daily cap for serverless functions. | [upstash.com/docs](https://upstash.com/docs) |
| **LLM SDK** | `@anthropic-ai/sdk` (with adapter) | Latest | Primary target: Anthropic Claude 3.5 Sonnet / Haiku via structured tool use. Isolated behind `api/adapter.ts`. | [docs.anthropic.com](https://docs.anthropic.com/) |

---

## Where It Runs and How Someone Tries It

### Local Development & Video Recording (Meets Submission Requirement)
- **Runtime:** Node.js 18+ and modern browser (Safari 16.4+, Chrome, Firefox).
- **Environment:** No environment variables or API keys are required to run locally. All sample fixtures run 100% client-side with raw JSON and dynamic verifier execution.
- **Start Command:**
  ```bash
  npm install
  npm run dev
  ```
- **Demo URL:** Opens at `http://localhost:5173`.
- **Test Command:**
  ```bash
  npx vitest run
  ```

### Optional Production Deployment (Vercel)
- **Deployment:** Connect repository to Vercel or run `npx vercel`.
- **Environment Variables (Optional for live proxy):**
  - `LLM_PROVIDER`: `anthropic` (default) | `openai` | `gemini`
  - `ANTHROPIC_API_KEY`: API key with spend cap configured.
  - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis instance credentials.
- If environment variables are absent, live diff submissions gracefully fall back to deterministic rules with the notice: *"Live LLM analysis disabled in this deployment."*

---

## Look and Feel

Carried forward directly from `prd.md > Look and Feel` and implemented in `src/index.css`:

```css
:root {
  --bg: #0e1116;
  --surface: #151a21;
  --surface-raised: #1c222b;
  --border: #262d37;
  --border-subtle: #30363d;
  --text: #d7dde5;
  --text-muted: #8b96a5;
  --rule-accent: #5aa9e6;
  --llm-accent: #d4a24c;
  --diff-add-bg: rgba(46, 160, 67, 0.15);
  --diff-add-text: #3fb950;
  --diff-remove-bg: rgba(248, 81, 73, 0.15);
  --diff-remove-text: #f85149;
  --chip-higher-bg: #30363d;
  --chip-higher-text: #f0f6fc;
  --chip-uncertain-border: #8b96a5;
  --chip-lower-bg: rgba(139, 150, 165, 0.15);
  --chip-lower-text: #8b96a5;
  --radius: 4px;
  --font-ui: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
}
```

- **Surfaces & Borders:** 1px borders, 4px maximum border-radius, flat surfaces, zero gradients, zero glow.
- **Visual Encoding:** Card border style is the primary epistemic indicator: **solid** for Rule matches, **dashed** for LLM hypotheses.
- **Gutter Indicators:** Steel-blue `●` for rule citations, amber `●` for LLM citations.
- **Notice Banners:** Neutral dark surface (`--surface-raised`) with `--border-subtle`, never yellow/amber.

---

## Components

### Component Architecture (`src/ui/`)

#### 1. `App.tsx`
- Root application controller.
- Manages top-level state: `currentView` (`landing` | `workbench`), `rawDiffText`, `parsedDiff`, `findings`, `isAnalyzingLLM`, `banners`, and `rulesOnly`.
- Initializes and communicates with `src/worker/diff-worker.ts`.
- Coordinates live LLM fetch or fixture loading.

#### 2. `LandingView.tsx`
- Implements `prd.md > Screen 1: Landing / Input View`.
- Renders sample fixture selector cards (`Real agent diff 1`, `Real agent diff 2`, `Adversarial fixture`).
- Monospace textarea with character and line count indicators.
- Live pre-send summary calculation (*"Will send 3 files, 392 changed lines to a third-party LLM"*).
- Client-side secret warning scanner (`AKIA...`, `-----BEGIN`, `sk-`).
- "Rules only (don't send my diff)" checkbox toggle.
- "Review diff" CTA with inline Honesty Disclaimer.

#### 3. `WorkbenchView.tsx`
- Implements `prd.md > Screen 2: Working View (Two-Pane Workbench)`.
- Renders top bar (ChangeGuard logo, `[Live]` / `[Cached result]` badge, "New diff" button, "Export" button).
- Hosts summary metric strip (`3 deterministic findings · 2 LLM hypotheses (cited) · 1 uncited claim`).
- Coordinates split workbench: `<DiffViewer />` on left, `<EvidenceLedger />` on right.
- Handles responsive stacking and manages active scroll-to-line highlight state.

#### 4. `DiffViewer.tsx`
- Implements `prd.md > Left Pane (Unified Diff View)`.
- Renders sticky file headers with collapse/expand toggles and diff stats (`+X / -Y`).
- Auto-collapses file sections if total lines > 1,000 or files > 5 (keeping rule-hit files expanded).
- Auto-expands collapsed files when cited by newly arriving LLM findings.
- Renders diff lines: source-colored gutter markers (`●`), global IDs (`L0001`), old/new line numbers, `+`/`-` markers, and code text.
- Supports smooth scroll-to-line and temporary row flash when triggered from finding cards.

#### 5. `EvidenceLedger.tsx`
- Implements `prd.md > Right Pane (Evidence Ledger)`.
- Renders composable notice banners stacked at the top (`Rules-only`, `Truncated`, `LLM unavailable`, `Schema drop`).
- Renders the honest empty-state text when zero findings exist: *"No findings. This does not mean the diff is safe."*
- Renders Deterministic Findings section (`[Rule]`, solid border, steel-blue).
- Renders LLM Hypotheses (Cited) section (`[LLM]`, dashed border, amber).
- Renders Collapsible Drawer for uncited claims ("LLM claims without a valid citation").

#### 6. `FindingCard.tsx`
- Renders individual finding cards.
- Displays Claim title, Badges (`[Rule]` / `[LLM]`, `[Matched]` / `[Cited]` / `[Uncited]`, `[Higher]` / `[Uncertain]` / `[Lower]`).
- Citation chip row: Clicking jumps to and flashes the diff line in `<DiffViewer />`.
- Uncited cards display per-citation resolution state (`L0042 (resolved)` vs `L9999 (not found in sent diff)`).
- Renders code-resolved diff snippets.
- Renders suggested test with inline `[Not visible in diff]` chips and heuristic safety warning tag (`[Warning: Suggested test references environment/network APIs]`).
- Renders `[Rule guidance]` and blind spots (`[Computed: Callers not visible in diff]`).

#### 7. `ExportModal.tsx`
- Implements `prd.md > Modal: Export Dialog`.
- Tab switcher: `PR report` | `Agent prompt`.
- Option toggle: `[ ] Include unevidenced LLM claims` (default: unchecked).
- Monospace read-only preview of raw Markdown.
- GitHub 65,536-character counter and warning.
- One-click "Copy to clipboard" (with fallback to select-all) and "Download .md".

#### 8. `Tooltip.tsx`
- Focusable (`Tab` + `Enter`) and touch-tappable accessible tooltip container for Honesty Rule and verification criteria disclosures.

---

## Data Model

Defined in `src/core/types.ts`:

```typescript
export type LineKind = 'added' | 'removed' | 'context';

export interface DiffLine {
  id: string;               // Permanent global ID: "L0001", "L0002"
  file: string;             // Normalized file path: "src/cart.ts"
  kind: LineKind;
  oldLine: number | null;   // null for added lines
  newLine: number | null;   // null for removed lines
  text: string;             // Line text without leading +/- marker
  isTruncated?: boolean;    // true if line exceeded 2,000 chars
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  isTest: boolean;
  isJsTs: boolean;
  isGenerated: boolean;     // dist/, min.js, bundle.js
  lines: DiffLine[];
}

export interface ParsedDiff {
  files: DiffFile[];
  lines: DiffLine[];
  totalChangedLines: number;
}

export type FindingSource = 'Rule' | 'LLM';
export type DetectionStatus = 'Matched' | 'Cited' | 'Uncited';
export type RegressionLikelihood = 'Higher' | 'Lower' | 'Uncertain';

export interface ResolvedSnippet {
  lineId: string;
  file: string;
  lineNo: number;
  text: string;
  resolved: boolean;
}

export interface Finding {
  id: string;
  source: FindingSource;
  ruleId?: 'R1' | 'R2' | 'R3';
  claim: string;
  detection: DetectionStatus;
  likelihood: RegressionLikelihood;
  citedLineIds: string[];
  resolvedSnippets: ResolvedSnippet[];
  suggestedTest?: string;
  testSafetyWarning?: boolean;
  testIdentifiers?: { name: string; visible: boolean }[];
  blindSpots?: string[];
  guidance?: string;
  provenance?: 'real' | 'synthetic';
}

export interface LLMRawFinding {
  claim: string;
  cited_line_ids: string[];
  suggested_test: string;
  blind_spots?: string[];
}

export interface LLMRawResponse {
  findings: LLMRawFinding[];
}

export interface FixtureData {
  id: string;
  name: string;
  rawDiff: string;
  sentLineIds: string[];
  rawLLMResponse: LLMRawResponse;
  provenanceMap?: Record<number, 'real' | 'synthetic'>;
}
```

---

## File Structure

Annotated tree of planned application files:

```
project/
├── api/
│   ├── adapter.ts                 # Pluggable LLM caller (Anthropic/OpenAI/Gemini)
│   └── review.ts                  # Vercel serverless function with Upstash rate limiting
├── devpost/                       # Devpost learning workspace
│   ├── learner-profile.md
│   ├── scope.md
│   ├── prd.md
│   └── spec.md
├── public/
│   └── fixtures/                  # Raw JSON fixtures + stored sentLineIds
│       ├── real-01.json           # Express cart checkout
│       ├── real-02.json           # Auth middleware refactor
│       └── adversarial.json       # Injection test + synthetic citation test
├── scripts/
│   └── record-fixture.ts          # CLI script to record live LLM response into fixture
├── src/
│   ├── core/                      # 100% pure TypeScript logic (covered by Vitest)
│   │   ├── types.ts               # Core type definitions
│   │   ├── parser.ts              # Unified diff parser & path normalizer
│   │   ├── rules/
│   │   │   ├── rule1-assertions.ts# Rule 1: Deleted assertions with move matching
│   │   │   ├── rule2-catch.ts     # Rule 2: Empty error handlers & null catches
│   │   │   └── rule3-skipped.ts   # Rule 3: Skipped/focused tests & todo stubs
│   │   ├── move-matcher.ts        # One-to-one same-file assertion cancellation
│   │   ├── verifier.ts            # Citation Verifier against sentLineIds & snippet resolver
│   │   ├── schema.ts              # Per-item JSON schema validation & clamping
│   │   ├── safety-scan.ts         # Test-code sensitive API scanner
│   │   ├── identifiers.ts         # Identifier extractor & diff allowlist checker
│   │   ├── blind-spots.ts         # Computed function signature change detector
│   │   └── export/
│   │       ├── pr-report.ts       # GitHub PR comment formatter & link sanitizer
│   │       └── agent-prompt.ts    # Hardened agent prompt with fenced untrusted block
│   ├── worker/
│   │   └── diff-worker.ts         # Web Worker running parser & rules off main thread
│   ├── ui/                        # Preact interactive workbench components
│   │   ├── App.tsx                # Top-level state & routing
│   │   ├── LandingView.tsx        # Screen 1: paste diff, secret scan, fixtures
│   │   ├── WorkbenchView.tsx      # Screen 2: split layout, top bar, summary strip
│   │   ├── DiffViewer.tsx         # Unified diff view, collapse, gutter markers
│   │   ├── EvidenceLedger.tsx     # Banners, rule cards, LLM cards, uncited drawer
│   │   ├── FindingCard.tsx        # Individual card with jump-to-line navigation
│   │   ├── ExportModal.tsx        # Dual-tab export modal with character counter
│   │   └── Tooltip.tsx            # Accessible focusable/tappable tooltip
│   ├── index.css                  # Vanilla CSS with custom properties & layout rules
│   └── main.tsx                   # Preact mount & font imports
├── tests/                         # Automated Vitest test suite
│   ├── parser.test.ts             # Parser hunks, path stripping, long lines, CRLF
│   ├── rules.test.ts              # Rules 1-3 with lookbehinds, comments, and negatives
│   ├── move-matcher.test.ts       # One-to-one same-file cancellation & cross-file
│   ├── verifier.test.ts           # sentLineIds verification & unresolved display
│   ├── schema.test.ts             # Per-item validation, clamping, and drop handling
│   └── safety-scan.test.ts        # Sensitive API scanner & bypass test cases
├── index.html                     # HTML entry point
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # TypeScript configuration
├── vercel.json                    # Vercel serverless function configuration
└── vite.config.ts                 # Vite bundler & Vitest test configuration
```

---

## External Services and Dependencies

1. **Upstash Redis (Rate Limiter):**
   - **Endpoint:** REST API via `@upstash/ratelimit`.
   - **Configuration:** 10 requests per rolling 60-minute window per IP, plus a global daily spend budget of $5/day.
   - **Fallback:** If rate limit is hit, Redis is unreachable, or credentials are missing, `/api/review.ts` returns a 429 status with `error: "rate_limited"`. The client gracefully renders deterministic rules only with an informational banner.
2. **LLM Provider API (Server-side):**
   - **Endpoint:** Provider-specific structured output completion (Anthropic tool calling or OpenAI structured JSON).
   - **Configuration:** Temperature `0.1`, max tokens `2000`, 15-second server timeout.
   - **Client Timeout:** Client aborts fetch after 18 seconds, rendering the "LLM analysis unavailable" banner with a "Retry" button.

---

## Important Failure Modes

| Failure Mode | Root Cause | Fallback Behavior |
|---|---|---|
| **Oversized / Malformed Diff** | User pastes corrupted text or > 5 MB file | Worker catches error and returns failure message. User remains on Screen 1 with pasted text intact and inline error banner. |
| **LLM Proxy Rate Limited or Offline** | Shared venue Wi-Fi NAT IP limit hit or network dropped | Client catches error/status and replaces placeholder with neutral banner: *"LLM analysis unavailable (Rate limit reached / service offline); showing deterministic results only."* Rule findings remain fully interactive. |
| **Model Emits Malformed JSON Item** | Model returns invalid types or missing required fields for one finding | `src/core/schema.ts` drops only the invalid item, retains all valid items, and renders an alert banner: *"1 LLM finding dropped due to invalid schema."* |
| **Long Line DOM Freezing** | Minified file with 50,000 char line | `src/core/parser.ts` truncates lines > 2,000 chars for display and regex matching (badged `[line truncated]`). IDs and line counts remain intact. |
| **Clipboard API Restricted** | Browser permissions block `navigator.clipboard.writeText` | Export modal automatically executes `.select()` on the raw preview textarea and prompts user to press Ctrl+C / Cmd+C. |

---

## What Was Simplified and Why

- **Preact instead of React or Vanilla DOM:** Preact provides reactive UI state (highlights, jump-to-line, file toggles, composable banners) in a 3kB footprint without virtual DOM bloat or fragile manual DOM manipulation.
- **Client-Side Web Worker instead of Backend Parser:** Parsing diffs in a browser Web Worker eliminates server compute costs, keeps data private, and prevents UI freezing on large pastes.
- **Default File Collapse instead of Virtualized List:** Simple CSS/DOM per-file toggle over 1,000 lines avoids heavy external virtualization dependencies while maintaining smooth 60fps scrolling.
- **Pluggable Adapter instead of Multi-Provider Frameworks:** A single 40-line `adapter.ts` file handles model invocation, avoiding complex multi-provider abstractions like LangChain.
- **Fixture Dynamic Verification instead of Pre-baked Labels:** Storing raw LLM responses and evaluating them client-side proves the Citation Verifier is authentic on every demo run.

---

## Decisions and Open Issues

### Locked Decisions
- **Stack:** Vite + Preact + TypeScript + Vitest.
- **Logic Isolation:** All core logic lives in `src/core/` with zero DOM dependencies, covered by pure Node unit tests.
- **Font Hosting:** `@fontsource` packages self-host IBM Plex fonts to preserve literal offline / zero-network operation.
- **LLM Adapter:** Provider isolated behind `api/adapter.ts` with low temperature and 15s client timeout.
- **Verification Semantics:** Citations verified strictly against `sentLineIds` with per-citation resolution display.

### Genuine Learner Concept Clarified
- **The Epistemic Architecture:** Clarified how separating facts (Rule regexes) from hypotheses (LLM output) is maintained through the build order: pure functions in `src/core/` are built and verified first on hardcoded fixtures before any LLM API or proxy code is introduced.

### Open Questions Settled
1. **Model Selection:** Default adapter implementation targets Anthropic Claude 3.5 Sonnet / Haiku with structured tool calling, with environment-variable fallback for OpenAI or Gemini.
2. **Venue Rate Limiting:** Pre-loaded fixtures are 100% client-side cached (0 API calls), ensuring hackathon judges are never blocked by shared venue NAT IPs.
3. **Retry Capability:** Added "Retry LLM analysis" button on the unavailable banner.
