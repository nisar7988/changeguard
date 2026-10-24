import { describe, it, expect } from 'vitest';
import { parseDiff, normalizeDiffPath, isTestPath, isGeneratedPath } from '../src/core/parser';

describe('Diff Parser', () => {
  it('normalizes file paths correctly', () => {
    expect(normalizeDiffPath('a/src/cart.ts')).toBe('src/cart.ts');
    expect(normalizeDiffPath('b/src/cart.ts')).toBe('src/cart.ts');
    expect(normalizeDiffPath('"a/src/my path with spaces.ts"')).toBe('src/my path with spaces.ts');
    expect(normalizeDiffPath('/dev/null')).toBe('/dev/null');
  });

  it('classifies test paths accurately', () => {
    expect(isTestPath('src/cart.test.ts')).toBe(true);
    expect(isTestPath('src/cart.spec.js')).toBe(true);
    expect(isTestPath('tests/cart.ts')).toBe(true);
    expect(isTestPath('test/utils.ts')).toBe(true);
    expect(isTestPath('__tests__/auth.ts')).toBe(true);
    expect(isTestPath('src/cart.ts')).toBe(false);
    expect(isTestPath('src/contest.ts')).toBe(false); // Should not match 'test' substring
  });

  it('classifies generated and minified paths', () => {
    expect(isGeneratedPath('dist/bundle.js')).toBe(true);
    expect(isGeneratedPath('build/app.js')).toBe(true);
    expect(isGeneratedPath('src/vendor.min.js')).toBe(true);
    expect(isGeneratedPath('src/style.min.css')).toBe(true);
    expect(isGeneratedPath('src/index.ts')).toBe(false);
  });

  it('parses multi-file unified diff with global line IDs', () => {
    const diff = `diff --git a/src/cart.ts b/src/cart.ts
index 1111111..2222222 100644
--- a/src/cart.ts
+++ b/src/cart.ts
@@ -10,3 +10,3 @@ export function getCart() {
-  const total = calculateTotal();
+  const total = calculateFinalTotal();
   return total;
diff --git a/tests/cart.test.ts b/tests/cart.test.ts
index 3333333..4444444 100644
--- a/tests/cart.test.ts
+++ b/tests/cart.test.ts
@@ -5,2 +5,2 @@ describe('cart', () => {
-  expect(getCart()).toBe(10);
+  expect(getCart()).toBe(20);
`;

    const parsed = parseDiff(diff);
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].path).toBe('src/cart.ts');
    expect(parsed.files[1].path).toBe('tests/cart.test.ts');
    expect(parsed.files[1].isTest).toBe(true);

    // Global sequential line IDs
    expect(parsed.lines[0].id).toBe('L0001');
    expect(parsed.lines[0].file).toBe('src/cart.ts');
    expect(parsed.lines[0].kind).toBe('removed');
    expect(parsed.lines[0].text).toBe('  const total = calculateTotal();');

    expect(parsed.lines[1].id).toBe('L0002');
    expect(parsed.lines[1].kind).toBe('added');

    expect(parsed.lines[2].id).toBe('L0003');
    expect(parsed.lines[2].kind).toBe('context');

    expect(parsed.lines[3].id).toBe('L0004');
    expect(parsed.lines[3].file).toBe('tests/cart.test.ts');
  });

  it('handles CRLF and trailing whitespace cleanly', () => {
    const diff = "diff --git a/foo.ts b/foo.ts\r\n--- a/foo.ts\r\n+++ b/foo.ts\r\n@@ -1,1 +1,1 @@\r\n-old;\r\n+new;\r\n";
    const parsed = parseDiff(diff);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].text).toBe('old;');
    expect(parsed.lines[1].text).toBe('new;');
  });

  it('handles "\\ No newline at end of file" without failing', () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,1 +1,1 @@
-old
\\ No newline at end of file
+new
\\ No newline at end of file
`;
    const parsed = parseDiff(diff);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].text).toBe('old');
    expect(parsed.lines[1].text).toBe('new');
  });

  it('truncates lines exceeding 2,000 characters', () => {
    const hugeLine = 'a'.repeat(2500);
    const diff = `diff --git a/huge.ts b/huge.ts
--- a/huge.ts
+++ b/huge.ts
@@ -1,1 +1,1 @@
+${hugeLine}
`;
    const parsed = parseDiff(diff);
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].isTruncated).toBe(true);
    expect(parsed.lines[0].text.endsWith(' [line truncated]')).toBe(true);
    expect(parsed.lines[0].text.length).toBe(2000 + ' [line truncated]'.length);
  });
});
