Below is a Codex-ready implementation brief for the homepage.

It is aligned with the current direction already in the repo: `App.tsx` as orchestration, `TopShell` and `ResultsCard` as domain components, score-first hierarchy, Tailwind backed by tokens, and plainspoken copy. The current `TopShell` already owns the main prompt input flow and copy, while `ResultsCard` owns the post-analysis state routing.  

---

# PeakPrompt homepage implementation brief v0.1

## Goal

Extend the current homepage so it feels more complete and productized **before analysis runs**, without weakening the analyzer-first structure.

The homepage should keep this order of importance:

1. analyzer shell
2. analyze action
3. score-first results when present
4. supporting homepage sections
5. sponsor strip as secondary

The homepage must still communicate one core promise:

**Paste a prompt, get one clear score, and only see rewrites when they are worth using.**

That already exists in `TopShell` and should remain the dominant message. 

---

# Implementation constraints

## Architectural constraints

Keep `App.tsx` as orchestration only.

Do not build large homepage sections inline in `App.tsx`. The repo direction is explicit that `App.tsx` should own top-level page composition and state wiring, while presentational structures move into domain and UI components.  

## Component placement

Use:

* `apps/web/src/components/results` or `apps/web/src/components/peakprompt` for homepage-specific composed sections
* `apps/web/src/components/ui` for reusable primitives like section wrappers, badges, cards, and tiles

This matches the existing frontend layering rules. 

## Styling constraints

Use Tailwind backed by tokens.

Do not introduce arbitrary new spacing, radius, shadow, or surface variants unless they are first normalized into the token/UI system. The repo already defines this as policy.

## Copy constraints

All copy should feel:

* confident
* plainspoken
* practical

Avoid debug-sounding language, vague AI phrasing, and over-promotional language. Stable section names should remain simple and direct.

---

# Final homepage composition

Render homepage in this order when there is **no result yet**:

1. `TopShell`
2. `SponsorStrip`
3. `HowItWorksSection`
4. `ExampleGallerySection`
5. `ScoreDimensionsSection`
6. `StrongPromptPromiseStrip`
7. `TrustRow`
8. footer later if needed

When there **is** a result:

1. `TopShell`
2. optional `SponsorStrip`
3. `ResultsCard`
4. supporting homepage sections may remain below, but should feel clearly secondary

This preserves the repo’s current two-primary-surface model while allowing some lightweight homepage structure around it. The current app already renders `TopShell` first and `ResultsCard` second. 

---

# Required new components

## 1. `SponsorStrip`

### Purpose

Provide a secondary commercial/supporting banner without outranking PeakPrompt.

### Placement

Immediately below `TopShell`, above the explanatory sections.

### Props

```ts
type SponsorStripProps = {
  eyebrow: string;
  headline: string;
  supporting: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  chips?: string[];
  sponsorName: string;
  sponsorDescriptor: string;
  sponsorLogoAlt: string;
  sponsorLogoSrc?: string;
};
```

### Exact copy

```ts
const sponsorStripContent = {
  eyebrow: 'Project sponsor',
  headline: 'Escape maintenance purgatory?',
  supporting: 'Unblock your developers and ship software faster.',
  primaryCtaLabel: 'Visit StackTrack',
  primaryCtaHref: 'https://stacktrack.com',
  chips: ['Clear ownership', 'Secure by design'],
  sponsorName: 'StackTrack Inc',
  sponsorDescriptor: 'Full managed, reliable software build and delivery infrastructure.',
  sponsorLogoAlt: 'StackTrack logo',
};
```

### Behavior rules

* secondary surface only
* one CTA only
* max 2 chips
* right-side sponsor tile should be visually quieter than the analyzer shell
* no second CTA for now

### Layout rules

* same max width as `TopShell`
* compact height
* desktop: two-column banner
* mobile: stacked, sponsor tile underneath

---

## 2. `HowItWorksSection`

### Purpose

Explain the product in one glance.

### Props

```ts
type HowItWorksStep = {
  step: string;
  title: string;
  body: string;
};

type HowItWorksSectionProps = {
  title: string;
  steps: HowItWorksStep[];
};
```

### Exact copy

```ts
const howItWorksContent = {
  title: 'How PeakPrompt works',
  steps: [
    {
      step: '01',
      title: 'Paste a prompt',
      body: 'Start with the real prompt you are using, not an idealized version.',
    },
    {
      step: '02',
      title: 'Get one clear score',
      body: 'See how bounded, differentiated, and usable the prompt is.',
    },
    {
      step: '03',
      title: 'Only rewrite when it helps',
      body: 'Strong prompts get validation. Weaker prompts get direction and a rewrite when it is worth using.',
    },
  ],
};
```

### Design rules

* 3 equal cards on desktop
* stacked on mobile
* low-complexity cards
* no flashy icons required

---

## 3. `ExampleGallerySection`

### Purpose

