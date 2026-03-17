import type { AnalyzeAndRewriteV2Response, BestNextMove, ImprovementSuggestion } from '@promptfire/shared';
import { ImpactBadge, MetricTile, Section, SurfaceCard, TechnicalMetric, sectionTitleClass } from '../ui';
import {
  bandLabel,
  formatSuggestionTitle,
  methodFitLabel,
  scoreDimensionLabel,
  type GuidedCompletionView,
  type HeroView,
  type NoRewriteView,
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
      <ul className="grid list-disc gap-2 pl-[1.2rem]">
        {findings.map((finding) => (
          <li key={finding} className="text-pf-text-secondary">
            {finding}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ScoreBreakdown({ result, title }: { result: AnalyzeAndRewriteV2Response; title: string }) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
        <MetricTile label="Scope" value={result.analysis.scores.scope} />
        <MetricTile label="Contrast" value={result.analysis.scores.contrast} />
        <MetricTile label="Clarity" value={result.analysis.scores.clarity} />
        <MetricTile label={scoreDimensionLabel('constraintQuality')} value={result.analysis.scores.constraintQuality} />
        <MetricTile label={scoreDimensionLabel('genericOutputRisk')} value={result.analysis.scores.genericOutputRisk} />
        <MetricTile label={scoreDimensionLabel('tokenWasteRisk')} value={result.analysis.scores.tokenWasteRisk} />
      </div>
    </Section>
  );
}

export function NextStepCard({ bestNextMove, title }: { bestNextMove: BestNextMove; title: string }) {
  return (
    <SurfaceCard tone="suggestion">
      <div className="flex items-center justify-between gap-2">
        <h2 className={sectionTitleClass}>{title}</h2>
        <ImpactBadge impact={bestNextMove.expectedImpact} />
      </div>
      <p className="font-semibold text-pf-text-primary">{bestNextMove.title}</p>
      <p>{bestNextMove.rationale}</p>
      <p>Improves: {bestNextMove.targetScores.map(scoreDimensionLabel).join(', ')}</p>
      {bestNextMove.methodFit && (
        <p>Best improvement path: {methodFitLabel(bestNextMove.methodFit.recommendedPattern)}</p>
      )}
      {bestNextMove.exampleChange && <p>Example: {bestNextMove.exampleChange}</p>}
    </SurfaceCard>
  );
}

type FullRewriteCardProps = {
  result: AnalyzeAndRewriteV2Response;
  view: RewritePanelView;
  onCopyRewrite: () => void;
};

export function FullRewriteCard({ result, view, onCopyRewrite }: FullRewriteCardProps) {
  if (!result.rewrite || !result.evaluation) {
    return null;
  }

  return (
    <SurfaceCard tone="rewrite">
      <h2 className={sectionTitleClass}>{view.title}</h2>
      <p className="font-semibold text-pf-text-primary">{view.verdictLabel}</p>
      <p>{view.verdictRecommendation}</p>
      <pre>{result.rewrite.rewrittenPrompt}</pre>
      {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
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
  view: GuidedCompletionView;
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
      ? topSuggestions.slice(0, 2).map((suggestion) => `${formatSuggestionTitle(suggestion)}: ${suggestion.reason}`)
      : [];
  const hiddenRewrite = result.rewrite && result.evaluation?.status !== 'material_improvement';

  return (
    <SurfaceCard tone="suggestion">
      <h2 className={sectionTitleClass}>{view.title}</h2>
      {view.detailTitle && <p className="font-semibold text-pf-text-primary">{view.detailTitle}</p>}
      <p>{view.summary}</p>

      {guidedCompletion?.questions && guidedCompletion.questions.length > 0 && (
        <ul className="grid list-disc gap-1 pl-[1.2rem]">
          {guidedCompletion.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      )}

      {!guidedCompletion?.questions?.length && fallbackList.length > 0 && (
        <ul className="grid list-disc gap-1 pl-[1.2rem]">
          {fallbackList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {guidedCompletion?.template && (
        <>
          <p className="font-semibold text-pf-text-primary">{view.templateLabel}</p>
          <pre>{guidedCompletion.template}</pre>
        </>
      )}

      {!guidedCompletion?.template && guidedCompletion?.example && (
        <>
          <p className="font-semibold text-pf-text-primary">{view.exampleLabel}</p>
          <pre>{guidedCompletion.example}</pre>
        </>
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

type NoRewriteNeededCardProps = {
  result: AnalyzeAndRewriteV2Response;
  prompt: string;
  view: NoRewriteView;
  showOptionalRewrite: boolean;
  onCopyPrompt: (value: string) => void;
  onToggleOptionalRewrite: () => void;
  onForceRewrite: () => Promise<void>;
};

export function NoRewriteNeededCard({
  result,
  prompt,
  view,
  showOptionalRewrite,
  onCopyPrompt,
  onToggleOptionalRewrite,
  onForceRewrite,
}: NoRewriteNeededCardProps) {
  return (
    <SurfaceCard tone="verdict">
      <h2 className={sectionTitleClass}>{view.title}</h2>
      <p className="font-semibold text-pf-text-primary">{view.label}</p>
      <p>{view.supporting}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="pf-button-primary" onClick={() => onCopyPrompt(prompt)}>
          {view.primaryActionLabel}
        </button>
        <button
          type="button"
          className="pf-button-secondary"
          onClick={result.rewrite ? onToggleOptionalRewrite : () => void onForceRewrite()}
        >
          {result.rewrite ? (showOptionalRewrite ? view.secondaryActionExpandedLabel : view.secondaryActionLabel) : view.secondaryActionLabel}
        </button>
      </div>

      {result.rewrite && showOptionalRewrite && (
        <SurfaceCard tone="rewrite" className="mt-1">
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
      <div className="my-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-2">
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
    </details>
  );
}
