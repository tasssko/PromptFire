import type {
  Analysis,
  BestNextMove,
  GuidedQuestionBlock,
  ImprovementSuggestion,
  Role,
} from '@promptfire/shared';

export type EffectiveGuidedContext = {
  role?: Role;
  missingContextType?: 'audience' | 'operating' | 'execution' | 'io' | 'comparison' | 'source' | 'boundary' | null;
};

export type GuidedSoftGuidance = {
  tightenScope?: boolean;
  reduceWordiness?: boolean;
  improveContrast?: boolean;
  reduceGenericRisk?: boolean;
  clarifyTradeOffs?: boolean;
  preserveExclusions?: boolean;
  decomposeTask?: boolean;
  suggestedStructure?: string | null;
};

export type GuidedQuestionPlan = {
  blocks: GuidedQuestionBlock[];
  questions: string[];
  topStructuralIssue: string | null;
  softGuidance: GuidedSoftGuidance;
};

type CandidateQuestion = {
  id: string;
  tier: 'structural' | 'boundary' | 'sharpening';
  priority: number;
  block: GuidedQuestionBlock;
  question: string;
  structuralIssue?: string;
};

function option(id: string, label: string, value = label, hint?: string): NonNullable<GuidedQuestionBlock['options']>[number] {
  return { id, label, value, hint };
}

function pushCandidate(list: CandidateQuestion[], next: CandidateQuestion): void {
  if (!list.some((item) => item.id === next.id)) {
    list.push(next);
  }
}

function promptHasAudience(prompt: string): boolean {
  return /\b(for|to|aimed at|target(?:ing|ed at)?|tailored for)\s+(?:an?\s+|the\s+)?(?:[a-z-]+\s+){0,6}(?:cto|ctos|developers?|engineers?|marketers?|admins?|leaders?|buyers?|decision-makers?|directors?|teams?|founders?|managers?|operators?|customers?|prospects?|audience|users?)\b/i.test(
    prompt,
  );
}

function promptHasSpecificStructure(prompt: string): boolean {
  return /\b(section|outline|format|table|bullet|bullets|checklist|memo|headings?)\b/i.test(prompt);
}

function promptHasExplicitGoal(prompt: string): boolean {
  return /\b(persuade|explain|compare|evaluate|instruct|summarize|brainstorm|decide|recommend)\b/i.test(prompt);
}

function highestImpactSuggestion(
  suggestions: ImprovementSuggestion[],
  categories: ImprovementSuggestion['category'][],
): ImprovementSuggestion | undefined {
  return suggestions.find((suggestion) => categories.includes(suggestion.category));
}

function buildGoalBlock(role: Role): GuidedQuestionBlock {
  return {
    id: 'goal',
    kind: 'radio',
    label: role === 'marketer' ? 'What job should the output do?' : 'What job should the output do?',
    required: true,
    mapsTo: 'goal',
    options: [
      option('persuade', 'Persuade', 'persuade'),
      option('explain', 'Explain', 'explain'),
      option('compare', 'Compare trade-offs', 'compare trade-offs'),
      option('instruct', 'Instruct step by step', 'instruct step by step'),
      option('summarize', 'Summarize', 'summarize'),
      option('brainstorm', 'Brainstorm options', 'brainstorm'),
    ],
  };
}

function buildAudienceBlock(role: Role): GuidedQuestionBlock {
  return {
    id: 'audience',
    kind: 'text',
    label: role === 'marketer' ? 'Who is the audience?' : 'Who is this for?',
    required: true,
    mapsTo: 'audience',
    placeholder: role === 'developer' ? 'For example: backend engineers building Stripe webhooks' : 'For example: CTOs at mid-sized SaaS companies',
  };
}

function buildFormatBlock(role: Role): GuidedQuestionBlock {
  return {
    id: 'format',
    kind: 'radio',
    label: 'What format should the output use?',
    required: true,
    mapsTo: 'format',
    options:
      role === 'developer'
        ? [
            option('implementation_plan', 'Implementation plan', 'implementation plan'),
            option('staged_checklist', 'Staged checklist', 'staged checklist'),
            option('code_with_notes', 'Code with notes', 'code with notes'),
            option('decision_memo', 'Decision memo', 'decision memo'),
          ]
        : [
            option('outline', 'Outline', 'outline'),
            option('sections', 'Sections with headings', 'sections with headings'),
            option('checklist', 'Checklist', 'checklist'),
            option('comparison', 'Comparison table', 'comparison table'),
            option('memo', 'Short memo', 'short memo'),
            option('guide', 'Guide', 'guide'),
          ],
  };
}

