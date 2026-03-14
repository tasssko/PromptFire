import type {
  AnalyzeAndRewriteRequest,
  Analysis,
  Issue,
  IssueCode,
  ScoreSet,
} from '@promptfire/shared';

const genericPhrases = ['seamless', 'robust', 'powerful', 'innovative', 'cutting-edge'];
const categoryTerms = ['security', 'compliance', 'integration'];

interface MarketerSignals {
  audienceSpecificityLow: boolean;
  audienceSpecificityHigh: boolean;
  positioningWeak: boolean;
  proofRequested: boolean;
  proofWeak: boolean;
  proofSpecificityHigh: boolean;
  leadAnglePresent: boolean;
  differentiationInstructionsPresent: boolean;
  contextContrastLow: boolean;
  genericValuePropDensityHigh: boolean;
  orgFitSpecificityHigh: boolean;
  constraintsWeak: boolean;
  functionalCompositionScore: number;
}

function hasClearDeliverable(prompt: string): 0 | 1 | 2 {
  const actionVerb = /\b(write|draft|create|build|design|implement|analyze|optimize|summarize|generate)\b/i.test(
    prompt,
  );
  const deliverableType =
    /\b(landing page|copy|email|ad copy|blog|article|webhook|handler|api|report|plan|outline|strategy|cta|headline)\b/i.test(
      prompt,
    );

  if (actionVerb && deliverableType) {
    return 2;
  }

  if (actionVerb || deliverableType) {
    return 1;
  }

  return 0;
}

function audienceOrContextSpecificity(prompt: string, context?: Record<string, unknown>): 0 | 1 | 2 {
  const hasAudienceSignal = hasAudience(prompt, context);
  if (!hasAudienceSignal) {
    return 0;
  }

  const broadAudience = /\b(it decision-makers?|decision-makers?|enterprise buyers?|audience|users?)\b/i.test(prompt);
  const specificAudience = /\b(cto|vp|director|architect|administrator|manager)\b/i.test(prompt);
  const concreteContext = /\b(mid-sized|enterprise|regulated|audit|sprawl|acquisition|overhead|governance)\b/i.test(
    prompt,
  );

  if (specificAudience || concreteContext) {
    return 2;
  }

  if (broadAudience) {
    return 1;
  }

  return 1;
}

function taskBoundaries(prompt: string, context?: Record<string, unknown>): 0 | 1 | 2 {
  const exclusions = hasExclusions(prompt, context);
  const strongBoundary =
    exclusions ||
    /\b(lead with|focus on|rather than|in scope|out of scope|avoid fear-based|do not use)\b/i.test(prompt);
  const weakBoundary = /\b(focus on|highlight|emphasize)\b/i.test(prompt);

  if (strongBoundary) {
    return 2;
  }

  if (weakBoundary) {
    return 1;
  }

  return 0;
}

function functionalConstraintQuality(
  prompt: string,
  context: Record<string, unknown> | undefined,
  constraintsPresent: boolean,
): 0 | 1 | 2 {
  if (!constraintsPresent) {
    return 0;
  }

  const specificConstraint =
    /\b(one|two|\d+|at least|exactly|measurable|quantifiable|must|only|limit|avoid|do not)\b/i.test(prompt) ||
    Boolean(context?.mustInclude) ||
    Boolean(context?.mustAvoid);

  if (specificConstraint) {
    return 2;
  }

  return 1;
}

function taskLoadScore(prompt: string, overloaded: boolean): 0 | 1 | 2 {
  if (overloaded) {
    return 0;
  }

  const mildOverload = /\b(and also|plus|as well as|in addition)\b/i.test(prompt);
  if (mildOverload) {
    return 1;
  }

  return 2;
}

function computeScopeScore(input: {
  prompt: string;
  context?: Record<string, unknown>;
  constraintsPresent: boolean;
  overloaded: boolean;
}): number {
  const deliverable = hasClearDeliverable(input.prompt);
  const audienceContext = audienceOrContextSpecificity(input.prompt, input.context);
  const boundaries = taskBoundaries(input.prompt, input.context);
  const constraints = functionalConstraintQuality(input.prompt, input.context, input.constraintsPresent);
  const taskLoad = taskLoadScore(input.prompt, input.overloaded);
  return deliverable + audienceContext + boundaries + constraints + taskLoad;
}

