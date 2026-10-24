# ChangeGuard

> **Evidence-first review of AI-generated JS/TS diffs**  
> Epistemic separation of diff-visible facts from unverified model hypotheses.

ChangeGuard is a lightweight, offline-first tool designed to solve a critical blind spot in AI-assisted development: **coding agents deleting assertions, dropping error handling, or skipping tests to make pull requests appear green.**

Instead of letting an LLM guess and self-report whether a change is safe, ChangeGuard enforces an **epistemic boundary**:
- **Deterministic Rules (Client-side, Fast):** Scans unified diffs for deleted test assertions (with 1-to-1 move matching), introduced empty catch handlers, and skipped/focused tests.
- **Dynamic Citation Verifier:** LLM bug hypotheses are strictly verified client-side against the exact line IDs sent in the prompt (`sentLineIds`). Hallucinations and out-of-diff lines are quarantined in a collapsed uncited drawer.
- **Honest Epistemic Color Scheme:** Color encodes evidence status, never severity. Solid steel-blue borders for verified rule matches; dashed amber borders for LLM hypotheses; neutral chips (`Higher`, `Uncertain`, `Lower`) for likelihood.
- **Honest Empty State:** *"No findings. This does not mean the diff is safe."*

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run Automated Tests
```bash
npm run test
```
Runs the full Vitest suite (48 unit tests covering parsers, rules, move matching, schema clamping, citation verification, test safety scanning, and dual export formatters).

---

## Pre-Loaded Evaluation Fixtures

ChangeGuard runs 100% locally with three pre-loaded demonstration fixtures:
1. **`Real agent diff 1: Express cart checkout`**: Agent refactors discount calculations, removes a test assertion, and adds an empty catch.
2. **`Real agent diff 2: Auth middleware refactor`**: Agent switches from `jwt.verify` to `jwt.decode` (auth bypass), moves an assertion (correctly cancelled by move matcher), and skips an expired token test.
3. **`Adversarial fixture: Synthetic injection & citation test`**: Embedded prompt injection attempt in comments, accompanied by a synthetic invalid citation (`L9999`) caught and quarantined by the client-side Citation Verifier.

---

## Project Documentation

Detailed planning documents and evaluation records are available in the [`devpost/`](./devpost/) directory:
- [`devpost/scope.md`](./devpost/scope.md): Initial problem definition, proof of concept boundary, and the unique kernel.
- [`devpost/prd.md`](./devpost/prd.md): Comprehensive product requirements, screens, states, and design tokens.
- [`devpost/spec.md`](./devpost/spec.md): Technical architecture specification (Preact + TypeScript + Vitest).
- [`devpost/evaluation.md`](./devpost/evaluation.md): Empirical evaluation table across 10 real agent diffs with precision metrics and sole-rater disclosure.
- [`devpost/app-map.html`](./devpost/app-map.html): Interactive application architecture map and code tour guide.

---

## License

MIT
