import type { AnalyzeAndRewriteV2Response, ImprovementSuggestion } from '@promptfire/shared';
import { MetricTile, Section, SurfaceCard, TechnicalMetric, sectionTitleClass } from '../ui';
import {
  bandLabel,
  formatSuggestionTitle,
  getVisibleRewritePrompt,
  scoreDimensionLabel,
  type ActionCardView,
  type HeroView,
  type RewritePanelView,
} from './helpers';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type HeroCardProps = {
  result: AnalyzeAndRewriteV2Response;
  hero: HeroView;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
};

export function HeroCard({ result, hero, onPrimaryAction, onSecondaryAction }: HeroCardProps) {
  return (
    <section className={cx('pf-hero-card', `pf-hero-${result.scoreBand}`)}>
      <p className="text-[0.8rem] uppercase tracking-[0.08em] text-pf-text-inverse">Overall score</p>
      <div className="flex flex-wrap items-end gap-4">
        <strong className="text-[clamp(3rem,9vw,5rem)] font-bold leading-[0.9] text-pf-text-inverse max-sm:text-[clamp(2.4rem,16vw,4rem)]">
          {result.overallScore}
        </strong>
        <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 capitalize text-pf-text-inverse">
          {bandLabel(result.scoreBand)}
        </span>
      </div>
      <p className="text-2xl font-bold text-pf-text-inverse">{hero.headline}</p>
      <p className="max-w-[42rem] text-pf-text-inverse">{hero.supporting}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="pf-button-primary-on-hero" onClick={onPrimaryAction}>
          {hero.primaryAction}
        </button>
        {hero.secondaryAction && onSecondaryAction && (
          <button type="button" className="pf-button-ghost-on-hero" onClick={onSecondaryAction}>
            {hero.secondaryAction}
          </button>
        )}
      </div>
    </section>
  );
}

