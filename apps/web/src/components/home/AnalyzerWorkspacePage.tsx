import { fixtures } from '../../config';
import { LoadingCard, ResultsCard, TopShell } from '../results';
import { usePromptAnalyzer } from './usePromptAnalyzer';

export function AnalyzerWorkspacePage() {
  const analyzer = usePromptAnalyzer();

  return (
    <main className="pf-page-shell pf-page-stack text-pf-text-primary">
      <TopShell
        prompt={analyzer.prompt}
        role={analyzer.role}
        mode={analyzer.mode}
        rewritePreference={analyzer.rewritePreference}
        roles={analyzer.roles}
        modes={analyzer.modes}
        loading={analyzer.loading}
        canSubmit={analyzer.canSubmit}
        error={analyzer.error}
        onSubmit={analyzer.handleSubmit}
        onPromptChange={analyzer.setPrompt}
        onRoleChange={analyzer.setRole}
        onModeChange={analyzer.setMode}
        onRewritePreferenceChange={analyzer.setRewritePreference}
        onLoadGeneral={() => {
          analyzer.setRole('general');
          analyzer.setPrompt(fixtures.general);
        }}
        onLoadMarketer={() => {
          analyzer.setRole('marketer');
          analyzer.setPrompt(fixtures.marketer);
        }}
        onLoadDeveloper={() => {
          analyzer.setRole('developer');
          analyzer.setPrompt(fixtures.developer);
        }}
      />

      {analyzer.panel === 'loading' && (
        <LoadingCard
          state={analyzer.uiState === 'loading-inference' ? 'loading-inference' : 'loading-local'}
          supportingOverride={
            analyzer.guidedSubmitLoading ? 'Building a stronger prompt from your answers...' : undefined
          }
        />
      )}

      {analyzer.panel === 'result' && analyzer.result && analyzer.presentation && (
        <ResultsCard
          prompt={analyzer.prompt}
          result={analyzer.result}
          presentation={analyzer.presentation}
          topSuggestions={analyzer.topSuggestions}
          showOptionalRewrite={analyzer.showOptionalRewrite}
          onToggleOptionalRewrite={() => analyzer.setShowOptionalRewrite((value) => !value)}
          onForceRewrite={analyzer.handleForceRewrite}
          onSubmitGuidedRewrite={analyzer.submitGuidedRewrite}
          guidedSubmitLoading={analyzer.guidedSubmitLoading}
          onCopyPrompt={analyzer.copyText}
        />
      )}
    </main>
  );
}
