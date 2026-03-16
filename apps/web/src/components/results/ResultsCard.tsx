import type { AnalyzeAndRewriteV2Response, BestNextMove, EvaluationV2, ImprovementSuggestion } from '@promptfire/shared';
import { ImpactBadge, MetricTile, Section, SurfaceCard, TechnicalMetric, sectionTitleClass } from '../ui';
import {
  bandLabel,
  formatSuggestionTitle,
  heroBandClass,
  scoreDimensionLabel,
  verdictCopy,
} from './helpers';
import type { ProductState } from './helpers';

type HeroView = {
  headline: string;
  supporting: string;
  primaryAction: string;
};

type ResultsCardProps = {
  prompt: string;
  result: AnalyzeAndRewriteV2Response;
  state: ProductState;
  hero: HeroView;
  findings: string[];
  topSuggestions: ImprovementSuggestion[];
  evaluation: EvaluationV2 | null;
  showOptionalRewrite: boolean;
  onToggleOptionalRewrite: () => void;
  onForceRewrite: () => Promise<void>;
  onCopyPrompt: (value: string) => void;
  onSetShowOptionalRewrite: (value: boolean) => void;
};

export function ResultsCard({
  prompt,
  result,
  state,
  hero,
  findings,
  topSuggestions,
  evaluation,
  showOptionalRewrite,
  onToggleOptionalRewrite,
  onForceRewrite,
  onCopyPrompt,
  onSetShowOptionalRewrite,
}: ResultsCardProps) {
  const bestNextMove: BestNextMove | null = result.bestNextMove ?? null;

  return (
    <section className="grid gap-4 rounded-xl border border-pf-border-default bg-white p-6 shadow-md max-sm:p-4">
      <section className={`grid gap-2 rounded-lg p-4 text-[#f7f4ea] ${heroBandClass(result.scoreBand)}`}>
        <p className="text-[0.8rem] uppercase tracking-[0.08em] opacity-80">Overall Score</p>
        <div className="flex flex-wrap items-end gap-4">
          <strong className="text-[clamp(3rem,9vw,5rem)] font-bold leading-[0.9] max-sm:text-[clamp(2.4rem,16vw,4rem)]">
            {result.overallScore}
          </strong>
          <span className="rounded-[999px] border border-[rgba(247,244,234,0.25)] bg-[rgba(247,244,234,0.14)] px-3 py-1 capitalize">
            {bandLabel(result.scoreBand)}
          </span>
        </div>
        <p className="text-2xl font-bold">{hero.headline}</p>
        <p className="max-w-[42rem]">{hero.supporting}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="border-transparent bg-[#f7f4ea] text-[#1b2e49] hover:bg-[#efe9d8]"
            onClick={() => {
              if (state === 'strong') {
                onCopyPrompt(prompt);
                return;
              }

              if (result.rewrite) {
                onCopyPrompt(result.rewrite.rewrittenPrompt);
                if (state === 'usable') {
                  onSetShowOptionalRewrite(true);
                }
                return;
              }

              void onForceRewrite();
            }}
          >
            {hero.primaryAction}
          </button>
          {state === 'strong' && (
            <button
              type="button"
              className="border-[rgba(247,244,234,0.4)] bg-transparent text-[#f7f4ea] hover:bg-[rgba(247,244,234,0.12)]"
              onClick={() => void onForceRewrite()}
            >
              Generate rewrite anyway
            </button>
          )}
        </div>
      </section>

      <Section title="Key findings">
        <ul className="grid list-disc gap-2 pl-[1.2rem]">
          {findings.map((finding) => (
            <li key={finding} className="text-[#253750]">
              {finding}
            </li>
          ))}
        </ul>
      </Section>

      {bestNextMove && (
        <SurfaceCard tone={state === 'strong' ? 'default' : 'suggestion'}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={sectionTitleClass}>{state === 'strong' ? 'Optional next move' : 'Best next move'}</h2>
            <ImpactBadge impact={bestNextMove.expectedImpact} />
          </div>
          <p className="font-semibold">{bestNextMove.title}</p>
          <p>{bestNextMove.rationale}</p>
          <p>Improves: {bestNextMove.targetScores.map(scoreDimensionLabel).join(', ')}</p>
          {bestNextMove.methodFit && (
            <p>
              Method fit: <code>{bestNextMove.methodFit.currentPattern ?? 'unknown'}</code> {'->'}{' '}
              <code>{bestNextMove.methodFit.recommendedPattern ?? 'unknown'}</code>
            </p>
          )}
          {bestNextMove.exampleChange && <p>Example: {bestNextMove.exampleChange}</p>}
        </SurfaceCard>
      )}

      <Section title="Sub-scores">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
          <MetricTile label="Scope" value={result.analysis.scores.scope} />
          <MetricTile label="Contrast" value={result.analysis.scores.contrast} />
          <MetricTile label="Clarity" value={result.analysis.scores.clarity} />
          <MetricTile label="Constraint quality" value={result.analysis.scores.constraintQuality} />
          <MetricTile label="Generic output risk" value={result.analysis.scores.genericOutputRisk} />
          <MetricTile label="Token waste risk" value={result.analysis.scores.tokenWasteRisk} />
        </div>
      </Section>

      {state === 'strong' && (
        <SurfaceCard tone="default">
          <h2 className={sectionTitleClass}>Why no rewrite?</h2>
          <p>
            {result.gating.rewritePreference === 'suppress'
              ? 'Rewrite suppressed by your preference.'
              : 'No rewrite needed because this prompt is already strong and expected gains are low.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onCopyPrompt(prompt)}>
              Copy original
            </button>
            <button type="button" onClick={() => void onForceRewrite()}>
              Generate rewrite anyway
            </button>
          </div>
        </SurfaceCard>
      )}

      {state === 'usable' && (
        <SurfaceCard tone="default">
          <h2 className={sectionTitleClass}>Suggested improvement</h2>
          {topSuggestions.length > 0 ? (
            <ul>
              {topSuggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <strong>{formatSuggestionTitle(suggestion)}:</strong> {suggestion.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p>Prompt is usable. Tightening constraints or specificity may still improve outputs.</p>
          )}
          {result.rewrite ? (
            <>
              <button type="button" onClick={onToggleOptionalRewrite}>
                {showOptionalRewrite ? 'Hide rewrite preview' : 'Show rewrite preview'}
              </button>
              {showOptionalRewrite && (
                <SurfaceCard tone="rewrite" className="mt-1">
                  <pre>{result.rewrite.rewrittenPrompt}</pre>
                  {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
                  <button type="button" onClick={() => onCopyPrompt(result.rewrite!.rewrittenPrompt)}>
                    Copy rewritten prompt
                  </button>
                </SurfaceCard>
              )}
            </>
          ) : (
            <button type="button" onClick={() => void onForceRewrite()}>
              Generate rewrite
            </button>
          )}
        </SurfaceCard>
      )}

      {state === 'weak' && (
        <SurfaceCard tone="rewrite">
          <h2 className={sectionTitleClass}>Recommended rewrite</h2>
          {result.rewrite ? (
            <>
              <pre>{result.rewrite.rewrittenPrompt}</pre>
              {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
              <button type="button" onClick={() => onCopyPrompt(result.rewrite!.rewrittenPrompt)}>
                Copy rewritten prompt
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void onForceRewrite()}>
              Generate rewrite
            </button>
          )}
        </SurfaceCard>
      )}

      {result.rewrite && evaluation && (
        <SurfaceCard tone="verdict">
          <h2 className={sectionTitleClass}>Rewrite verdict</h2>
          <p className="font-bold">{verdictCopy(evaluation).label}</p>
          <p>{verdictCopy(evaluation).recommendation}</p>
          <p>
            Overall delta: <code>{evaluation.overallDelta}</code>
          </p>
          <div className="grid gap-1">
            {(['scope', 'contrast', 'clarity'] as const).map((dimension) => (
              <p key={dimension}>
                {scoreDimensionLabel(dimension)}: <code>{evaluation.scoreComparison.original[dimension]}</code> {'->'}{' '}
                <code>{evaluation.scoreComparison.rewrite[dimension]}</code>
              </p>
            ))}
          </div>
        </SurfaceCard>
      )}

      {state !== 'strong' && (
        <Section title="How to improve this prompt">
          {result.improvementSuggestions.length > 0 ? (
            <div className="grid gap-3">
              {result.improvementSuggestions.map((suggestion) => (
                <SurfaceCard key={suggestion.id} tone="suggestion" className="gap-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base">{formatSuggestionTitle(suggestion)}</h3>
                    <ImpactBadge impact={suggestion.impact} />
                  </div>
                  <p className="mt-2">{suggestion.reason}</p>
                  <p className="mt-2">Improves: {suggestion.targetScores.map(scoreDimensionLabel).join(', ')}</p>
                  {suggestion.exampleChange && <p className="mt-2">Example: {suggestion.exampleChange}</p>}
                </SurfaceCard>
              ))}
            </div>
          ) : (
            <p>No specific follow-up suggestions for this prompt.</p>
          )}
        </Section>
      )}

      <details className="border-t border-pf-border-divider pt-3">
        <summary className="cursor-pointer text-[#3f5066]">Technical details</summary>
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
      </details>
    </section>
  );
}
