import type { RewriteInput } from './types';

function roleGuidance(role: RewriteInput['role']): string {
  switch (role) {
    case 'developer':
      return 'Focus on implementation boundaries, runtime constraints, failure handling, and explicit exclusions.';
    case 'marketer':
      return 'Focus on audience clarity and concrete positioning detail. Preserve valid audience details when present, keep the same deliverable, and replace abstract phrasing with grounded context and explicit exclusions.';
    case 'general':
    default:
      return 'Focus on clarity, concrete scope, and practical constraints without domain assumptions.';
  }
}

function modeGuidance(mode: RewriteInput['mode']): string {
  switch (mode) {
    case 'tight_scope':
      return 'Narrow to one clear deliverable and reduce ambiguity aggressively.';
    case 'high_contrast':
      return 'Increase differentiation through grounded context or comparison when supported by the prompt; if not supported, keep the rewrite minimal and concrete.';
    case 'low_token_cost':
      return 'Keep output concise while preserving essential constraints.';
    case 'balanced':
    default:
      return 'Improve task boundedness with concrete audience, structure, and exclusions, and prefer direct prompt fills over meta-instructions.';
  }
}

export interface RewriteInstructions {
  system: string;
  user: string;
}

export function buildRewriteInstructions(input: RewriteInput): RewriteInstructions {
  const analysisIssues = input.analysis?.detectedIssueCodes.join(', ') ?? 'none';
  const analysisSignals = input.analysis?.signals.join(' | ') ?? 'none';

  const system = [
    'You are a prompt rewriting assistant.',
    'Return only JSON with keys: rewrittenPrompt, explanation, changes.',
    'Do not invent product or system facts not present in the input/context.',
    roleGuidance(input.role),
    modeGuidance(input.mode),
  ].join(' ');

  const user = JSON.stringify(
    {
      prompt: input.prompt,
      role: input.role,
      mode: input.mode,
      context: input.context ?? {},
      preferences: input.preferences,
      analysis: {
        issueCodes: analysisIssues,
        signals: analysisSignals,
        summary: input.analysis?.summary ?? '',
      },
      outputRequirements: {
        rewrittenPrompt: 'plain text, practical, usable in a real LLM workflow',
        explanation: 'short explanation of key improvements',
        changes: 'array of concise change descriptions',
      },
    },
    null,
    2,
  );

  return { system, user };
}