Turn example loading into a visible homepage affordance instead of hiding all examples inside `TopShell` details.

The current `TopShell` already supports `onLoadGeneral`, `onLoadMarketer`, and `onLoadDeveloper`, so this section should wire into the same fixture-loading pattern rather than inventing a second source of truth. 

### Props

```ts
type ExampleCard = {
  id: 'general' | 'marketer' | 'developer' | 'strong';
  title: string;
  role: 'general' | 'marketer' | 'developer';
  excerpt: string;
  actionLabel: string;
};

type ExampleGallerySectionProps = {
  title: string;
  examples: ExampleCard[];
  onLoadExample: (id: ExampleCard['id']) => void;
};
```

### Exact copy

```ts
const exampleGalleryContent = {
  title: 'Start with an example',
  examples: [
    {
      id: 'general',
      title: 'Broad general prompt',
      role: 'general',
      excerpt: 'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
      actionLabel: 'Load example',
    },
    {
      id: 'marketer',
      title: 'IAM landing page',
      role: 'marketer',
      excerpt: 'Write landing page copy for our IAM service targeted at IT decision-makers in mid-sized enterprises...',
      actionLabel: 'Load example',
    },
    {
      id: 'developer',
      title: 'TypeScript trade-offs',
      role: 'developer',
      excerpt: 'Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity...',
      actionLabel: 'Load example',
    },
    {
      id: 'strong',
      title: 'Strong prompt example',
      role: 'general',
      excerpt: 'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead...',
      actionLabel: 'Load example',
    },
  ],
};
```

### Implementation note

For `strong`, either:

* add a fourth fixture, or
* map it to a dedicated inline constant in `App.tsx` orchestration and pass it through

### Behavior rules

* clicking any card updates prompt and role
* optionally scroll/focus prompt textarea
* cards stay lightweight and secondary to `TopShell`

---

## 4. `ScoreDimensionsSection`

### Purpose

Teach users what PeakPrompt scores before they run analysis.

The six dimensions should match the current product/UI vocabulary already used in results and helper logic. `ResultsCard` currently renders these exact six sub-scores. 

### Props

```ts
type ScoreDimensionCard = {
  key:
    | 'scope'
    | 'contrast'
    | 'clarity'
    | 'constraintQuality'
    | 'genericOutputRisk'
    | 'tokenWasteRisk';
  label: string;
  description: string;
};

type ScoreDimensionsSectionProps = {
  title: string;
  dimensions: ScoreDimensionCard[];
};
```

### Exact copy

```ts
const scoreDimensionsContent = {
  title: 'What PeakPrompt scores',
  dimensions: [
    {
      key: 'scope',
      label: 'Scope',
      description: 'How bounded the task is.',
    },
    {
      key: 'contrast',
      label: 'Contrast',
      description: 'How clearly the prompt differentiates the angle or framing.',
    },
    {
      key: 'clarity',
      label: 'Clarity',
      description: 'How direct and understandable the instructions are.',
    },
    {
      key: 'constraintQuality',
      label: 'Constraint quality',
      description: 'How useful the requirements and boundaries are.',
    },
    {
      key: 'genericOutputRisk',
      label: 'Generic output risk',
      description: 'How likely the prompt is to produce bland default output.',
    },
    {
      key: 'tokenWasteRisk',
      label: 'Token waste risk',
      description: 'How likely the prompt is to cause reruns or wasted effort.',
    },
  ],
};
```

### Design rules

* 6 compact tiles
* reuse `MetricTile` visual family if possible, but without numeric values
* educational, not diagnostic

---

## 5. `StrongPromptPromiseStrip`

### Purpose

State the most important differentiator clearly.

This matches the repo direction that strong prompts should be validated, rewrites should be suppressed by default when gains are low, and rewrite should appear as a tool rather than the default outcome. The current result logic already reflects strong/usable/weak routing and “Why no rewrite?” behavior.

### Props

```ts
type StrongPromptPromiseStripProps = {
  headline: string;
  supporting: string;
};
```

### Exact copy

```ts
const strongPromptPromiseContent = {
  headline: 'Strong prompts stay intact',
  supporting:
    'PeakPrompt validates strong prompts and only suggests rewrites when the gains are meaningful.',
};
```

### Design rules

* single horizontal strip
* premium but restrained
* should feel like a product principle, not a marketing gimmick

---

## 6. `TrustRow`

### Purpose

Provide light product proof without turning the homepage into a full marketing site.

### Props

```ts
type TrustItem = {
  title: string;
  body: string;
};

type TrustRowProps = {
  items: TrustItem[];
};
```

### Exact copy

```ts
const trustRowContent = {
  items: [
    {
      title: 'Score-first',
      body: 'One overall score with practical reasoning behind it.',
    },
    {
      title: 'Decision-oriented',
      body: 'Clear recommendation, not a wall of diagnostics.',
    },
    {
      title: 'Actionable',
      body: 'Concrete next steps when a prompt needs improvement.',
    },
  ],
};
```

