import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeAndRewriteV2Response } from '@promptfire/shared';
import { ResultsCard } from './ResultsCard';
import { resolveResultsPresentation } from './helpers';

describe('ResultsCard', () => {
  it('renders guided completion once for weak developer webhook prompts without a rewrite verdict card', () => {
    const result: AnalyzeAndRewriteV2Response = {
      id: 'par_webhook_guided_completion',
      overallScore: 35,
      scoreBand: 'poor',
      rewriteRecommendation: 'rewrite_recommended',
      analysis: {
        scores: {
          scope: 3,
          contrast: 4,
          clarity: 5,
          constraintQuality: 2,
          genericOutputRisk: 7,
          tokenWasteRisk: 3,
        },
        issues: [{ code: 'CONSTRAINTS_MISSING', severity: 'high', message: 'The prompt needs runtime and payload boundaries.' }],
        detectedIssueCodes: ['CONSTRAINTS_MISSING', 'GENERIC_OUTPUT_RISK_HIGH'],
        signals: [],
        summary: 'The request is too open-ended for a safe implementation rewrite.',
      },
      improvementSuggestions: [
        {
          id: 'define_io_contract',
          title: 'define input and output shape',
          reason: 'Specify request payload, response format, and validation expectations.',
          impact: 'high',
          targetScores: ['constraintQuality', 'clarity', 'genericOutputRisk'],
          category: 'structure',
        },
      ],
      bestNextMove: {
        id: 'define_io_contract',
        type: 'clarify_output_structure',
        title: 'Define input and output shape',
        rationale: 'The model needs explicit input/output shape constraints so the result is directly usable instead of generic.',
        expectedImpact: 'high',
        targetScores: ['constraintQuality', 'clarity', 'genericOutputRisk'],
      },
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'high',
        majorBlockingIssues: true,
      },
      rewrite: null,
      evaluation: {
        status: 'no_significant_change',
        overallDelta: 0,
        signals: [],
        scoreComparison: {
          original: { scope: 3, contrast: 4, clarity: 5 },
          rewrite: { scope: 3, contrast: 4, clarity: 5 },
        },
      },
      rewritePresentationMode: 'template_with_example',
      guidedCompletion: {
        mode: 'template_with_example',
        title: 'Fill in the missing details',
        summary: 'Add runtime, input, validation, and success/failure boundaries before asking for code.',
        questions: [
          'What runtime or framework should be used?',
          'What does the input payload look like?',
          'How should validation be defined and enforced?',
          'What should happen on success and on failure?',
        ],
        template:
          'Write a webhook handler in [runtime/framework] that accepts [input format]. Validate the request against [schema or rule]. On success, return [success response]. On failure, return [error response]. Exclude [out-of-scope behavior].',
        example:
          'Example of a stronger prompt: Write a webhook handler in Node.js using Express that accepts JSON payloads. Validate the request body against a predefined JSON schema. On success, return a 200 status code with a JSON success response. On validation failure, return a 400 status code with a descriptive error message. Exclude unsupported HTTP methods and non-JSON requests.',
      },
      guidedCompletionForm: {
        enabled: true,
        title: 'Complete the missing details',
        summary: 'This prompt is too open-ended for a strong rewrite. Answer the missing details below and PeakPrompt will build a better version.',
        submitLabel: 'Build stronger prompt',
        skipLabel: 'Skip and rewrite anyway',
        blocks: [
          {
            id: 'runtime',
            kind: 'radio',
            label: 'What runtime or framework should this target?',
            required: true,
            mapsTo: 'context',
            options: [{ id: 'node_express', label: 'Node.js / Express', value: 'Node.js / Express' }],
          },
          {
            id: 'behaviors',
            kind: 'checkbox',
            label: 'Which behaviors must be included?',
            required: true,
            mapsTo: 'includes',
            options: [{ id: 'validation', label: 'Validation', value: 'validation' }],
          },
          {
            id: 'successFailure',
            kind: 'radio',
            label: 'How should success and failure be handled?',
            required: true,
            mapsTo: 'detail',
            options: [{ id: 'http_responses', label: 'Explicit HTTP responses', value: 'explicit HTTP responses' }],
          },
        ],
      },
      meta: {
        version: '2',
        requestId: 'req_guided_completion',
        latencyMs: 12,
        providerMode: 'mock',
      },
    };

    const markup = renderToStaticMarkup(
      <ResultsCard
        prompt="Write a webhook handler."
        result={result}
        presentation={resolveResultsPresentation(result, 'developer')}
        topSuggestions={result.improvementSuggestions}
        showOptionalRewrite={false}
        onToggleOptionalRewrite={vi.fn()}
        onForceRewrite={vi.fn(async () => undefined)}
        onSubmitGuidedRewrite={vi.fn(async () => undefined)}
        guidedSubmitLoading={false}
        onCopyPrompt={vi.fn()}
      />,
    );

    expect(markup).toContain('Prompt is too open-ended');
    expect(markup).toContain('Score breakdown');
    expect(markup).toContain('Main issues');
    expect(markup).toContain('Best structural fix');
    expect(markup).toContain('Complete the missing details');
    expect(markup).toContain('Before rewriting');
    expect(markup).toContain('Build stronger prompt');
    expect(markup).toContain('Skip and rewrite anyway');
    expect(markup).not.toContain('Guided completion');
    expect(markup).not.toContain('Recommended rewrite');
  });

  it('renders a stronger prompt card for guided-submit results even when evaluation is absent', () => {
    const result: AnalyzeAndRewriteV2Response = {
      id: 'par_guided_submit_result',
      overallScore: 74,
      scoreBand: 'strong',
      rewriteRecommendation: 'no_rewrite_needed',
      analysis: {
        scores: {
          scope: 8,
          contrast: 8,
          clarity: 8,
          constraintQuality: 6,
          genericOutputRisk: 3,
          tokenWasteRisk: 3,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'Prompt is now bounded enough to use.',
      },
      improvementSuggestions: [],
      bestNextMove: null,
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'low',
        majorBlockingIssues: false,
      },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt:
          'Write a short landing page hero for ecommerce founders doing $1M-$10M ARR. Lead with one proof point, end with a demo CTA, and avoid generic marketing buzzwords.',
      },
      evaluation: null,
      rewritePresentationMode: 'full_rewrite',
      requestSource: 'guided_submit',
      guidedCompletion: null,
      guidedCompletionForm: null,
      meta: {
        version: '2',
        requestId: 'req_guided_submit_result',
        latencyMs: 8,
        providerMode: 'mock',
      },
    };

    const markup = renderToStaticMarkup(
      <ResultsCard
        prompt="Write better copy."
        result={result}
        presentation={resolveResultsPresentation(result, 'general')}
        topSuggestions={result.improvementSuggestions}
        showOptionalRewrite={false}
        onToggleOptionalRewrite={vi.fn()}
        onForceRewrite={vi.fn(async () => undefined)}
        onSubmitGuidedRewrite={vi.fn(async () => undefined)}
        guidedSubmitLoading={false}
        onCopyPrompt={vi.fn()}
      />,
    );

    expect(markup).toContain('Stronger prompt');
    expect(markup).toContain('Built from your answers');
    expect(markup).toContain('Write a short landing page hero for ecommerce founders doing $1M-$10M ARR.');
    expect(markup).not.toContain('Build stronger prompt');
    expect(markup).not.toContain('Skip and rewrite anyway');
  });

  it('does not render scaffold text in the stronger prompt card if the backend regresses', () => {
    const result: AnalyzeAndRewriteV2Response = {
      id: 'par_guided_submit_scaffold',
      overallScore: 74,
      scoreBand: 'strong',
      rewriteRecommendation: 'no_rewrite_needed',
      analysis: {
        scores: {
          scope: 8,
          contrast: 8,
          clarity: 8,
          constraintQuality: 6,
          genericOutputRisk: 3,
          tokenWasteRisk: 3,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'Prompt is now bounded enough to use.',
      },
      improvementSuggestions: [],
      bestNextMove: null,
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'low',
        majorBlockingIssues: false,
      },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: `Original request:
Write better copy.

Additional constraints:
- Primary goal: persuade

Create a stronger, more specific version of the prompt that preserves the user’s intent while adding these boundaries.`,
      },
      evaluation: null,
      rewritePresentationMode: 'full_rewrite',
      requestSource: 'guided_submit',
      guidedCompletion: null,
      guidedCompletionForm: null,
      meta: {
        version: '2',
        requestId: 'req_guided_submit_scaffold',
        latencyMs: 8,
        providerMode: 'mock',
      },
    };

    const markup = renderToStaticMarkup(
      <ResultsCard
        prompt="Write better copy."
        result={result}
        presentation={resolveResultsPresentation(result, 'general')}
        topSuggestions={result.improvementSuggestions}
        showOptionalRewrite={false}
        onToggleOptionalRewrite={vi.fn()}
        onForceRewrite={vi.fn(async () => undefined)}
        onSubmitGuidedRewrite={vi.fn(async () => undefined)}
        guidedSubmitLoading={false}
        onCopyPrompt={vi.fn()}
      />,
    );

    expect(markup).toContain('Stronger prompt');
    expect(markup).not.toContain('Original request:');
    expect(markup).not.toContain('Additional constraints:');
    expect(markup).not.toContain('Create a stronger, more specific version');
  });
});
