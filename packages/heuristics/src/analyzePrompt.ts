import type {
  AnalyzeAndRewriteRequest,
  Analysis,
  Issue,
  IssueCode,
  ScoreSet,
} from '@promptfire/shared';

const genericPhrases = ['seamless', 'robust', 'powerful', 'innovative', 'cutting-edge'];

function hasAudience(prompt: string, context?: Record<string, unknown>) {
  const audienceHint = context?.audienceHint;
  return Boolean(audienceHint) || /\b(audience|for\s+[a-z]|target\s+user)\b/i.test(prompt);
}

function hasConstraints(prompt: string, context?: Record<string, unknown>) {
  const hasContextConstraints = Boolean(context?.mustInclude) || Boolean(context?.systemGoals);
  const hasPromptConstraints = /\b(must|should|exactly|limit|only|at least|at most)\b/i.test(prompt);
  return hasContextConstraints || hasPromptConstraints;
}

function hasExclusions(prompt: string, context?: Record<string, unknown>) {
  const hasContextExclusions = Boolean(context?.mustAvoid) || Boolean(context?.forbiddenPhrases);
  const hasPromptExclusions = /\b(avoid|exclude|without|do not|don't)\b/i.test(prompt);
  return hasContextExclusions || hasPromptExclusions;
}

function isTaskOverloaded(prompt: string) {
  const verbCount = (prompt.match(/\b(build|write|create|design|implement|analyze|optimize|draft)\b/gi) ?? []).length;
  const listSeparators = (prompt.match(/,| and |;| then /gi) ?? []).length;
  return verbCount >= 3 || listSeparators >= 4;
}

function detectGenericPhrases(prompt: string) {
  return genericPhrases.filter((phrase) => prompt.toLowerCase().includes(phrase));
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
  const constraintsPresent = hasConstraints(prompt, context);
  const exclusionsPresent = hasExclusions(prompt, context);
  const overloaded = isTaskOverloaded(prompt);
  const foundGenericPhrases = detectGenericPhrases(prompt);

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
    signals.push('Constraints are missing or too weak.');
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

  const riskScore =
    (audiencePresent ? 0 : 2) +
    (constraintsPresent ? 0 : 2) +
    (exclusionsPresent ? 0 : 1) +
    (overloaded ? 1 : 0) +
    (foundGenericPhrases.length > 0 ? 2 : 0);

  const genericOutputRisk = Math.min(10, Math.max(0, 3 + riskScore));

  if (genericOutputRisk >= 7) {
    pushIssue(
      issues,
      'GENERIC_OUTPUT_RISK_HIGH',
      'high',
      'The prompt is likely to produce generic output without stronger direction.',
    );
    signals.push('High likelihood of generic output.');
  }

  const scores: ScoreSet = {
    scope: Math.max(0, 10 - (overloaded ? 4 : 2) - (constraintsPresent ? 0 : 2)),
    contrast: Math.max(0, 10 - (foundGenericPhrases.length > 0 ? 5 : 2) - (audiencePresent ? 0 : 2)),
    clarity: Math.max(0, 8 - (overloaded ? 2 : 0) - (constraintsPresent ? 0 : 2)),
    constraintQuality: constraintsPresent ? 7 : 2,
    genericOutputRisk,
    tokenWasteRisk: Math.min(10, Math.max(0, 3 + (overloaded ? 2 : 0) + (prompt.length > 1000 ? 3 : 1))),
  };

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
