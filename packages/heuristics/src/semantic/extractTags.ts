import type { Role } from '@promptfire/shared';

export type SemanticTag =
  | 'has_code_deliverable'
  | 'has_handler_deliverable'
  | 'has_runtime_context'
  | 'has_framework_context'
  | 'has_language_context'
  | 'has_input_shape'
  | 'has_output_behavior'
  | 'has_success_failure_behavior'
  | 'has_validation_contract'
  | 'has_boundary_exclusion'
  | 'has_operational_logging'
  | 'has_operational_retry_or_idempotency'
  | 'has_internal_contradiction';

export type TaskClass = 'implementation' | 'other';

export interface SemanticTagExtraction {
  taskClass: TaskClass;
  inScope: boolean;
  tags: SemanticTag[];
  evidence: Partial<Record<SemanticTag, string[]>>;
}

function pushEvidence(evidence: Partial<Record<SemanticTag, string[]>>, tag: SemanticTag, values: string[]): void {
  if (values.length > 0) {
    evidence[tag] = values;
  }
}

function collect(patterns: Array<[string, RegExp]>, prompt: string): string[] {
  return patterns.filter(([, pattern]) => pattern.test(prompt)).map(([label]) => label);
}

function hasCurrentNarrowIntent(prompt: string): boolean {
  return (
    /\b(write|build|implement|create|develop)\b/i.test(prompt) &&
    /\b(webhook|handler|endpoint|route|api|function|serverless)\b/i.test(prompt)
  );
}

