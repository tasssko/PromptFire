export const sponsorStripContent = {
  eyebrow: 'Project sponsor',
  headline: 'Escape maintenance purgatory?',
  supporting: 'Unblock your developers and ship software faster.',
  primaryCtaLabel: 'Visit StackTrack',
  primaryCtaHref: 'https://stacktrack.com',
  chips: ['Clear ownership', 'Secure by design'],
  sponsorName: 'StackTrack Inc',
  sponsorDescriptor: 'Full managed, reliable software build and delivery infrastructure.',
  sponsorLogoAlt: 'StackTrack logo',
} as const;

export const howItWorksContent = {
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
} as const;

export const exampleGalleryContent = {
  title: 'Start with an example',
  examples: [
    {
      id: 'general',
      title: 'Broad general prompt',
      role: 'general',
      excerpt:
        'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
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
      excerpt:
        'Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity...',
      actionLabel: 'Load example',
    },
    {
      id: 'strong',
      title: 'Strong prompt example',
      role: 'general',
      excerpt:
        'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead...',
      actionLabel: 'Load example',
    },
  ],
} as const;

export const scoreDimensionsContent = {
  title: 'What PeakPrompt scores',
  dimensions: [
    { key: 'scope', label: 'Scope', description: 'How bounded the task is.' },
    { key: 'contrast', label: 'Contrast', description: 'How clearly the prompt differentiates the angle or framing.' },
    { key: 'clarity', label: 'Clarity', description: 'How direct and understandable the instructions are.' },
    { key: 'constraintQuality', label: 'Constraint quality', description: 'How useful the requirements and boundaries are.' },
    { key: 'genericOutputRisk', label: 'Generic output risk', description: 'How likely the prompt is to produce bland default output.' },
    { key: 'tokenWasteRisk', label: 'Token waste risk', description: 'How likely the prompt is to cause reruns or wasted effort.' },
  ],
} as const;

export const strongPromptPromiseContent = {
  headline: 'Strong prompts stay intact',
  supporting: 'PeakPrompt validates strong prompts and only suggests rewrites when the gains are meaningful.',
} as const;

export const trustRowContent = {
  items: [
    { title: 'Score-first', body: 'One overall score with practical reasoning behind it.' },
    { title: 'Decision-oriented', body: 'Clear recommendation, not a wall of diagnostics.' },
    { title: 'Actionable', body: 'Concrete next steps when a prompt needs improvement.' },
  ],
} as const;