function buildScopeStrategyBlock(): GuidedQuestionBlock {
  return {
    id: 'scopeStrategy',
    kind: 'radio',
    label: 'How should this be scoped?',
    required: true,
    mapsTo: 'scopeStrategy',
    options: [
      option('complete_deliverable', 'One complete deliverable', 'one complete deliverable'),
      option('outline_first', 'Outline first', 'outline first'),
      option('staged_sequence', 'Staged sequence', 'staged sequence'),
      option('first_section_only', 'First section only', 'first section only'),
    ],
  };
}

function buildExcludesBlock(): GuidedQuestionBlock {
  return {
    id: 'excludes',
    kind: 'text',
    label: 'What should stay out of scope or be avoided?',
    required: true,
    mapsTo: 'excludes',
    placeholder: 'For example: skip migration strategy, broad background, or unsupported claims',
  };
}

function buildProofTypeBlock(): GuidedQuestionBlock {
  return {
    id: 'proofType',
    kind: 'radio',
    label: 'What proof or grounding should it use?',
    mapsTo: 'proofType',
    options: [
      option('examples', 'Concrete examples', 'concrete examples'),
      option('tradeoffs', 'Trade-offs', 'trade-offs'),
      option('metrics', 'Metrics or measurable evidence', 'metrics or measurable evidence'),
      option('sources', 'Source-backed claims', 'source-backed claims'),
      option('practical', 'Practical operating detail', 'practical operating detail'),
    ],
  };
}

function buildNuanceBlock(role: Role): GuidedQuestionBlock {
  return {
    id: 'nuance',
    kind: 'text',
    label: role === 'marketer' ? 'What pain point, objection, or success criterion matters most?' : 'What nuance should shape the answer?',
    mapsTo: 'detail',
    placeholder: role === 'marketer' ? 'For example: skeptical buyers worried about implementation risk' : 'For example: optimize for practical trade-offs, not completeness',
  };
}

