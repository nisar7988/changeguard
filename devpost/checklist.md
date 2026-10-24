---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Core parser, Rules 1–3, and move matching with Vitest suite**
  Becomes usable: A runnable, tested core engine in Node where any git diff can be parsed into line models with global IDs (`L0001`...) and evaluated against Rules 1–3 with one-to-one move matching.
  Why now: Proves the unique kernel and deterministic tier first with zero UI baggage, establishing the test foundation everything else builds upon.
  PRD ref: `prd.md > Features and Behavior` (items 1 & 2)
  Spec ref: `spec.md > Stack`, `spec.md > Components` (`src/core/`)
  Build: Initialize Vite + TypeScript project; install Vitest; implement `src/core/types.ts`, `src/core/parser.ts` (path normalization, hunk parsing, CRLF, binary, long lines), `src/core/move-matcher.ts`, and `src/core/rules/` (Rules 1, 2, 3 with lookbehind hygiene and comment skipping); write unit tests covering positive and negative test cases.
  Verify (mechanical): Run `npx vitest run` and confirm 100% of parser, rules, and move-matcher tests pass without error.
  Learner check: Run `npx vitest run` in the terminal to see all tests passing, and inspect `src/core/parser.ts` to confirm how global line IDs are generated.
  Commit: `feat: scaffold project and implement core parser with rules 1-3 and tests`

- [x] **2. Web Worker and Evidence Ledger UI on cached fixtures**
  Becomes usable: A running local web app (`http://localhost:5173`) with the two-pane GitHub-style diff viewer and Linear-style Evidence Ledger displaying deterministic findings from three pre-loaded sample fixtures.
  Why now: Establishes the visual surface, self-hosted typography, and bi-directional line-jumping early so the UI can be experienced and checked hands-on.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Components` (`src/ui/`, `src/worker/`)
  Build: Install Preact (`preact`), `@fontsource/ibm-plex-sans`, and `@fontsource/ibm-plex-mono`; configure Vite and self-hosted CSS tokens in `src/index.css`; implement `src/worker/diff-worker.ts` for off-main-thread parsing; build `LandingView`, `WorkbenchView`, `DiffViewer`, `EvidenceLedger`, `FindingCard`, and `Tooltip`; populate `public/fixtures/` with raw sample diffs.
  Verify (mechanical): Run `npm run build` and `npx vitest run` to ensure clean build; start dev server and confirm UI renders sample fixtures and gutter markers without console errors.
  Learner check: Open `http://localhost:5173`, click through all three sample fixtures, and click a cited line chip to confirm it jumps to and flashes the corresponding diff line.
  Commit: `feat: add web worker and interactive evidence ledger UI with sample fixtures`

- [x] **3. Client-side Citation Verifier and per-item schema validation**
  Becomes usable: LLM findings in the sample fixtures run dynamically through the Citation Verifier client-side on every load; valid findings appear in `LLM hypotheses (cited)` with neutral badges, while invalid/unresolved citations are quarantined in the collapsed uncited drawer.
  Why now: Delivers the core thesis: LLM claims are verified against `sentLineIds` by construction, proving the Citation Verifier is authentic rather than pre-baked.
  PRD ref: `prd.md > Features and Behavior` (items 3 & 4)
  Spec ref: `spec.md > Components` (`src/core/verifier.ts`, `src/core/schema.ts`)
  Build: Implement `src/core/schema.ts` (per-item validation, clamping over-length strings/arrays, drop reporting) and `src/core/verifier.ts` (`sentLineIds` constraint, code-resolved snippets); update `App.tsx` and `EvidenceLedger.tsx` to run verifier on fixture load and badge adversarial findings (`[Real LLM output]` vs `[Synthetic LLM response]`); add unit tests.
  Verify (mechanical): Run `npx vitest run tests/verifier.test.ts tests/schema.test.ts` to confirm verification logic and clamping work as specified.
  Learner check: Open the Adversarial fixture in the browser and verify that the synthetic invalid line ID is flagged and placed into the collapsed "LLM claims without a valid citation" drawer.
  Commit: `feat: add client-side citation verifier and per-item schema validation`

