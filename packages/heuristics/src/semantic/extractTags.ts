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
  | 'has_comparison_object'
  | 'has_tradeoff_frame'
  | 'has_decision_frame'
  | 'has_decision_criteria'
  | 'has_scenario_context'
  | 'has_context_block'
  | 'has_examples'
  | 'has_example_transfer_instruction'
  | 'has_style_reference'
  | 'has_format_reference'
  | 'has_grounding_exclusion'
  | 'has_audience'
  | 'has_org_context'
  | 'has_output_request'
  | 'has_internal_contradiction';

export type TaskClass = 'implementation' | 'comparison' | 'decision_support' | 'context_first' | 'few_shot' | 'other';

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

function collectContextBlockSignals(prompt: string): string[] {
  const signals = collect(
    [
      ['given this situation', /\bgiven this situation\b/i],
      ['with these constraints', /\bwith these constraints\b/i],
      ['in our environment', /\bin our environment\b/i],
      ['we are a team', /\bwe are a\b[^.]{0,80}\bteam\b/i],
      ['for a team with', /\bfor a\b[^.]{0,80}\bteam with\b/i],
      ['substantial org context', /\b(team|org|organization|company|environment|setup|constraint|requirement)\b(?:[^.]{0,120}\b(team|org|organization|company|environment|setup|constraint|requirement)\b){1,}/i],
    ],
    prompt,
  );

  const lineBreakCount = (prompt.match(/\n/g) ?? []).length;
  if (lineBreakCount >= 2) {
    signals.push('multi-line context block');
  }

  return [...new Set(signals)];
}

function hasImplementationIntent(prompt: string, role: Role): boolean {
  return (
    role === 'developer' &&
    /\b(write|build|implement|create|develop)\b/i.test(prompt) &&
    /\b(webhook|handler|endpoint|route|api|function|serverless|script)\b/i.test(prompt)
  );
}

function hasFewShotStructure(prompt: string): boolean {
  return (
    /\b(example\s*\d+|follow these examples|using these examples|model the response after|follow this pattern|few-shot|use the following examples)\b/i.test(
      prompt,
    ) || (/\binput:\s*/i.test(prompt) && /\boutput:\s*/i.test(prompt))
  );
}

function determineTaskClass(prompt: string, role: Role, tags: Set<SemanticTag>): TaskClass {
  if (hasImplementationIntent(prompt, role)) {
    return 'implementation';
  }

  const hasContextFirstSignals = tags.has('has_context_block') && tags.has('has_output_request');
  const hasFewShotSignals =
    tags.has('has_examples') &&
    hasFewShotStructure(prompt) &&
    (tags.has('has_example_transfer_instruction') || tags.has('has_style_reference') || tags.has('has_format_reference'));
  const hasComparisonSignals = tags.has('has_comparison_object') || tags.has('has_tradeoff_frame');
  const hasDecisionSignals = tags.has('has_decision_frame') || tags.has('has_decision_criteria');

  if (hasFewShotSignals && hasFewShotStructure(prompt)) {
    return 'few_shot';
  }
  if (hasContextFirstSignals && !hasFewShotSignals) {
    return 'context_first';
  }
  if (hasDecisionSignals && !tags.has('has_comparison_object')) {
    return 'decision_support';
  }
  if (hasComparisonSignals) {
    return 'comparison';
  }
  if (hasDecisionSignals) {
    return 'decision_support';
  }

  return 'other';
}

function isSemanticPathInScope(taskClass: TaskClass, tags: Set<SemanticTag>): boolean {
  if (taskClass === 'implementation') {
    return tags.has('has_code_deliverable') && tags.has('has_handler_deliverable');
  }

  if (taskClass === 'comparison') {
    return tags.has('has_comparison_object') || tags.has('has_tradeoff_frame');
  }

  if (taskClass === 'decision_support') {
    return (
      tags.has('has_decision_frame') &&
      (tags.has('has_tradeoff_frame') ||
        tags.has('has_decision_criteria') ||
        tags.has('has_scenario_context') ||
        tags.has('has_examples') ||
        tags.has('has_grounding_exclusion'))
    );
  }

  if (taskClass === 'context_first') {
    return (
      tags.has('has_context_block') &&
      tags.has('has_output_request') &&
      (tags.has('has_scenario_context') ||
        tags.has('has_org_context') ||
        tags.has('has_audience') ||
        tags.has('has_decision_frame') ||
        tags.has('has_comparison_object'))
    );
  }

  if (taskClass === 'few_shot') {
    return (
      tags.has('has_examples') &&
      tags.has('has_example_transfer_instruction') &&
      (tags.has('has_style_reference') || tags.has('has_format_reference') || tags.has('has_output_request'))
    );
  }

  return false;
}

