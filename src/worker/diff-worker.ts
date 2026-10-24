import { parseDiff } from '../core/parser';
import { runAllRules } from '../core/rules';

export interface WorkerParseRequest {
  type: 'PARSE_AND_RUN_RULES';
  rawDiff: string;
}

export interface WorkerSuccessResponse {
  type: 'SUCCESS';
  parsedDiff: ReturnType<typeof parseDiff>;
  ruleFindings: ReturnType<typeof runAllRules>;
}

export interface WorkerErrorResponse {
  type: 'ERROR';
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

self.onmessage = (event: MessageEvent<WorkerParseRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'PARSE_AND_RUN_RULES') {
    return;
  }

  try {
    const parsedDiff = parseDiff(data.rawDiff);
    const ruleFindings = runAllRules(parsedDiff);

    self.postMessage({
      type: 'SUCCESS',
      parsedDiff,
      ruleFindings,
    } as WorkerSuccessResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown parsing error';
    self.postMessage({
      type: 'ERROR',
      error: message,
    } as WorkerErrorResponse);
  }
};