export function buildGuidedQuestionPlan(params: {
  prompt: string;
  role: Role;
  analysis: Analysis;
  bestNextMove: BestNextMove | null;
  improvementSuggestions: ImprovementSuggestion[];
  effectiveAnalysisContext?: EffectiveGuidedContext;
}): GuidedQuestionPlan {
  const role = params.effectiveAnalysisContext?.role ?? params.role;
  const missing = params.effectiveAnalysisContext?.missingContextType ?? null;
  const issueSet = new Set(params.analysis.detectedIssueCodes);
  const suggestions = params.improvementSuggestions;
  const candidates: CandidateQuestion[] = [];

  const needsStructure =
    params.bestNextMove?.type === 'clarify_output_structure' ||
    highestImpactSuggestion(suggestions, ['structure']) !== undefined ||
    !promptHasSpecificStructure(params.prompt);
  const needsTaskDecomposition =
    params.bestNextMove?.type === 'reduce_task_load' || issueSet.has('TASK_OVERLOADED') || highestImpactSuggestion(suggestions, ['task_load']) !== undefined;
  const needsAudience =
    missing === 'audience' ||
    issueSet.has('AUDIENCE_MISSING') ||
    (role !== 'developer' && !needsTaskDecomposition && !promptHasAudience(params.prompt));
  const needsExclusion =
    params.bestNextMove?.type === 'add_exclusion' || issueSet.has('EXCLUSIONS_MISSING') || highestImpactSuggestion(suggestions, ['exclusion', 'boundary']) !== undefined;
  const needsProof =
    params.bestNextMove?.type === 'add_proof_requirement' || missing === 'source' || highestImpactSuggestion(suggestions, ['proof']) !== undefined;
  const needsGoal =
    !promptHasExplicitGoal(params.prompt) ||
    (!needsAudience && !needsStructure && !needsTaskDecomposition && params.prompt.trim().split(/\s+/).filter(Boolean).length <= 4);
  const needsNuance = missing === 'comparison' || highestImpactSuggestion(suggestions, ['framing', 'clarity']) !== undefined;

  if (needsTaskDecomposition) {
    pushCandidate(candidates, {
      id: 'scopeStrategy',
      tier: 'structural',
      priority: 100,
      structuralIssue: 'reduce_task_load',
      question: 'Should the prompt ask for one complete deliverable, an outline first, a staged sequence, or just the first section?',
      block: buildScopeStrategyBlock(),
    });
  }

  if (needsStructure) {
    pushCandidate(candidates, {
      id: 'format',
      tier: 'structural',
      priority: needsTaskDecomposition ? 88 : 96,
      structuralIssue: 'clarify_output_structure',
      question: 'What format should the output use?',
      block: buildFormatBlock(role),
    });
  }

  if (needsAudience) {
    pushCandidate(candidates, {
      id: 'audience',
      tier: 'structural',
      priority: 94,
      structuralIssue: 'audience_missing',
      question: 'Who is the exact audience?',
      block: buildAudienceBlock(role),
    });
  }

  if (needsGoal) {
    pushCandidate(candidates, {
      id: 'goal',
      tier: 'structural',
      priority: 90,
      structuralIssue: 'goal_missing',
      question: 'What job should the output do?',
      block: buildGoalBlock(role),
    });
  }

  if (needsExclusion) {
    pushCandidate(candidates, {
      id: 'excludes',
      tier: 'boundary',
      priority: 84,
      question: 'What should stay out of scope or be avoided?',
      block: buildExcludesBlock(),
    });
  }

  if (needsProof) {
    pushCandidate(candidates, {
      id: 'proofType',
      tier: needsExclusion ? 'sharpening' : 'boundary',
      priority: needsExclusion ? 72 : 83,
      question: 'What proof or grounding should it use?',
      block: buildProofTypeBlock(),
    });
  }

  if (needsNuance) {
    pushCandidate(candidates, {
      id: 'nuance',
      tier: 'sharpening',
      priority: 70,
      question: role === 'marketer' ? 'What pain point, objection, or success criterion matters most?' : 'What nuance should shape the answer?',
      block: buildNuanceBlock(role),
    });
  }

  const selected: CandidateQuestion[] = [];
  const structural = candidates.filter((candidate) => candidate.tier === 'structural').sort((a, b) => b.priority - a.priority);
  const boundary = candidates.filter((candidate) => candidate.tier === 'boundary').sort((a, b) => b.priority - a.priority);
  const sharpening = candidates.filter((candidate) => candidate.tier === 'sharpening').sort((a, b) => b.priority - a.priority);

  if (structural[0]) selected.push(structural[0]);
  if (boundary[0]) {
    selected.push(boundary[0]);
  } else if (structural[1]) {
    selected.push(structural[1]);
  }

  for (const candidate of [...structural.slice(1), ...boundary.slice(1), ...sharpening]) {
    if (selected.length >= 4) {
      break;
    }
    if (!selected.some((item) => item.id === candidate.id)) {
      selected.push(candidate);
    }
  }

  if (selected.length < 2) {
    for (const fallback of [buildGoalBlock(role), buildFormatBlock(role)]) {
      if (selected.length >= 2) {
        break;
      }
      if (!selected.some((item) => item.id === fallback.id)) {
        selected.push({
          id: fallback.id,
          tier: fallback.id === 'goal' ? 'structural' : 'boundary',
          priority: 1,
          block: fallback,
          question: fallback.label,
          structuralIssue: fallback.id === 'goal' ? 'goal_missing' : undefined,
        });
      }
    }
  }

  const topStructural = selected.find((candidate) => candidate.tier === 'structural');
  const topStructuralIssue = topStructural?.structuralIssue ?? null;

  return {
    blocks: selected.slice(0, 4).map((candidate) => candidate.block),
    questions: selected.slice(0, 4).map((candidate) => candidate.question),
    topStructuralIssue,
    softGuidance: {
      tightenScope: needsTaskDecomposition || needsStructure || issueSet.has('CONSTRAINTS_MISSING'),
      reduceWordiness: params.analysis.scores.tokenWasteRisk >= 6 || issueSet.has('GENERIC_PHRASES_DETECTED'),
      improveContrast: params.analysis.scores.contrast <= 4 || highestImpactSuggestion(suggestions, ['framing']) !== undefined,
      reduceGenericRisk: issueSet.has('GENERIC_OUTPUT_RISK_HIGH') || issueSet.has('GENERIC_PHRASES_DETECTED'),
      clarifyTradeOffs: missing === 'comparison' || highestImpactSuggestion(suggestions, ['proof', 'structure']) !== undefined,
      preserveExclusions: needsExclusion,
      decomposeTask: needsTaskDecomposition,
      suggestedStructure:
        needsTaskDecomposition
          ? 'Prefer a staged or outline-first structure over one monolithic deliverable.'
          : needsStructure
            ? 'Use an explicit output structure instead of a broad open-ended response.'
            : null,
    },
  };
}