export function extractSemanticTags(prompt: string, role: Role): SemanticTagExtraction {
  const evidence: Partial<Record<SemanticTag, string[]>> = {};
  const tags = new Set<SemanticTag>();
  const taskClass: TaskClass = role === 'developer' && hasCurrentNarrowIntent(prompt) ? 'implementation' : 'other';

  const codeDeliverableEvidence = collect(
    [
      ['write', /\bwrite\b/i],
      ['build', /\bbuild\b/i],
      ['implement', /\bimplement\b/i],
      ['develop', /\bdevelop\b/i],
      ['function', /\bfunction\b/i],
      ['code', /\bcode\b/i],
    ],
    prompt,
  );
  if (codeDeliverableEvidence.length > 0) {
    tags.add('has_code_deliverable');
    pushEvidence(evidence, 'has_code_deliverable', codeDeliverableEvidence);
  }

  const handlerDeliverableEvidence = collect(
    [
      ['webhook', /\bwebhook\b/i],
      ['handler', /\bhandler\b/i],
      ['endpoint', /\bendpoint\b/i],
      ['route', /\broute\b/i],
      ['api handler', /\bapi handler\b/i],
      ['request handler', /\brequest handler\b/i],
      ['serverless function', /\bserverless function\b/i],
    ],
    prompt,
  );
  if (handlerDeliverableEvidence.length > 0) {
    tags.add('has_handler_deliverable');
    pushEvidence(evidence, 'has_handler_deliverable', handlerDeliverableEvidence);
  }

  const runtimeEvidence = collect(
    [
      ['node.js', /\bnode\.?js\b/i],
      ['serverless', /\bserverless\b/i],
      ['express', /\bexpress(?:\.js)?\b/i],
      ['http', /\bhttp\b/i],
    ],
    prompt,
  );
  if (runtimeEvidence.length > 0) {
    tags.add('has_runtime_context');
    pushEvidence(evidence, 'has_runtime_context', runtimeEvidence);
  }

  const frameworkEvidence = collect(
    [
      ['express', /\bexpress(?:\.js)?\b/i],
      ['lambda', /\blambda\b/i],
    ],
    prompt,
  );
  if (frameworkEvidence.length > 0) {
    tags.add('has_framework_context');
    pushEvidence(evidence, 'has_framework_context', frameworkEvidence);
  }

  const languageEvidence = collect(
    [
      ['typescript', /\btypescript\b/i],
      ['javascript', /\bjavascript\b/i],
      ['node.js', /\bnode\.?js\b/i],
    ],
    prompt,
  );
  if (languageEvidence.length > 0) {
    tags.add('has_language_context');
    pushEvidence(evidence, 'has_language_context', languageEvidence);
  }

  const inputShapeEvidence = collect(
    [
      ['json', /\bjson\b/i],
      ['payload', /\bpayload\b/i],
      ['request body', /\brequest body\b/i],
      ['body', /\bbody\b/i],
    ],
    prompt,
  );
  if (inputShapeEvidence.length > 0) {
    tags.add('has_input_shape');
    pushEvidence(evidence, 'has_input_shape', inputShapeEvidence);
  }

  const outputBehaviorEvidence = collect(
    [
      ['return', /\breturn\b/i],
      ['respond', /\brespond\b/i],
      ['status code', /\bstatus code\b/i],
      ['http 200', /\bhttp\s*200\b/i],
      ['http 400', /\bhttp\s*400\b/i],
    ],
    prompt,
  );
  if (outputBehaviorEvidence.length > 0) {
    tags.add('has_output_behavior');
    pushEvidence(evidence, 'has_output_behavior', outputBehaviorEvidence);
  }

  const successFailureEvidence = collect(
    [
      ['success', /\bon success\b|\bsuccessful\b/i],
      ['failure', /\bon .*failure\b|\bvalidation failure\b|\binvalid input\b|\berror\b/i],
      ['200/400', /\bhttp\s*200\b/i.test(prompt) && /\bhttp\s*400\b/i.test(prompt) ? /.+/ : /^$/],
      ['accepted/invalid', /\baccepted\b|\binvalid\b/i],
    ],
    prompt,
  ).filter((value) => value !== '200/400' || /\bhttp\s*200\b/i.test(prompt));
  if (successFailureEvidence.length > 0) {
    tags.add('has_success_failure_behavior');
    pushEvidence(evidence, 'has_success_failure_behavior', successFailureEvidence);
  }

  const validationEvidence = collect(
    [
      ['schema', /\bschema\b/i],
      ['validate', /\bvalidate\b|\bvalidation\b/i],
      ['contract', /\bcontract\b/i],
      ['payload shape', /\bpayload shape\b/i],
      ['verify structure', /\bverify structure\b/i],
      ['invalid input', /\binvalid input\b|\bvalidation failure\b/i],
      ['match', /\bmust match\b|\bcheck .* against\b/i],
    ],
    prompt,
  );
  if (validationEvidence.length > 0) {
    tags.add('has_validation_contract');
    pushEvidence(evidence, 'has_validation_contract', validationEvidence);
  }

  const exclusionEvidence = collect(
    [
      ['exclude', /\bexclude\b/i],
      ['out of scope', /\bout of scope\b/i],
      ['without', /\bwithout\b/i],
      ['do not include', /\bdo not include\b/i],
      ['leave out', /\bleave .* out\b/i],
      ['omit', /\bomit\b/i],
    ],
    prompt,
  );
  if (exclusionEvidence.length > 0) {
    tags.add('has_boundary_exclusion');
    pushEvidence(evidence, 'has_boundary_exclusion', exclusionEvidence);
  }

  const loggingEvidence = collect(
    [
      ['logging', /\blog(?:ging)?\b/i],
      ['console', /\bconsole\b/i],
    ],
    prompt,
  );
  if (loggingEvidence.length > 0) {
    tags.add('has_operational_logging');
    pushEvidence(evidence, 'has_operational_logging', loggingEvidence);
  }

  const retryEvidence = collect(
    [
      ['retry', /\bretr(?:y|ies)\b/i],
      ['idempotency', /\bidempot(?:ent|ency)\b/i],
    ],
    prompt,
  );
  if (retryEvidence.length > 0) {
    tags.add('has_operational_retry_or_idempotency');
    pushEvidence(evidence, 'has_operational_retry_or_idempotency', retryEvidence);
  }

  const contradictionEvidence = collect(
    [
      ['success returns 400', /\bsuccess\b[^.]{0,30}\b(?:http\s*400|400 status code)\b/i],
      ['invalid returns 200', /\b(?:invalid|validation failure)\b[^.]{0,30}\b(?:http\s*200|200 status code)\b/i],
      [
        'include and exclude auth',
        /\b(?:include|require)\b[^.]{0,40}\b(?:auth|authorization|signature verification)\b/i.test(prompt) &&
        /\b(?:exclude|without|omit|out of scope|leave .* out)\b[^.]{0,40}\b(?:auth|authorization|signature verification)\b/i.test(prompt)
          ? /.+/
          : /^$/,
      ],
    ],
    prompt,
  );
  if (contradictionEvidence.length > 0) {
    tags.add('has_internal_contradiction');
    pushEvidence(evidence, 'has_internal_contradiction', contradictionEvidence);
  }

  const inScope = taskClass === 'implementation' && tags.has('has_code_deliverable') && tags.has('has_handler_deliverable');
  return {
    taskClass,
    inScope,
    tags: [...tags],
    evidence,
  };
}
