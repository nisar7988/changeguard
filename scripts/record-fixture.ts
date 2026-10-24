/**
 * Script to record and format evaluation fixtures for ChangeGuard.
 *
 * Usage:
 *   npx tsx scripts/record-fixture.ts <fixture-id> <diff-file> <llm-response-json> <output-json>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseDiff } from '../src/core/parser';

function main() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.log(
      'Usage: npx tsx scripts/record-fixture.ts <id> <diffFile> <llmResponseJsonFile> <outputJsonFile>'
    );
    process.exit(0);
  }

  const [id, diffPath, llmPath, outputPath] = args;

  const rawDiff = fs.readFileSync(path.resolve(diffPath), 'utf-8');
  const rawLLM = JSON.parse(fs.readFileSync(path.resolve(llmPath), 'utf-8'));

  const parsed = parseDiff(rawDiff);
  const sentLineIds = parsed.lines
    .filter((l) => l.kind === 'added' || l.kind === 'removed')
    .slice(0, 400)
    .map((l) => l.id);

  const fixture = {
    id,
    name: `Fixture: ${id}`,
    rawDiff,
    sentLineIds,
    rawLLMResponse: rawLLM,
  };

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(fixture, null, 2), 'utf-8');
  console.log(`Fixture recorded to ${outputPath} with ${sentLineIds.length} sent line IDs.`);
}

main();
