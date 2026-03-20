import type { ReactNode } from 'react';
import { LoadingCard, ResultsCard, TopShell } from '../results';
import {
  exampleGalleryContent,
  howItWorksContent,
  scoreDimensionsContent,
  sponsorStripContent,
  strongPromptPromiseContent,
  trustRowContent,
} from './content';
import { ExampleGallerySection } from './ExampleGallerySection';
import { HowItWorksSection } from './HowItWorksSection';
import { resolveHomepageExample, type HomepageExampleId } from './examples';
import { ScoreDimensionsSection } from './ScoreDimensionsSection';
import { SponsorStrip } from './SponsorStrip';
import { StrongPromptPromiseStrip } from './StrongPromptPromiseStrip';
import { TrustRow } from './TrustRow';
import { usePromptAnalyzer } from './usePromptAnalyzer';

export function HomepageContent({
  topShell,
  loadingCard,
  resultsCard,
  onLoadExample,
  loading,
}: {
  topShell: ReactNode;
  loadingCard?: ReactNode;
  resultsCard?: ReactNode;
  onLoadExample: (id: HomepageExampleId) => void;
  loading: boolean;
}) {
  return (
    <main className="mx-auto grid max-w-[980px] gap-6 px-6 py-5 text-pf-text-primary max-sm:gap-5 max-sm:px-3 max-sm:py-3">
      {topShell}
      <SponsorStrip content={sponsorStripContent} />
      <HowItWorksSection content={howItWorksContent} />
      <ExampleGallerySection content={exampleGalleryContent} onLoadExample={onLoadExample} loading={loading} />
      <ScoreDimensionsSection content={scoreDimensionsContent} />
      <StrongPromptPromiseStrip content={strongPromptPromiseContent} />
      <TrustRow content={trustRowContent} />
      {loadingCard}
      {resultsCard}
    </main>
  );
}

export function PublicHomepage() {
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
        onCopyPrompt={analyzer.copyText}
      />
    ) : undefined;

  const loadingCard =
    analyzer.panel === 'loading' ? (
      <LoadingCard state={analyzer.uiState === 'loading-inference' ? 'loading-inference' : 'loading-local'} />
    ) : undefined;

  return (
    <HomepageContent
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
