import type { AnalyzeAndRewriteV2Response, ImprovementSuggestion } from '@promptfire/shared';
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
import { getRewritePresentationMode, type ResultsPresentation } from './helpers';

type ResultsCardProps = {
  prompt: string;
  result: AnalyzeAndRewriteV2Response;
  presentation: ResultsPresentation;
  topSuggestions: ImprovementSuggestion[];
  showOptionalRewrite: boolean;
  onToggleOptionalRewrite: () => void;
  onForceRewrite: () => Promise<void>;
  onCopyPrompt: (value: string) => void;
};

export function ResultsCard({
  prompt,
  result,
  presentation,
  topSuggestions,
  showOptionalRewrite,
  onToggleOptionalRewrite,
  onForceRewrite,
  onCopyPrompt,
}: ResultsCardProps) {
  const rewritePresentationMode = getRewritePresentationMode(result);
  const questionsText = (result.guidedCompletion?.questions ?? []).map((question, index) => `${index + 1}. ${question}`).join('\n');
  const guidedPrimaryValue =
    result.guidedCompletion?.template ?? result.guidedCompletion?.example ?? (questionsText.length > 0 ? questionsText : prompt);
  const heroPrimaryAction = () => {
    if (presentation.primarySurface === 'no-rewrite-needed') {
      onCopyPrompt(prompt);
      return;
    }

    if (presentation.primarySurface === 'full-rewrite' && result.rewrite) {
      onCopyPrompt(result.rewrite.rewrittenPrompt);
      return;
    }

    onCopyPrompt(guidedPrimaryValue);
  };
  const heroSecondaryAction =
    presentation.primarySurface === 'full-rewrite'
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

  const visibleSections = new Set(presentation.visibleSectionIds);

  return (
    <section className="grid gap-4 rounded-xl border border-pf-border-default bg-pf-bg-card p-6 shadow-md max-sm:p-4">
      <HeroCard result={result} hero={presentation.hero} onPrimaryAction={heroPrimaryAction} onSecondaryAction={heroSecondaryAction} />

      {visibleSections.has('subscores') && <ScoreBreakdown result={result} title={presentation.sectionTitles.subscores} />}

      {visibleSections.has('findings') && <FindingsList findings={presentation.findings} title={presentation.sectionTitles.findings} />}

      {visibleSections.has('best_next_move') && result.bestNextMove && (
        <NextStepCard bestNextMove={result.bestNextMove} title={presentation.nextStep.title} />
      )}

      {visibleSections.has('rewrite_panel') && presentation.primarySurface === 'full-rewrite' && result.rewrite && result.evaluation && (
        <FullRewriteCard result={result} view={presentation.rewritePanel} onCopyRewrite={() => onCopyPrompt(result.rewrite!.rewrittenPrompt)} />
      )}

      {visibleSections.has('rewrite_panel') && presentation.primarySurface === 'guided-completion' && (
        <GuidedCompletionCard
          prompt={prompt}
          result={result}
          topSuggestions={topSuggestions}
          view={presentation.guidedCompletion}
          showOptionalRewrite={showOptionalRewrite}
          onCopyPrompt={onCopyPrompt}
          onToggleOptionalRewrite={onToggleOptionalRewrite}
          onForceRewrite={onForceRewrite}
        />
      )}

      {visibleSections.has('why_no_rewrite') && presentation.primarySurface === 'no-rewrite-needed' && (
        <NoRewriteNeededCard
          result={result}
          prompt={prompt}
          view={presentation.noRewrite}
          showOptionalRewrite={showOptionalRewrite}
          onCopyPrompt={onCopyPrompt}
          onToggleOptionalRewrite={onToggleOptionalRewrite}
          onForceRewrite={onForceRewrite}
        />
      )}

      {visibleSections.has('technical_details') && (
        <TechnicalDetailsDrawer result={result} topSuggestions={topSuggestions} title={presentation.sectionTitles.technical_details} />
      )}
    </section>
  );
}