function hasAudience(prompt: string, context?: Record<string, unknown>) {
  const audienceHint = context?.audienceHint;
  if (audienceHint) {
    return true;
  }

  const explicitAudience =
    /\b(for|aimed at|target(?:ing|ed at)?|tailored for)\s+(?:an?\s+|the\s+)?(?:[a-z-]+\s+){0,6}(?:cto|ctos|it decision-makers?|decision-makers?|enterprise buyers?|buyers?|developers?|engineers?|directors?|managers?|leaders?|admins?|business(?:es)?|companies|organizations|teams|startups?|scaleups?|enterprises?|smbs?|small(?:\s+to\s+medium-sized)?\s+business(?:es)?|mid-sized\s+business(?:es)?)\b/i;
  const genericAudience = /\b(audience|target\s+user)\b/i;
  return explicitAudience.test(prompt) || genericAudience.test(prompt);
}

function hasConstraints(prompt: string, context?: Record<string, unknown>) {
  const hasContextConstraints = Boolean(context?.mustInclude) || Boolean(context?.systemGoals);
  const hasPromptConstraints =
    /\b(must|should|exactly|limit|only|at least|at most)\b/i.test(prompt) ||
    /\b(use one|use two|include one|include two|avoid|keep the tone|focus on|rather than|lead with)\b/i.test(prompt) ||
    /\b(include|incorporate|cover)\s+(?:real-world|actionable|specific|practical|one|two|\d+|examples?|best practices|steps?|checklist|conclusion)\b/i.test(
      prompt,
    );
  return hasContextConstraints || hasPromptConstraints;
}

