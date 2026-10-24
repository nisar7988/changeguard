import { DiffFile, Finding } from '../types';
import { evaluateRule1 } from './rule1-assertions';
import { evaluateRule2 } from './rule2-catch';
import { evaluateRule3 } from './rule3-skipped';

export { evaluateRule1 } from './rule1-assertions';
export { evaluateRule2 } from './rule2-catch';
export { evaluateRule3 } from './rule3-skipped';

/**
 * Runs all three deterministic rules across parsed files.
 */
export function runAllRules(input: DiffFile[] | { files: DiffFile[] }): Finding[] {
  const files = Array.isArray(input) ? input : input.files;
  return [
    ...evaluateRule1(files),
    ...evaluateRule2(files),
    ...evaluateRule3(files),
  ];
}