export function extractSemanticTags(prompt: string, role: Role): SemanticTagExtraction {
  const evidence: Partial<Record<SemanticTag, string[]>> = {};
  const tags = new Set<SemanticTag>();

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
      ['python', /\bpython\b/i],
      ['typescript', /\btypescript\b/i],
      ['javascript', /\bjavascript\b/i],
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
      ['react', /\breact\b/i],
      ['next.js', /\bnext\.?js\b/i],
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
      ['python', /\bpython\b/i],
      ['go', /\bgo\b/i],
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
      ['input', /\binput\b/i],
      ['format', /\bformat\b/i],
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
      ['output', /\boutput\b/i],
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
      ['avoid', /\bavoid\b/i],
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

  const comparisonEvidence = collect(
    [
      ['compare', /\bcompare\b/i],
      ['versus', /\bversus\b|\bvs\.?\b/i],
      ['better than', /\bbetter than\b/i],
      ['better choice', /\bbetter choice\b/i],
      ['choose between', /\bchoose between\b/i],
      ['when x vs y', /\bwhen\b[\s\S]{0,80}\bbetter than\b/i],
    ],
    prompt,
  );
  if (comparisonEvidence.length > 0) {
    tags.add('has_comparison_object');
    pushEvidence(evidence, 'has_comparison_object', comparisonEvidence);
  }

  const tradeoffEvidence = collect(
    [
      ['trade-offs', /\btrade[-\s]?offs?\b/i],
      ['pros and cons', /\bpros and cons\b|\badvantages and disadvantages\b/i],
      ['helps and hurts', /\bwhen\b[\s\S]{0,60}\bhelps\b[\s\S]{0,40}\bhurts\b/i],
      ['worth the overhead', /\bworth the overhead\b|\bworth the complexity\b/i],
      ['benefits versus overhead', /\bbenefits?\b[\s\S]{0,20}\b(overhead|cost|complexity)\b/i],
    ],
    prompt,
  );
  if (tradeoffEvidence.length > 0) {
    tags.add('has_tradeoff_frame');
    pushEvidence(evidence, 'has_tradeoff_frame', tradeoffEvidence);
  }

  const decisionFrameEvidence = collect(
    [
      ['decide', /\bdecide\b|\bdecision\b/i],
      ['worth it', /\bworth it\b/i],
      ['when to choose', /\bwhen to choose\b|\bwhether to\b/i],
      ['recommendation', /\brecommend(?:ation)?\b/i],
      ['which option', /\bwhich option\b/i],
    ],
    prompt,
  );
  if (decisionFrameEvidence.length > 0) {
    tags.add('has_decision_frame');
    pushEvidence(evidence, 'has_decision_frame', decisionFrameEvidence);
  }

  const criteriaEvidence = collect(
    [
      ['criteria', /\bcriteria\b/i],
      ['evaluation frame', /\bevaluate\b|\bevaluation\b/i],
      ['axes', /\baxis\b|\baxes\b/i],
      ['team autonomy', /\bteam autonomy\b/i],
      ['operational load', /\boperational load\b|\boverhead\b/i],
      ['scaling complexity', /\bscaling complexity\b/i],
    ],
    prompt,
  );
  if (criteriaEvidence.length > 0) {
    tags.add('has_decision_criteria');
    pushEvidence(evidence, 'has_decision_criteria', criteriaEvidence);
  }

  const scenarioEvidence = collect(
    [
      ['scenario', /\bscenario\b/i],
      ['use case', /\buse case\b/i],
      ['for a team', /\bfor a\b[^.]{0,80}\bteam\b/i],
      ['in a company', /\bin a\b[^.]{0,80}\b(company|org|organization)\b/i],
      ['under constraints', /\bunder constraints\b|\bwith constraints\b/i],
    ],
    prompt,
  );
  if (scenarioEvidence.length > 0) {
    tags.add('has_scenario_context');
    pushEvidence(evidence, 'has_scenario_context', scenarioEvidence);
  }

  const contextBlockEvidence = collectContextBlockSignals(prompt);
  if (contextBlockEvidence.length > 0) {
    tags.add('has_context_block');
    pushEvidence(evidence, 'has_context_block', contextBlockEvidence);
  }

  const exampleEvidence = collect(
    [
      ['example', /\bexample\b/i],
      ['examples', /\bexamples\b/i],
      ['case', /\bcase\b|\bcase study\b/i],
      ['startup example', /\bstartup example\b/i],
      ['enterprise example', /\benterprise example\b/i],
      ['example 1', /\bexample\s*1\b/i],
    ],
    prompt,
  );
  if (exampleEvidence.length > 0) {
    tags.add('has_examples');
    pushEvidence(evidence, 'has_examples', exampleEvidence);
  }

  const transferEvidence = collect(
    [
      ['follow these examples', /\bfollow these examples\b/i],
      ['follow this pattern', /\bfollow this pattern\b/i],
      ['model the response after', /\bmodel the response after\b/i],
      ['adapt to new topic', /\badapt to the new topic\b|\badapt to a new topic\b/i],
      ['preserve and change', /\bpreserve\b|\bkeep\b[\s\S]{0,30}\bchange\b/i],
    ],
    prompt,
  );
  if (transferEvidence.length > 0) {
    tags.add('has_example_transfer_instruction');
    pushEvidence(evidence, 'has_example_transfer_instruction', transferEvidence);
  }

  const styleReferenceEvidence = collect(
    [
      ['tone', /\btone\b/i],
      ['style', /\bstyle\b/i],
      ['voice', /\bvoice\b/i],
      ['same style', /\bsame style\b|\bhouse style\b/i],
    ],
    prompt,
  );
  if (styleReferenceEvidence.length > 0) {
    tags.add('has_style_reference');
    pushEvidence(evidence, 'has_style_reference', styleReferenceEvidence);
  }

  const formatReferenceEvidence = collect(
    [
      ['format', /\bformat\b/i],
      ['structure', /\bstructure\b/i],
      ['template', /\btemplate\b/i],
      ['follow output shape', /\boutput shape\b|\bexact structure\b/i],
    ],
    prompt,
  );
  if (formatReferenceEvidence.length > 0) {
    tags.add('has_format_reference');
    pushEvidence(evidence, 'has_format_reference', formatReferenceEvidence);
  }

  const groundingEvidence = collect(
    [
      ['avoid hype', /\bavoid hype\b/i],
      ['keep it practical', /\bkeep it practical\b/i],
      ['grounded tone', /\bkeep the tone grounded\b|\bgrounded\b/i],
      ['real trade-offs', /\breal trade[-\s]?offs?\b/i],
      ['avoid architectural fashion', /\bavoid architectural fashion\b/i],
      ['anti-default framing', /\bavoid generic\b|\bavoid buzzwords\b/i],
    ],
    prompt,
  );
  if (groundingEvidence.length > 0) {
    tags.add('has_grounding_exclusion');
    pushEvidence(evidence, 'has_grounding_exclusion', groundingEvidence);
  }

  const audienceEvidence = collect(
    [
      ['for CTOs', /\bfor\b[^.]{0,60}\bctos?\b/i],
      ['for managers', /\bfor\b[^.]{0,60}\b(managers?|leaders?|operators?|developers?|engineers?)\b/i],
      ['audience', /\baudience\b|\breaders?\b|\bbuyers?\b/i],
      ['IT decision-makers', /\bit decision-makers?\b/i],
    ],
    prompt,
  );
  if (audienceEvidence.length > 0) {
    tags.add('has_audience');
    pushEvidence(evidence, 'has_audience', audienceEvidence);
  }

  const orgContextEvidence = collect(
    [
      ['mid-sized SaaS', /\bmid[-\s]?sized\b[\s\S]{0,20}\bsaas\b/i],
      ['startup', /\bstartup\b/i],
      ['enterprise', /\benterprise\b/i],
      ['20-person team', /\b\d+\s*-\s*person\b|\b\d+\s*person\b/i],
      ['compliance requirement', /\bcompliance requirement\b|\bregulated\b/i],
    ],
    prompt,
  );
  if (orgContextEvidence.length > 0) {
    tags.add('has_org_context');
    pushEvidence(evidence, 'has_org_context', orgContextEvidence);
  }

  const outputRequestEvidence = collect(
    [
      ['write', /\bwrite\b/i],
      ['explain', /\bexplain\b/i],
      ['help decide', /\bhelp\b[\s\S]{0,20}\bdecide\b/i],
      ['recommend', /\brecommend\b/i],
      ['advise', /\badvise\b|\badvice\b/i],
      ['evaluate', /\bevaluate\b/i],
      ['follow examples', /\bfollow\b[\s\S]{0,20}\bexamples\b/i],
    ],
    prompt,
  );
  if (outputRequestEvidence.length > 0) {
    tags.add('has_output_request');
    pushEvidence(evidence, 'has_output_request', outputRequestEvidence);
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

  const taskClass = determineTaskClass(prompt, role, tags);
  const inScope = isSemanticPathInScope(taskClass, tags);

  return {
    taskClass,
    inScope,
    tags: [...tags],
    evidence,
  };
}