function hasExclusions(prompt: string, context?: Record<string, unknown>) {
  const hasContextExclusions = Boolean(context?.mustAvoid) || Boolean(context?.forbiddenPhrases);
  const hasPromptExclusions = /\b(avoid|exclude|excluding|without|do not|don't)\b/i.test(prompt);
  return hasContextExclusions || hasPromptExclusions;
}

function isTaskOverloaded(prompt: string) {
  const directiveVerbCount =
    (prompt.match(/(?:^|[.;]\s+|\bthen\b\s+|\band\b\s+)(build|write|create|design|implement|analyze|optimize|draft)\b/gi) ?? [])
      .length;
  const listSeparators = (prompt.match(/,| and |;| then /gi) ?? []).length;
  return directiveVerbCount >= 3 || (directiveVerbCount >= 2 && listSeparators >= 4);
}

function isMarketerTaskOverloaded(prompt: string): boolean {
  const deliverables = [
    'landing page',
    'ad variant',
    'ad copy',
    'ad campaign',
    'email copy',
    'homepage copy',
    'case study',
    'webinar outline',
    'website',
    'blog content',
    'blog post',
    'seo',
    'social post',
    'positioning',
    'sales deck',
    'whitepaper',
  ];

  const lowered = prompt.toLowerCase();
  const matchedDeliverables = deliverables.filter((item) => lowered.includes(item));
  const uniqueCount = new Set(matchedDeliverables).size;
  if (uniqueCount >= 2) {
    return true;
  }

  const separators = (lowered.match(/,| and |;|\/|&/g) ?? []).length;
  const strategySpread = /\b(website|blog|seo|campaign|positioning|strategy)\b/.test(lowered);
  return strategySpread && separators >= 3;
}

function detectGenericPhrases(prompt: string) {
  const lowered = prompt.toLowerCase();
  const withoutExclusions = lowered.replace(
    /(avoid|do not|don't|without|exclude|ban)\s+[^.]{0,200}/gi,
    '',
  );
  return genericPhrases.filter((phrase) => withoutExclusions.includes(phrase));
}

function countCategoryTerms(prompt: string): number {
  const withoutExclusions = prompt
    .toLowerCase()
    .replace(/(avoid|do not|don't|without|exclude|ban)\s+[^.]{0,200}/gi, '');
  return categoryTerms.filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(withoutExclusions)).length;
}

function hasContrastBoundary(prompt: string, context?: Record<string, unknown>): boolean {
  return (
    hasExclusions(prompt, context) ||
    /\b(tailored for|specific to|for smb|for smbs|for startups|for enterprises|rather than|instead of)\b/i.test(prompt)
  );
}

function hasLeadAngle(prompt: string): boolean {
  return /\b(lead with|tension|pain|risk|pressure|sprawl|overhead|readiness|governance)\b/i.test(prompt);
}

function hasProofRequest(prompt: string): boolean {
  return /\b(testimonial|proof|case study|quantifiable|measurable|metric|result)\b/i.test(prompt);
}

function hasSpecificProof(prompt: string): boolean {
  return (
    /\b(one|two|\d+|at least|exactly)\b/i.test(prompt) &&
    /\b(testimonial|proof|metric|result|outcome)\b/i.test(prompt)
  );
}

function hasStructureOrScopeConstraints(prompt: string, context?: Record<string, unknown>): boolean {
  if (Boolean(context?.mustInclude) || Boolean(context?.systemGoals)) {
    return true;
  }

  return /\b(must|should|exactly|only|at least|at most|include one|include two|use one|use two|limit|headline|opening|section|cta|call to action|keep the tone|focus on|rather than|lead with)\b/i.test(
    prompt,
  );
}

function hasOrgFitSpecificity(prompt: string): boolean {
  return /\b(mid-sized|enterprise|regulated|after acquisitions?|identity and access management|iam|b2b|saas)\b/i.test(
    prompt,
  );
}

function hasDifferentiationInstructions(prompt: string): boolean {
  return /\b(avoid generic|do not use|differentiat|not generic|lead with|operational control|exclude buzzwords|avoid fear-based)\b/i.test(
    prompt,
  );
}

function hasMarketerConstraints(prompt: string, context?: Record<string, unknown>): boolean {
  if (hasConstraints(prompt, context)) {
    return true;
  }

  const marketerConstraintHits =
    prompt.match(/\b(emphasize|focus on|include|incorporate|highlight|address|mention|lead with)\b/gi)?.length ?? 0;
  const hasStructuralRequirements = /\b(call to action|cta|headline|opening|section)\b/i.test(prompt);
  const hasProofRequirements = hasProofRequest(prompt);
  return marketerConstraintHits >= 2 || hasStructuralRequirements || hasProofRequirements;
}

function hasWeakAudienceSpecificity(prompt: string): boolean {
  const broadAudience = /\b(it decision-makers?|decision-makers?|enterprise buyers?|audience)\b/i.test(prompt);
  const specificRoles = /\b(cto|vp|director|head|manager|architect|administrator)\b/i.test(prompt);
  return broadAudience && !specificRoles;
}

function hasHighAudienceSpecificity(prompt: string): boolean {
  const hasRole = /\b(cto|vp|director|head|manager|architect|administrator)\b/i.test(prompt);
  const hasContext = /\b(mid-sized|enterprise|regulated|after acquisitions?|audit|sprawl|overhead)\b/i.test(prompt);
  return hasRole && hasContext;
}

function hasWeakPositioning(prompt: string): boolean {
  const categoryTermCount = countCategoryTerms(prompt);
  const differentiator = /\b(acquisition|audit pressure|identity sprawl|admin overhead|access governance|regulatory|operational control|governance cleanup)\b/i.test(
    prompt,
  );
  return categoryTermCount > 0 && !differentiator;
}

function hasHighGenericValuePropDensity(prompt: string, functionalHintCount: number): boolean {
  const decorativeCount = detectGenericPhrases(prompt).length;
  const categoryTermCount = countCategoryTerms(prompt);
  return decorativeCount >= 2 || (categoryTermCount >= 3 && functionalHintCount <= 1);
}

function hasWeakConstraints(prompt: string, context?: Record<string, unknown>): boolean {
  const present = hasMarketerConstraints(prompt, context);
  if (!present) {
    return false;
  }

  const specific =
    /\b(one|two|\d+|at least|exactly|measurable|quantifiable|avoid|do not|keep the tone|rather than|focus on)\b/i.test(
      prompt,
    );
  const highDifferentiation = /\b(audit|sprawl|overhead|regulatory|governance)\b/i.test(prompt);
  return !specific && !highDifferentiation;
}

function deriveMarketerSignals(prompt: string, context?: Record<string, unknown>): MarketerSignals {
  const audiencePresent = hasAudience(prompt, context);
  const exclusionsPresent = hasExclusions(prompt, context);
  const leadAnglePresent = hasLeadAngle(prompt);
  const proofRequested = hasProofRequest(prompt);
  const proofWeak = proofRequested && !hasSpecificProof(prompt);
  const proofSpecificityHigh = proofRequested && hasSpecificProof(prompt);
  const differentiationInstructionsPresent = hasDifferentiationInstructions(prompt);
  const positioningWeak = hasWeakPositioning(prompt);
  const audienceSpecificityLow = hasWeakAudienceSpecificity(prompt);
  const audienceSpecificityHigh = hasHighAudienceSpecificity(prompt);
  const orgFitSpecificityHigh = hasOrgFitSpecificity(prompt);
  const constraintsWeak = hasWeakConstraints(prompt, context);
  const structuralConstraintsPresent = hasStructureOrScopeConstraints(prompt, context);
  const functionalHintCount = [
    audiencePresent,
    leadAnglePresent,
    proofRequested,
    proofSpecificityHigh,
    exclusionsPresent,
    differentiationInstructionsPresent,
    orgFitSpecificityHigh,
    structuralConstraintsPresent,
  ].filter(Boolean).length;
  const genericValuePropDensityHigh = hasHighGenericValuePropDensity(prompt, functionalHintCount);
  const contextContrastLow =
    !leadAnglePresent && (positioningWeak || genericValuePropDensityHigh || audienceSpecificityLow);

  return {
    audienceSpecificityLow,
    audienceSpecificityHigh,
    positioningWeak,
    proofRequested,
    proofWeak,
    proofSpecificityHigh,
    leadAnglePresent,
    differentiationInstructionsPresent,
    contextContrastLow,
    genericValuePropDensityHigh,
    orgFitSpecificityHigh,
    constraintsWeak,
    functionalCompositionScore: functionalHintCount,
  };
}

function pushIssue(issues: Issue[], code: IssueCode, severity: Issue['severity'], message: string) {
  issues.push({ code, severity, message });
}

export function analyzePrompt(input: AnalyzeAndRewriteRequest): Analysis {
  const prompt = input.prompt.trim();
  const context = input.context;
  const issues: Issue[] = [];
  const signals: string[] = [];

  const audiencePresent = hasAudience(prompt, context);
  const constraintsPresent = input.role === 'marketer' ? hasMarketerConstraints(prompt, context) : hasConstraints(prompt, context);
  const exclusionsPresent = hasExclusions(prompt, context);
  const overloaded = input.role === 'marketer' ? isMarketerTaskOverloaded(prompt) : isTaskOverloaded(prompt);
  const foundGenericPhrases = detectGenericPhrases(prompt);
  const marketerSignals = input.role === 'marketer' ? deriveMarketerSignals(prompt, context) : undefined;

  if (!audiencePresent) {
    pushIssue(issues, 'AUDIENCE_MISSING', 'high', 'The prompt does not define a clear target audience.');
    signals.push('No audience specified.');
  }

  if (!constraintsPresent || prompt.length < 30) {
    pushIssue(
      issues,
      'CONSTRAINTS_MISSING',
      'high',
      'The prompt lacks clear constraints or implementation boundaries.',
    );
    signals.push('Constraints are missing.');
  } else if (input.role === 'marketer' && marketerSignals?.constraintsWeak) {
    signals.push('Constraints exist but remain broad.');
  }

  if (!exclusionsPresent) {
    pushIssue(
      issues,
      'EXCLUSIONS_MISSING',
      'medium',
      'The prompt does not define what language or approaches to avoid.',
    );
    signals.push('No exclusions are defined.');
  }

  if (overloaded) {
    pushIssue(
      issues,
      'TASK_OVERLOADED',
      'medium',
      'The prompt appears to combine multiple jobs, increasing ambiguity.',
    );
    signals.push('Task appears overloaded with multiple asks.');
  }

  if (foundGenericPhrases.length > 0) {
    pushIssue(
      issues,
      'GENERIC_PHRASES_DETECTED',
      'medium',
      `Detected generic phrasing: ${foundGenericPhrases.join(', ')}.`,
    );
    signals.push('Generic phrasing is likely to produce bland output.');
  }
  const marketerRiskSignals =
    input.role === 'marketer'
      ? [
          !audiencePresent || Boolean(marketerSignals?.audienceSpecificityLow),
          !exclusionsPresent,
          !Boolean(marketerSignals?.leadAnglePresent),
          Boolean(marketerSignals?.positioningWeak),
          Boolean(marketerSignals?.proofWeak),
          Boolean(marketerSignals?.genericValuePropDensityHigh),
          foundGenericPhrases.length > 0,
        ]
      : [];

  const genericOutputRisk =
    input.role === 'marketer'
      ? Math.min(10, Math.max(0, 3 + marketerRiskSignals.filter(Boolean).length))
      : Math.min(
          10,
          Math.max(
            0,
            3 +
              (audiencePresent ? 0 : 2) +
              (constraintsPresent ? 0 : 2) +
              (exclusionsPresent ? 0 : 1) +
              (overloaded ? 1 : 0) +
              (foundGenericPhrases.length > 0 ? 2 : 0),
          ),
        );

  const marketerHighRisk = input.role === 'marketer' && marketerRiskSignals.filter(Boolean).length >= 3;
  if (genericOutputRisk >= 7 || marketerHighRisk) {
    pushIssue(
      issues,
      'GENERIC_OUTPUT_RISK_HIGH',
      'high',
      'The prompt is likely to produce generic output without stronger direction.',
    );
    signals.push('High likelihood of generic output.');
  }

  const scores: ScoreSet =
    input.role === 'marketer'
      ? {
          scope: computeScopeScore({ prompt, context, constraintsPresent, overloaded }),
          contrast: Math.min(
            10,
            Math.max(
              0,
              4 +
                (audiencePresent ? 1 : 0) +
                (marketerSignals?.audienceSpecificityHigh ? 1 : 0) +
                (marketerSignals?.leadAnglePresent ? 1 : 0) +
                (marketerSignals?.proofRequested ? 1 : 0) +
                (marketerSignals?.proofSpecificityHigh ? 1 : 0) +
                (marketerSignals?.orgFitSpecificityHigh ? 1 : 0) +
                (marketerSignals?.differentiationInstructionsPresent ? 1 : 0) +
                Math.min(2, Math.floor((marketerSignals?.functionalCompositionScore ?? 0) / 3)) +
                (input.mode === 'high_contrast' && marketerSignals?.leadAnglePresent ? 1 : 0) +
                (input.mode === 'high_contrast' && marketerSignals?.differentiationInstructionsPresent ? 1 : 0) -
                (audiencePresent ? 0 : 2) -
                (marketerSignals?.audienceSpecificityLow ? 1 : 0) -
                (marketerSignals?.positioningWeak ? 1 : 0) -
                (marketerSignals?.contextContrastLow ? 1 : 0) -
                (marketerSignals?.genericValuePropDensityHigh ? 1 : 0) -
                (foundGenericPhrases.length > 0 ? 1 : 0),
            ),
          ),
          clarity: Math.max(
            0,
            8 - (marketerSignals?.proofWeak ? 1 : 0) - (marketerSignals?.constraintsWeak ? 1 : 0) - (overloaded ? 2 : 0),
          ),
          constraintQuality: !constraintsPresent ? 2 : marketerSignals?.constraintsWeak ? 5 : 7,
          genericOutputRisk,
          tokenWasteRisk: Math.min(10, Math.max(0, 2 + (overloaded ? 3 : 0) + (prompt.length > 1000 ? 2 : 0))),
        }
      : {
          scope: computeScopeScore({ prompt, context, constraintsPresent, overloaded }),
          contrast: Math.min(
            10,
            Math.max(
              0,
              (audiencePresent ? 2 : 0) +
                audienceOrContextSpecificity(prompt, context) +
                (hasContrastBoundary(prompt, context) ? 2 : 0) +
                (constraintsPresent ? 1 : 0) -
                (foundGenericPhrases.length > 0 ? 4 : 0) -
                (overloaded ? 1 : 0),
            ),
          ),
          clarity: Math.max(0, 8 - (overloaded ? 2 : 0) - (constraintsPresent ? 0 : 2)),
          constraintQuality: constraintsPresent ? 7 : 2,
          genericOutputRisk,
          tokenWasteRisk: Math.min(10, Math.max(0, 3 + (overloaded ? 2 : 0) + (prompt.length > 1000 ? 3 : 1))),
        };

  if (input.role === 'marketer' && input.mode === 'high_contrast' && marketerSignals) {
    const hasRequiredDifferentiators =
      audiencePresent &&
      marketerSignals.leadAnglePresent &&
      (marketerSignals.proofRequested || marketerSignals.proofSpecificityHigh);

    const clearlyMoreGenericOverall =
      genericOutputRisk >= 8 &&
      marketerSignals.genericValuePropDensityHigh &&
      !exclusionsPresent &&
      !marketerSignals.differentiationInstructionsPresent;

    if (hasRequiredDifferentiators && !clearlyMoreGenericOverall) {
      scores.contrast = Math.max(scores.contrast, 5);
    }
  }

  const uniqueCodes = [...new Set(issues.map((issue) => issue.code))];
  const summary =
    issues.length === 0
      ? 'Prompt quality is acceptable with low generic-output risk.'
      : `Detected ${issues.length} quality issue(s); tighten constraints and exclusions for better output.`;

  return {
    scores,
    issues,
    detectedIssueCodes: uniqueCodes,
    signals: signals.slice(0, 12),
    summary,
  };
}
