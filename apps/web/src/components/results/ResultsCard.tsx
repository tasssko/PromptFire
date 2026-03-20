import type { AnalyzeAndRewriteV2Response, ImprovementSuggestion } from '@promptfire/shared';
import { GuidedCompletionFormCard } from './GuidedCompletionFormCard';
import {
  FindingsList,
  FullRewriteCard,
  GuidedCompletionCard,
  HeroCard,
  ScoreBreakdown,
  TechnicalDetailsDrawer,
} from './ResultSections';
import { getRewritePresentationMode, getVisibleRewritePrompt, hasGuidedCompletionForm, type ResultsPresentation } from './helpers';

type ResultsCardProps = {
  prompt: string;
  result: AnalyzeAndRewriteV2Response;
  presentation: ResultsPresentation;
  topSuggestions: ImprovementSuggestion[];
  showOptionalRewrite: boolean;
  onToggleOptionalRewrite: () => void;
  onForceRewrite: () => Promise<void>;
  onSubmitGuidedRewrite: (answers: Record<string, string | string[]>) => Promise<void>;
  guidedSubmitLoading: boolean;
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
  onSubmitGuidedRewrite,
  guidedSubmitLoading,
  onCopyPrompt,
}: ResultsCardProps) {
  const rewritePresentationMode = getRewritePresentationMode(result);
  const showGuidedForm = hasGuidedCompletionForm(result);
  const visibleRewritePrompt = getVisibleRewritePrompt(result);
  const questionsText = (result.guidedCompletion?.questions ?? []).map((question, index) => `${index + 1}. ${question}`).join('\n');
  const guidedPrimaryValue =
    result.guidedCompletion?.template ?? result.guidedCompletion?.example ?? (questionsText.length > 0 ? questionsText : prompt);
  const heroPrimaryAction = () => {
    if (presentation.primarySurface === 'no-rewrite-needed') {
      onCopyPrompt(prompt);
      return;
    }

    if (presentation.primarySurface === 'full-rewrite' && visibleRewritePrompt) {
      onCopyPrompt(visibleRewritePrompt);
      return;
    }

    if (presentation.primarySurface === 'guided-completion-form') {
      globalThis.document?.getElementById('guided-completion-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    onCopyPrompt(guidedPrimaryValue);
  };
  const heroSecondaryAction =
    presentation.primarySurface === 'full-rewrite'
      ? undefined
      : presentation.primarySurface === 'guided-completion-form'
        ? () => {
            void onForceRewrite();
          }
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

      {visibleSections.has('action_card') && (
        <>
          {showGuidedForm && result.guidedCompletionForm ? (
            <div id="guided-completion-form-card">
              <GuidedCompletionFormCard
                prompt={prompt}
                view={presentation.actionCard}
                form={result.guidedCompletionForm}
                submitting={guidedSubmitLoading}
                onSubmitGuidedRewrite={onSubmitGuidedRewrite}
                onForceRewrite={onForceRewrite}
                onCopyPrompt={onCopyPrompt}
              />
            </div>
          ) : (
            <GuidedCompletionCard
              prompt={prompt}
              result={result}
              topSuggestions={topSuggestions}
              view={presentation.actionCard}
              showOptionalRewrite={showOptionalRewrite}
              onCopyPrompt={onCopyPrompt}
              onToggleOptionalRewrite={onToggleOptionalRewrite}
              onForceRewrite={onForceRewrite}
            />
          )}
        </>
      )}

      {visibleSections.has('rewrite_panel') && presentation.primarySurface === 'full-rewrite' && visibleRewritePrompt && (
        <FullRewriteCard result={result} view={presentation.rewritePanel} onCopyRewrite={() => onCopyPrompt(visibleRewritePrompt)} />
      )}

      {visibleSections.has('technical_details') && (
        <TechnicalDetailsDrawer result={result} topSuggestions={topSuggestions} title={presentation.sectionTitles.technical_details} />
      )}
    </section>
  );
}
