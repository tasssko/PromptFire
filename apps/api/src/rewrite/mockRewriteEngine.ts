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
      return 'Tighten to a clear deliverable, specify audience/context, and add one concrete boundary.';
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
        ? 'Add one concrete requirement such as exact section count, example count, or decision criteria.'
        : undefined,
      input.analysis?.detectedIssueCodes.includes('EXCLUSIONS_MISSING')
        ? 'Add one concrete exclusion tied to this task output.'
        : undefined,
    ].filter(Boolean);

    const marketerDirectives =
      input.role === 'marketer'
        ? [
            input.analysis?.detectedIssueCodes.includes('AUDIENCE_MISSING')
              ? 'Define the exact audience, for CTOs or IT directors with a concrete business context.'
              : 'Preserve the existing audience and sharpen specificity without broadening it.',
            input.analysis?.detectedIssueCodes.includes('GENERIC_OUTPUT_RISK_HIGH')
              ? 'Anchor the opening in one concrete operational condition already present in the prompt context; avoid fear-based framing.'
              : undefined,
            'Require one concrete proof artifact, such as a customer result, metric, or direct comparison.',
            input.analysis?.detectedIssueCodes.includes('EXCLUSIONS_MISSING')
              ? 'Ban generic claims such as seamless, robust, and powerful.'
              : undefined,
            'Keep the same deliverable and audience; do not add extra channels or new jobs.',
          ].filter(Boolean)
        : [];

    const rewrittenPrompt = [
      `Role: ${input.role}.`,
      `Mode: ${input.mode}.`,
      input.prompt.trim(),
      modeInstruction(input.mode),
      ...constraints,
      ...marketerDirectives,
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
