import type { AnalyzeAndRewriteV2Response, EvaluationV2, ImprovementSuggestion } from '@promptfire/shared';
import {
  FindingsList,
  FullRewriteCard,
  GuidedCompletionCard,
  HeroCard,
  NextStepCard,
  NoRewriteNeededCard,
  ScoreBreakdown,
  TechnicalDetailsDrawer,
} from './ResultSections';
import { getRewritePresentationMode, heroCopy, resolvePrimarySurface, type ProductState } from './helpers';

type ResultsCardProps = {
  prompt: string;
  result: AnalyzeAndRewriteV2Response;
  state: ProductState;
  hero: ReturnType<typeof heroCopy>;
  findings: string[];
  topSuggestions: ImprovementSuggestion[];
  evaluation: EvaluationV2 | null;
  showOptionalRewrite: boolean;
  onToggleOptionalRewrite: () => void;
  onForceRewrite: () => Promise<void>;
  onCopyPrompt: (value: string) => void;
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
}: ResultsCardProps) {
  const primarySurface = resolvePrimarySurface(result);
  const rewritePresentationMode = getRewritePresentationMode(result);
  const questionsText = (result.guidedCompletion?.questions ?? []).map((question, index) => `${index + 1}. ${question}`).join('\n');
  const guidedPrimaryValue =
    result.guidedCompletion?.template ?? result.guidedCompletion?.example ?? (questionsText.length > 0 ? questionsText : prompt);
  const heroPrimaryAction = () => {
    if (primarySurface === 'no-rewrite-needed') {
      onCopyPrompt(prompt);
      return;
    }

    if (primarySurface === 'full-rewrite' && result.rewrite) {
      onCopyPrompt(result.rewrite.rewrittenPrompt);
      return;
    }

    onCopyPrompt(guidedPrimaryValue);
  };
  const heroSecondaryAction =
    primarySurface === 'full-rewrite'
      ? undefined
      : result.rewrite || rewritePresentationMode === 'suppressed'
        ? () => {
            if (result.rewrite) {
              onToggleOptionalRewrite();
              return;
            }
            void onForceRewrite();
          }
        : undefined;
  const heroSecondaryLabel =
    primarySurface === 'full-rewrite' ? undefined : result.rewrite ? 'Show rewrite anyway' : 'Generate rewrite anyway';

  return (
    <section className="grid gap-4 rounded-xl border border-pf-border-default bg-pf-bg-card p-6 shadow-md max-sm:p-4">
      <HeroCard
        result={result}
        hero={hero}
        primaryActionLabel={hero.primaryAction}
        secondaryActionLabel={heroSecondaryLabel}
        onPrimaryAction={heroPrimaryAction}
        onSecondaryAction={heroSecondaryAction}
      />

      <ScoreBreakdown result={result} />

      <FindingsList findings={findings} />

      {result.bestNextMove && primarySurface !== 'no-rewrite-needed' && (
        <NextStepCard bestNextMove={result.bestNextMove} optional={state === 'strong'} />
      )}

      {primarySurface === 'full-rewrite' && result.rewrite && evaluation && (
        <FullRewriteCard result={result} onCopyRewrite={() => onCopyPrompt(result.rewrite!.rewrittenPrompt)} />
      )}

      {primarySurface === 'guided-completion' && (
        <GuidedCompletionCard
          prompt={prompt}
          result={result}
          topSuggestions={topSuggestions}
          showOptionalRewrite={showOptionalRewrite}
          onCopyPrompt={onCopyPrompt}
          onToggleOptionalRewrite={onToggleOptionalRewrite}
          onForceRewrite={onForceRewrite}
        />
      )}

      {primarySurface === 'no-rewrite-needed' && (
        <NoRewriteNeededCard
          result={result}
          prompt={prompt}
          showOptionalRewrite={showOptionalRewrite}
          onCopyPrompt={onCopyPrompt}
          onToggleOptionalRewrite={onToggleOptionalRewrite}
          onForceRewrite={onForceRewrite}
        />
      )}

      <TechnicalDetailsDrawer result={result} topSuggestions={topSuggestions} />
    </section>
  );
}
