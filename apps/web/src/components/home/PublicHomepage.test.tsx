import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeAndRewriteV2Response } from '@promptfire/shared';
import { ResultsCard } from '../results';
import { resolveResultsPresentation } from '../results';
import { HomepageContent } from './PublicHomepage';
import { resolveHomepageExample, strongPromptExample } from './examples';

const sampleResult: AnalyzeAndRewriteV2Response = {
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
  meta: {
    version: '2',
    requestId: 'req_guided_completion',
    latencyMs: 12,
    providerMode: 'mock',
  },
};

describe('HomepageContent', () => {
  it('renders homepage sections in the requested order', () => {
    const markup = renderToStaticMarkup(
      <HomepageContent topShell={<div>TopShell</div>} onLoadExample={vi.fn()} loading={false} />,
    );

    expect(markup.indexOf('TopShell')).toBeLessThan(markup.indexOf('Project sponsor'));
    expect(markup.indexOf('Project sponsor')).toBeLessThan(markup.indexOf('How PeakPrompt works'));
    expect(markup.indexOf('How PeakPrompt works')).toBeLessThan(markup.indexOf('Start with an example'));
    expect(markup.indexOf('Start with an example')).toBeLessThan(markup.indexOf('What PeakPrompt scores'));
    expect(markup.indexOf('What PeakPrompt scores')).toBeLessThan(markup.indexOf('Strong prompts stay intact'));
    expect(markup.indexOf('Strong prompts stay intact')).toBeLessThan(markup.indexOf('Score-first'));
  });

  it('omits results by default and renders them when provided', () => {
    const withoutResults = renderToStaticMarkup(
      <HomepageContent topShell={<div>TopShell</div>} onLoadExample={vi.fn()} loading={false} />,
    );

    expect(withoutResults).not.toContain('Score breakdown');

    const withResults = renderToStaticMarkup(
      <HomepageContent
        topShell={<div>TopShell</div>}
        onLoadExample={vi.fn()}
        loading={false}
        resultsCard={
          <ResultsCard
            prompt="Write a webhook handler."
            result={sampleResult}
            presentation={resolveResultsPresentation(sampleResult, 'developer')}
            topSuggestions={sampleResult.improvementSuggestions}
            showOptionalRewrite={false}
            onToggleOptionalRewrite={vi.fn()}
            onForceRewrite={vi.fn(async () => undefined)}
            onCopyPrompt={vi.fn()}
          />
        }
      />,
    );

    expect(withResults).toContain('Score breakdown');
  });
});

describe('resolveHomepageExample', () => {
  it('maps each example id to the expected prompt and role', () => {
    expect(resolveHomepageExample('general')).toEqual({
      prompt:
        'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
      role: 'general',
    });
    expect(resolveHomepageExample('marketer')).toEqual({
      prompt: 'Write landing page copy for our IAM service.',
      role: 'marketer',
    });
    expect(resolveHomepageExample('developer')).toEqual({
      prompt: 'Write a webhook handler.',
      role: 'developer',
    });
    expect(resolveHomepageExample('strong')).toEqual({
      prompt: strongPromptExample,
      role: 'general',
    });
  });
});