export function FindingsList({ findings, title }: { findings: string[]; title: string }) {
  return (
    <Section title={title}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {findings.map((finding) => (
          <li key={finding} className="list-none rounded-md border border-pf-border-subtle bg-pf-bg-cardSubtle px-3 py-2 text-pf-text-secondary">
            {finding}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function scoreSeverity(label: string, value: number): number {
  if (label === 'Generic risk' || label === 'Wordiness') {
    return value;
  }

  return 10 - value;
}

export function ScoreBreakdown({ result, title }: { result: AnalyzeAndRewriteV2Response; title: string }) {
  const metrics = [
    { label: 'Scope', value: result.analysis.scores.scope },
    { label: 'Contrast', value: result.analysis.scores.contrast },
    { label: 'Clarity', value: result.analysis.scores.clarity },
    { label: scoreDimensionLabel('constraintQuality'), value: result.analysis.scores.constraintQuality },
    { label: scoreDimensionLabel('genericOutputRisk'), value: result.analysis.scores.genericOutputRisk },
    { label: scoreDimensionLabel('tokenWasteRisk'), value: result.analysis.scores.tokenWasteRisk },
  ];
  const highlighted = new Set(
    [...metrics]
      .sort((left, right) => scoreSeverity(right.label, right.value) - scoreSeverity(left.label, left.value))
      .filter((metric) => scoreSeverity(metric.label, metric.value) >= 4)
      .slice(0, 3)
      .map((metric) => metric.label),
  );

  return (
    <Section title={title}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
        {metrics.map((metric) => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} emphasized={highlighted.has(metric.label)} />
        ))}
      </div>
    </Section>
  );
}

type FullRewriteCardProps = {
  result: AnalyzeAndRewriteV2Response;
  view: RewritePanelView;
  onCopyRewrite: () => void;
};

export function FullRewriteCard({ result, view, onCopyRewrite }: FullRewriteCardProps) {
  const visibleRewritePrompt = getVisibleRewritePrompt(result);

  if (!result.rewrite || !visibleRewritePrompt) {
    return null;
  }

  return (
    <SurfaceCard tone="rewrite">
      <h2 className={sectionTitleClass}>{view.title}</h2>
      <p className="font-semibold text-pf-text-primary">{view.verdictLabel}</p>
      <p>{view.verdictRecommendation}</p>
      <pre>{visibleRewritePrompt}</pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="pf-button-primary" onClick={onCopyRewrite}>
          {view.primaryActionLabel}
        </button>
      </div>
    </SurfaceCard>
  );
}

type GuidedCompletionCardProps = {
  prompt: string;
  result: AnalyzeAndRewriteV2Response;
  topSuggestions: ImprovementSuggestion[];
  view: ActionCardView;
  showOptionalRewrite: boolean;
  onCopyPrompt: (value: string) => void;
  onToggleOptionalRewrite: () => void;
  onForceRewrite: () => Promise<void>;
};

export function GuidedCompletionCard({
  prompt,
  result,
  topSuggestions,
  view,
  showOptionalRewrite,
  onCopyPrompt,
  onToggleOptionalRewrite,
  onForceRewrite,
}: GuidedCompletionCardProps) {
  const guidedCompletion = result.guidedCompletion ?? null;
  const questionsText = (guidedCompletion?.questions ?? []).map((question, index) => `${index + 1}. ${question}`).join('\n');
  const primaryValue = guidedCompletion?.template ?? guidedCompletion?.example ?? (questionsText || prompt);
  const fallbackList =
    topSuggestions.length > 0
      ? topSuggestions.slice(0, 3).map((suggestion) => formatSuggestionTitle(suggestion))
      : [];
  const hiddenRewrite = result.rewrite && result.evaluation?.status !== 'material_improvement';
  const prominentBlock = view.template ? 'template' : view.example ? 'example' : view.questions?.length ? 'questions' : null;

  return (
    <SurfaceCard tone="suggestion">
      <h2 className={sectionTitleClass}>{view.title}</h2>
      <p className="font-semibold text-pf-text-primary">{view.lead}</p>
      {view.reasons.length > 0 && (
        <ul className="grid gap-1 text-sm text-pf-text-secondary">
          {view.reasons.map((reason) => (
            <li key={reason} className="list-none">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {prominentBlock === 'questions' && view.questions?.length ? (
        <div className="grid gap-2">
          {view.questionTitle && <p className="font-semibold text-pf-text-primary">{view.questionTitle}</p>}
          <ul className="grid gap-1">
            {view.questions.map((question) => (
              <li key={question} className="list-none text-pf-text-secondary">
                {question}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prominentBlock === 'template' && view.template && view.templateLabel ? (
        <>
          <p className="font-semibold text-pf-text-primary">{view.templateLabel}</p>
          <pre>{view.template}</pre>
        </>
      ) : null}

      {prominentBlock === 'example' && view.example && view.exampleLabel ? (
        <>
          <p className="font-semibold text-pf-text-primary">{view.exampleLabel}</p>
          <pre>{view.example}</pre>
        </>
      ) : null}

      {!prominentBlock && fallbackList.length > 0 && (
        <ul className="grid gap-1">
          {fallbackList.map((item) => (
            <li key={item} className="list-none text-pf-text-secondary">
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="pf-button-primary" onClick={() => onCopyPrompt(primaryValue)}>
          {view.primaryActionLabel}
        </button>
        {hiddenRewrite && view.secondaryActionLabel && (
          <button type="button" className="pf-button-secondary" onClick={onToggleOptionalRewrite}>
            {showOptionalRewrite ? view.secondaryActionExpandedLabel : view.secondaryActionLabel}
          </button>
        )}
        {!result.rewrite && (
          <button type="button" className="pf-button-secondary" onClick={() => void onForceRewrite()}>
            {view.forceRewriteLabel}
          </button>
        )}
      </div>

      {hiddenRewrite && showOptionalRewrite && result.rewrite && (
        <SurfaceCard tone="rewrite" className="mt-1">
          <p className="font-semibold text-pf-text-primary">{view.rewritePreviewTitle}</p>
          <pre>{result.rewrite.rewrittenPrompt}</pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pf-button-secondary" onClick={() => onCopyPrompt(result.rewrite!.rewrittenPrompt)}>
              {view.previewCopyLabel}
            </button>
          </div>
        </SurfaceCard>
      )}
    </SurfaceCard>
  );
}

export function TechnicalDetailsDrawer({
  result,
  topSuggestions,
  title,
}: {
  result: AnalyzeAndRewriteV2Response;
  topSuggestions: ImprovementSuggestion[];
  title: string;
}) {
  const rewritePresentationMode = result.rewritePresentationMode ?? (result.rewrite ? 'full_rewrite' : 'suppressed');

  return (
    <details className="border-t border-pf-border-subtle pt-3">
      <summary className="cursor-pointer text-pf-text-muted">{title}</summary>
      <div className="mt-4 grid gap-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-2">
          <TechnicalMetric>
            Recommendation <strong>{result.rewriteRecommendation}</strong>
          </TechnicalMetric>
          <TechnicalMetric>
            Rewrite preference <code>{result.gating.rewritePreference}</code>
          </TechnicalMetric>
          <TechnicalMetric>
            Expected improvement <code>{result.gating.expectedImprovement}</code>
          </TechnicalMetric>
          <TechnicalMetric>
            Major blocking issues <code>{result.gating.majorBlockingIssues ? 'true' : 'false'}</code>
          </TechnicalMetric>
          <TechnicalMetric>
            Rewrite presentation <code>{rewritePresentationMode}</code>
          </TechnicalMetric>
          <TechnicalMetric>
            Issue codes <code>{result.analysis.detectedIssueCodes.length}</code>
          </TechnicalMetric>
          <TechnicalMetric>
            Evaluation signals <code>{result.evaluation?.signals.length ?? 0}</code>
          </TechnicalMetric>
          <TechnicalMetric>
            Request ID <code>{result.meta.requestId}</code>
          </TechnicalMetric>
          <TechnicalMetric>
            Provider <code>{result.meta.providerMode}</code>
          </TechnicalMetric>
          {result.meta.providerModel && (
            <TechnicalMetric>
              Model <code>{result.meta.providerModel}</code>
            </TechnicalMetric>
          )}
          <TechnicalMetric>
            Latency <code>{result.meta.latencyMs}ms</code>
          </TechnicalMetric>
        </div>

        {result.evaluation && (
          <SurfaceCard tone="default">
            <p className="font-semibold text-pf-text-primary">Rewrite evaluation</p>
            <div className="grid gap-1">
              {(['scope', 'contrast', 'clarity'] as const).map((dimension) => (
                <p key={dimension}>
                  {scoreDimensionLabel(dimension)}: <code>{result.evaluation!.scoreComparison.original[dimension]}</code> {'->'}{' '}
                  <code>{result.evaluation!.scoreComparison.rewrite[dimension]}</code>
                </p>
              ))}
              <p>
                Overall delta: <code>{result.evaluation.overallDelta}</code>
              </p>
            </div>
          </SurfaceCard>
        )}

        {topSuggestions.length > 0 && (
          <SurfaceCard tone="default">
            <p className="font-semibold text-pf-text-primary">Detailed suggestions</p>
            <div className="grid gap-3">
              {topSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="grid gap-1">
                  <p className="font-medium text-pf-text-primary">{formatSuggestionTitle(suggestion)}</p>
                  <p>{suggestion.reason}</p>
                  <p>Improves: {suggestion.targetScores.map(scoreDimensionLabel).join(', ')}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        )}

        {result.analysis.detectedIssueCodes.length > 0 && (
          <p>
            Raw issue codes: <code>{result.analysis.detectedIssueCodes.join(', ')}</code>
          </p>
        )}
        {result.evaluation?.signals.length ? (
          <p>
            Full evaluation signals: <code>{result.evaluation.signals.join(', ')}</code>
          </p>
        ) : null}
        {result.guidedCompletion?.rationale && <p>Fallback rationale: {result.guidedCompletion.rationale}</p>}
      </div>
    </details>
  );
}
