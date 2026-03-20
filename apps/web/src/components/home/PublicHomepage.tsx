import type { ReactNode } from 'react';
import type { ThemeMode } from '../../theme';
import { LoadingCard, ResultsCard, TopShell } from '../results';
import {
  exampleGalleryContent,
  footerContent,
  howItWorksContent,
  scoreDimensionsContent,
  sponsorStripContent,
  strongPromptPromiseContent,
  trustRowContent,
} from './content';
import { ExampleGallerySection } from './ExampleGallerySection';
import { Footer } from './Footer';
import { HowItWorksSection } from './HowItWorksSection';
import { resolveHomepageExample, type HomepageExampleId } from './examples';
import { ScoreDimensionsSection } from './ScoreDimensionsSection';
import { SponsorStrip } from './SponsorStrip';
import { StrongPromptPromiseStrip } from './StrongPromptPromiseStrip';
import { TrustRow } from './TrustRow';
import { usePromptAnalyzer } from './usePromptAnalyzer';

export function HomepageContent({
  hero,
  topShell,
  loadingCard,
  resultsCard,
  onLoadExample,
  loading,
  theme,
}: {
  hero?: ReactNode;
  topShell: ReactNode;
  loadingCard?: ReactNode;
  resultsCard?: ReactNode;
  onLoadExample: (id: HomepageExampleId) => void;
  loading: boolean;
  theme?: ThemeMode;
}) {
  return (
    <main className="pf-page-shell pf-page-stack-tight text-pf-text-primary max-sm:gap-5 max-sm:py-3">
      {hero}
      {topShell}
      {loadingCard}
      {resultsCard}
      <SponsorStrip content={sponsorStripContent} theme={theme ?? 'light'} />
      <HowItWorksSection content={howItWorksContent} />
      <ExampleGallerySection content={exampleGalleryContent} onLoadExample={onLoadExample} loading={loading} />
      <ScoreDimensionsSection content={scoreDimensionsContent} />
      <StrongPromptPromiseStrip content={strongPromptPromiseContent} />
      <TrustRow content={trustRowContent} />
      <Footer {...footerContent} />
    </main>
  );
}

export function PublicHomepage({
  theme,
  onGetStarted,
}: {
  theme: ThemeMode;
  onGetStarted: () => void;
}) {
  const analyzer = usePromptAnalyzer();

  function handleLoadExample(id: HomepageExampleId) {
    const example = resolveHomepageExample(id);
    analyzer.setRole(example.role);
    analyzer.setPrompt(example.prompt);
  }

  const resultsCard =
    analyzer.panel === 'result' && analyzer.result && analyzer.presentation ? (
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
    ) : undefined;

  const loadingCard =
    analyzer.panel === 'loading' ? (
      <LoadingCard
        state={analyzer.uiState === 'loading-inference' ? 'loading-inference' : 'loading-local'}
        supportingOverride={analyzer.guidedSubmitLoading ? 'Building a stronger prompt from your answers...' : undefined}
      />
    ) : undefined;

  return (
    <HomepageContent
      theme={theme}
      hero={
        <section className="grid gap-4 rounded-xl border border-pf-border-subtle bg-shell p-6 shadow-none max-sm:p-4">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pf-text-muted">PEAKPrompt</p>
            <h1 className="text-[clamp(1.8rem,3vw,2.6rem)] font-semibold text-pf-text-primary">
              Analyze prompts, then keep your runs in one calm workspace.
            </h1>
            <p className="max-w-2xl text-sm text-pf-text-secondary">
              Sign in with email. Add a passkey later for faster access.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="pf-button-primary text-sm font-semibold" onClick={onGetStarted}>
              Get started
            </button>
          </div>
        </section>
      }
      topShell={
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
            analyzer.setPrompt(resolveHomepageExample('general').prompt);
          }}
          onLoadMarketer={() => {
            analyzer.setRole('marketer');
            analyzer.setPrompt(resolveHomepageExample('marketer').prompt);
          }}
          onLoadDeveloper={() => {
            analyzer.setRole('developer');
            analyzer.setPrompt(resolveHomepageExample('developer').prompt);
          }}
          showExampleLoader={false}
        />
      }
      loadingCard={loadingCard}
      resultsCard={resultsCard}
      onLoadExample={handleLoadExample}
      loading={analyzer.loading}
    />
  );
}