- [x] **4. Test safety scanner, identifier visibility check, and blind-spot detection**
  Becomes usable: Finding cards show heuristic safety warnings on sensitive test code APIs, `[Not visible in diff]` chips on untested identifiers, and `[Computed: Callers not visible in diff]` chips on function signature changes.
  Why now: Completes the analytical depth of the tool, preventing dangerous test execution and highlighting repository-level blind spots before export.
  PRD ref: `prd.md > Features and Behavior` (items 5 & 6)
  Spec ref: `spec.md > Components` (`src/core/safety-scan.ts`, `src/core/identifiers.ts`, `src/core/blind-spots.ts`)
  Build: Implement `src/core/safety-scan.ts` (`child_process`, `fs`, `eval`, `rimraf`, etc. scanner), `src/core/identifiers.ts` (diff identifier token allowlist checker), and `src/core/blind-spots.ts` (signature change callers check); integrate into `FindingCard.tsx`; add unit tests.
  Verify (mechanical): Run `npx vitest run tests/safety-scan.test.ts` to confirm detection of sensitive primitives and allowlist exclusions.
  Learner check: Inspect a finding card with suggested test code to observe the `[Not visible in diff]` chips and the test safety warning tag.
  Commit: `feat: implement test safety scanner, identifier visibility, and blind-spot detection`

- [x] **5. Injection-safe dual export, pre-send secret scanning, and evaluation corpus**
  Becomes usable: The export modal generates sanitized GitHub PR comments and hardened agent verification prompts with character limits, while the input screen warns on detected secrets; the evaluation corpus is committed to document real tool accuracy.
  Why now: Finishes the end-to-end user loop and produces the required hackathon evaluation data before deployment.
  PRD ref: `prd.md > Features and Behavior` (items 7 & 8), `prd.md > Delivery & Success Criteria`
  Spec ref: `spec.md > Components` (`src/core/export/`, `src/ui/ExportModal.tsx`)
  Build: Implement `src/core/export/pr-report.ts` (sanitizing HTML, links, mentions) and `src/core/export/agent-prompt.ts` (fenced untrusted block); implement `ExportModal.tsx` with copy and download actions; add pre-send line counter and secret pattern regex in `LandingView.tsx`; create `scripts/record-fixture.ts`; assemble and commit the 8–10 diff evaluation table in `devpost/evaluation.md`.
  Verify (mechanical): Run full test suite `npx vitest run` and confirm export sanitization neutralizes malicious Markdown and raw HTML.
  Learner check: Click "Export" in the top bar, copy the PR report and Agent prompt, and review the raw Markdown output.
  Commit: `feat: add injection-safe dual export, secret scanning, and evaluation table`

- [ ] **6. Vercel serverless proxy with Upstash rate limiting and live review**
  Becomes usable: Live pasted diffs can be sent to Claude/OpenAI through a secure serverless proxy with rate limiting, with graceful fallback to deterministic rules if limits are reached.
  Why now: The final optional layer: connects the working offline app to live cloud inference without risking key exposure or infinite spend.
  PRD ref: `prd.md > States and Boundaries` (Matrix), `prd.md > What We're Building`
  Spec ref: `spec.md > External Services and Dependencies`, `spec.md > File Structure` (`api/`)
  Build: Implement `api/adapter.ts` (model caller with timeout) and `api/review.ts` (Vercel serverless function with Upstash rate limiting); wire client fetch in `App.tsx` with the "Rules only" toggle and retry button.
  Verify (mechanical): Run local API check with mock payload to verify schema validation and rate-limit headers; run full app build `npm run build`.
  Learner check: Toggle "Rules only" on and off to observe how the app switches between local-only analysis and live cloud analysis.
  Commit: `feat: add serverless proxy with rate limiting and live llm analysis`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — Slice 2 (interactive UI and diff viewer with sample fixtures)
- [ ] Final kick-the-tires exploration and feedback completed — Slice 5 (complete offline app, exports, and evaluation corpus)

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [to be recorded during wrap-up]
Route and stops: [to be recorded during wrap-up]
Edit outcome: [to be recorded during wrap-up]
Reflection: [to be recorded during wrap-up]
Activity mode: [to be recorded during wrap-up]

## Revisions