### Design rules

* 3 compact cards or columns
* no logos/testimonials yet
* understated styling

---

# Suggested component tree

```tsx
<main>
  <TopShell ... />
  {!result && (
    <>
      <SponsorStrip {...sponsorStripContent} />
      <HowItWorksSection {...howItWorksContent} />
      <ExampleGallerySection
        {...exampleGalleryContent}
        onLoadExample={handleLoadHomepageExample}
      />
      <ScoreDimensionsSection {...scoreDimensionsContent} />
      <StrongPromptPromiseStrip {...strongPromptPromiseContent} />
      <TrustRow {...trustRowContent} />
    </>
  )}
  {result && (
    <>
      <SponsorStrip {...sponsorStripContent} />
      <ResultsCard ... />
      <HowItWorksSection {...howItWorksContent} />
      <ExampleGallerySection
        {...exampleGalleryContent}
        onLoadExample={handleLoadHomepageExample}
      />
      <ScoreDimensionsSection {...scoreDimensionsContent} />
      <StrongPromptPromiseStrip {...strongPromptPromiseContent} />
      <TrustRow {...trustRowContent} />
    </>
  )}
</main>
```

---

# App orchestration changes

## Add homepage example loader

Add a single loader function in `App.tsx`:

```ts
function handleLoadHomepageExample(id: 'general' | 'marketer' | 'developer' | 'strong') {
  switch (id) {
    case 'general':
      setRole('general');
      setPrompt(fixtures.general);
      break;
    case 'marketer':
      setRole('marketer');
      setPrompt(fixtures.marketer);
      break;
    case 'developer':
      setRole('developer');
      setPrompt(fixtures.developer);
      break;
    case 'strong':
      setRole('general');
      setPrompt(
        'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.',
      );
      break;
  }
}
```

## Keep existing `TopShell` behavior

Do not remove the current `Load example` disclosure inside `TopShell` yet. It can remain as a functional shortcut while the homepage gallery is added.

That keeps the change additive and low-risk.

---

# Recommended file structure

```txt
apps/web/src/components/home/
  SponsorStrip.tsx
  HowItWorksSection.tsx
  ExampleGallerySection.tsx
  ScoreDimensionsSection.tsx
  StrongPromptPromiseStrip.tsx
  TrustRow.tsx
  index.ts
```

Alternative acceptable location:

```txt
apps/web/src/components/peakprompt/
```

This is consistent with the repo rule that generic primitives live in `components/ui` and product-specific composed sections live in a domain layer.

---

# Reusable primitive guidance

Where possible, build these sections using existing or normalized primitives:

* `Section`
* `SurfaceCard`
* `MetricTile`
* shared title rhythm classes

The repo already calls these out as the right reusable UI foundation.

---

# Visual behavior rules

## Width and alignment

* all homepage sections align to same max width as `TopShell`
* same left/right grid
* same rhythm spacing between sections

This is explicitly part of the current unification direction. 

## Surface behavior

* analyzer shell remains the dominant white/shell surface
* sponsor strip is lower emphasis
* explanatory cards use standard card treatment
* no new one-off “marketing” styles

## Responsive behavior

* sections stack cleanly on mobile
* no horizontal overflow
* example cards and score tiles wrap naturally
* sponsor strip becomes vertical on narrow screens

These rules match the existing responsive guidance already documented for shell/cards/tiles. 

---

# Exact section headings

Use these exact headings:

* `How PeakPrompt works`
* `Start with an example`
* `What PeakPrompt scores`

Use this exact strip copy:

* `Strong prompts stay intact`

Do not invent alternate headings casually. The repo already sets a preference for stable, plain section naming.

---

# Non-goals

This homepage change does **not** include:

* scoring model changes
* rewrite policy changes
* API changes
* pricing section
* testimonials
* feature comparison grid
* long-form landing page marketing copy

That stays aligned with the current UI/spec direction, which is primarily about composition, consistency, and product clarity rather than broad product-marketing expansion.

---

# Acceptance criteria

This work is successful when:

* homepage feels complete before analysis runs
* `TopShell` remains the dominant action area
* sponsor strip feels secondary
* examples are easier to discover
* score dimensions are understandable before use
* strong-prompt positioning is obvious
* `App.tsx` remains orchestration-heavy rather than markup-heavy
* no new arbitrary styling values are introduced
* homepage still feels like one coherent PeakPrompt product

Those criteria reinforce the existing repo goals that the page should communicate one primary recommendation, keep rewrites conditional, and avoid devolving into individually styled panels.

---

# Suggested implementation order

1. extract homepage components
2. add `SponsorStrip`
3. add `HowItWorksSection`
4. add `ExampleGallerySection`
5. add `ScoreDimensionsSection`
6. add `StrongPromptPromiseStrip`
7. add `TrustRow`
8. polish spacing/alignment using existing tokens

---