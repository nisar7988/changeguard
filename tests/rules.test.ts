import { describe, it, expect } from 'vitest';
import { parseDiff } from '../src/core/parser';
import { evaluateRule1 } from '../src/core/rules/rule1-assertions';
import { evaluateRule2 } from '../src/core/rules/rule2-catch';
import { evaluateRule3 } from '../src/core/rules/rule3-skipped';
import { runAllRules } from '../src/core/rules';

describe('Deterministic Rules (JS/TS)', () => {
  describe('Rule 1: Deleted Test Assertions', () => {
    it('detects deleted assertions and assigns Higher when uncancelled', () => {
      const diff = `diff --git a/src/cart.test.ts b/src/cart.test.ts
--- a/src/cart.test.ts
+++ b/src/cart.test.ts
@@ -10,3 +10,1 @@
-  expect(item.price).toBe(100);
-  assert.strictEqual(item.quantity, 1);
   const x = 5;
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule1(parsed.files);

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('R1');
      expect(findings[0].likelihood).toBe('Higher');
      expect(findings[0].claim).toContain('2 assertion lines removed in src/cart.test.ts (2 deleted)');
      expect(findings[0].citedLineIds).toHaveLength(2);
    });

    it('assigns Lower when 100% of removed assertions are moved in the same file', () => {
      const diff = `diff --git a/src/cart.test.ts b/src/cart.test.ts
--- a/src/cart.test.ts
+++ b/src/cart.test.ts
@@ -10,2 +10,3 @@
-  expect(cart.total).toBe(50);
+  // rearranged
+  expect(cart.total).toBe(50);
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule1(parsed.files);

      expect(findings).toHaveLength(1);
      expect(findings[0].likelihood).toBe('Lower');
      expect(findings[0].claim).toContain('1 moved');
    });

    it('ignores assertions in comments and supertest .expect(200)', () => {
      const diff = `diff --git a/src/api.test.ts b/src/api.test.ts
--- a/src/api.test.ts
+++ b/src/api.test.ts
@@ -10,3 +10,1 @@
-  // expect(foo).toBe(bar);
-  /* assert.equal(x, y); */
-  request(app).get('/health').expect(200);
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule1(parsed.files);

      // Comments and supertest method calls are ignored by lookbehind & comment filters
      expect(findings).toHaveLength(0);
    });

    it('downgrades to Uncertain in non-test files', () => {
      const diff = `diff --git a/src/cart.ts b/src/cart.ts
--- a/src/cart.ts
+++ b/src/cart.ts
@@ -5,1 +5,0 @@
-  assert(id !== undefined);
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule1(parsed.files);

      expect(findings).toHaveLength(1);
      expect(findings[0].likelihood).toBe('Uncertain');
      expect(findings[0].claim).toContain('[non-test file]');
    });
  });

  describe('Rule 2: Introduced Empty Error Handler', () => {
    it('detects added single-line catch {} with empty body', () => {
      const diff = `diff --git a/src/service.ts b/src/service.ts
--- a/src/service.ts
+++ b/src/service.ts
@@ -10,1 +10,2 @@
+  try { run(); } catch (e) {}
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule2(parsed.files);

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('R2');
      expect(findings[0].likelihood).toBe('Higher');
    });

    it('detects added .catch(() => {}) and .catch(() => null)', () => {
      const diff = `diff --git a/src/async.ts b/src/async.ts
--- a/src/async.ts
+++ b/src/async.ts
@@ -5,2 +5,4 @@
+  fetchData().catch(() => {});
+  loadUser().catch(() => null);
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule2(parsed.files);

      expect(findings).toHaveLength(2);
      expect(findings[0].likelihood).toBe('Higher');
      expect(findings[1].likelihood).toBe('Higher');
    });

    it('detects multi-line empty catch with only comments inside', () => {
      const diff = `diff --git a/src/db.ts b/src/db.ts
--- a/src/db.ts
+++ b/src/db.ts
@@ -10,1 +10,4 @@
+  try { save(); }
+  catch (err) {
+    // ignore error
+  }
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule2(parsed.files);

      expect(findings).toHaveLength(1);
      expect(findings[0].claim).toContain('empty catch block');
    });

    it('does NOT flag catch blocks containing executable statements', () => {
      const diff = `diff --git a/src/logger.ts b/src/logger.ts
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -10,1 +10,4 @@
+  try { save(); }
+  catch (err) {
+    console.error('Failed to save', err);
+  }
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule2(parsed.files);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Rule 3: Skipped or Focused Tests', () => {
    it('detects newly added .skip, .only, xit, and fit in test files', () => {
      const diff = `diff --git a/src/auth.test.ts b/src/auth.test.ts
--- a/src/auth.test.ts
+++ b/src/auth.test.ts
@@ -10,1 +10,5 @@
+  it.skip('bypasses login', () => {});
+  describe.only('login suite', () => {});
+  xit('old test', () => {});
+  fit('focused spec', () => {});
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule3(parsed.files);

      expect(findings).toHaveLength(4);
      expect(findings.every((f) => f.likelihood === 'Higher')).toBe(true);
    });

    it('marks .todo calls as Uncertain (informational planned work)', () => {
      const diff = `diff --git a/src/auth.test.ts b/src/auth.test.ts
--- a/src/auth.test.ts
+++ b/src/auth.test.ts
@@ -5,1 +5,2 @@
+  it.todo('will implement password reset later');
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule3(parsed.files);

      expect(findings).toHaveLength(1);
      expect(findings[0].likelihood).toBe('Uncertain');
    });

    it('ignores process.exit(0), commit.skip(), comments, and non-test paths', () => {
      const diff = `diff --git a/src/cli.ts b/src/cli.ts
--- a/src/cli.ts
+++ b/src/cli.ts
@@ -1,1 +1,4 @@
+  // it.skip('commented out');
+  process.exit(1);
+  commit.skip();
`;
      const parsed = parseDiff(diff);
      const findings = evaluateRule3(parsed.files);

      expect(findings).toHaveLength(0);
    });
  });

  describe('runAllRules aggregator', () => {
    it('runs all rules together and aggregates findings', () => {
      const diff = `diff --git a/src/app.test.ts b/src/app.test.ts
--- a/src/app.test.ts
+++ b/src/app.test.ts
@@ -1,2 +1,3 @@
-  expect(old).toBe(1);
+  it.skip('new test', () => {});
+  try { doSomething(); } catch {}
`;
      const parsed = parseDiff(diff);
      const findings = runAllRules(parsed.files);

      expect(findings.some((f) => f.ruleId === 'R1')).toBe(true);
      expect(findings.some((f) => f.ruleId === 'R2')).toBe(true);
      expect(findings.some((f) => f.ruleId === 'R3')).toBe(true);
    });
  });
});
