import type { Rewrite } from '@promptfire/shared';
import type { RewriteEngine, RewriteInput } from './types';

function modeInstruction(mode: RewriteInput['mode']): string {
  switch (mode) {
    case 'tight_scope':
      return 'Narrow scope to one concrete deliverable and set explicit boundaries.';
    case 'high_contrast':
      return 'Emphasize audience tension and differentiating constraints.';
    case 'low_token_cost':
      return 'Use concise wording while preserving critical constraints.';
    case 'balanced':
    default:
      return 'Improve clarity, scope, and contrast without unnecessary verbosity.';
  }
}

export class MockRewriteEngine implements RewriteEngine {
  async rewrite(input: RewriteInput): Promise<Rewrite> {
    const constraints = [
      input.context?.runtime ? `Runtime: ${String(input.context.runtime)}.` : undefined,
      input.context?.deployment ? `Deployment: ${String(input.context.deployment)}.` : undefined,
      input.analysis?.detectedIssueCodes.includes('AUDIENCE_MISSING')
        ? 'Define the exact target audience.'
        : undefined,
      input.analysis?.detectedIssueCodes.includes('CONSTRAINTS_MISSING')
        ? 'Add non-negotiable constraints.'
        : undefined,
      input.analysis?.detectedIssueCodes.includes('EXCLUSIONS_MISSING')
        ? 'Include explicit exclusions.'
        : undefined,
    ].filter(Boolean);

    const rewrittenPrompt = [
      `Role: ${input.role}.`,
      `Mode: ${input.mode}.`,
      input.prompt.trim(),
      modeInstruction(input.mode),
      ...constraints,
    ].join(' ');

    return {
      role: input.role,
      mode: input.mode,
      rewrittenPrompt,
      explanation: 'Mock rewrite assembled from input intent, mode guidance, and deterministic findings.',
      changes: [
        'Added role/mode framing',
        'Applied mode-specific rewrite strategy',
        'Incorporated deterministic analysis findings',
      ],
    };
  }
}
