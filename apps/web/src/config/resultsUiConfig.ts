import type { ImprovementStatus, Role } from '@promptfire/shared';

export type ProductState = 'strong' | 'usable' | 'weak';

export type ResultVerdictId =
  | 'strong_default'
  | 'strong_suppressed'
  | 'strong_forced'
  | 'usable_default'
  | 'usable_with_rewrite'
  | 'weak_default'
  | 'weak_without_rewrite'
  | 'rewrite_material_improvement'
  | 'rewrite_possible_regression'
  | 'rewrite_already_strong';

export type ResultFindingId =
  | 'clear_scope'
  | 'strong_contrast'
  | 'clear_instruction'
  | 'useful_constraints'
  | 'low_generic_risk'
  | 'low_token_risk'
  | 'constraints_missing'
  | 'audience_missing'
  | 'exclusions_missing'
  | 'task_overloaded'
  | 'generic_phrases_detected'
  | 'high_generic_risk'
  | 'rewrite_low_value'
  | 'rewrite_forced_by_user'
  | 'rewrite_suppressed_by_user'
  | 'rewrite_possible_regression'
  | 'already_strong_before_rewrite';

export type ResultActionId =
  | 'copy_original_prompt'
  | 'copy_rewritten_prompt'
  | 'copy_template'
  | 'copy_example'
  | 'copy_questions'
  | 'show_rewrite_anyway'
  | 'hide_rewrite_anyway'
  | 'generate_rewrite_anyway'
  | 'copy_rewrite_anyway';

export type ResultSectionId =
  | 'findings'
  | 'subscores'
  | 'why_no_rewrite'
  | 'best_next_move'
  | 'rewrite_panel'
  | 'technical_details';

type RoleVariant<T extends object> = {
  default: T;
} & Partial<Record<Role, Partial<T>>>;

export type HeroCopy = {
  headline: string;
  supporting: string;
};

export type NoRewriteCopy = {
  title: string;
  label: string;
  supporting: string;
};

export type GuidedCompletionCopy = {
  title: string;
  fallbackDetailTitle: string;
  fallbackSummary: string;
  templateLabel: string;
  exampleLabel: string;
  rewritePreviewTitle: string;
};

export type RewriteVerdictCopy = {
  label: string;
  recommendation: string;
};

export type StateConfig = {
  bestNextMoveTitle: RoleVariant<{ title: string }>;
  rewritePanelTitle: RoleVariant<{ title: string }>;
};

export type VerdictConfig = {
  state: ProductState;
  visibleSections: ResultSectionId[];
  hero: RoleVariant<HeroCopy>;
  primaryAction: ResultActionId;
  secondaryAction?: ResultActionId;
  noRewrite?: RoleVariant<NoRewriteCopy>;
  guidedCompletion?: RoleVariant<GuidedCompletionCopy>;
};

export type FindingConfig = {
  text: RoleVariant<{ value: string }>;
};

export type ActionConfig = {
  text: RoleVariant<{ label: string }>;
};

export type SectionConfig = {
  title: RoleVariant<{ value: string }>;
};

export type ResultsUiConfig = {
  states: Record<ProductState, StateConfig>;
  verdicts: Record<ResultVerdictId, VerdictConfig>;
  findings: Record<ResultFindingId, FindingConfig>;
  actions: Record<ResultActionId, ActionConfig>;
  sections: Record<ResultSectionId, SectionConfig>;
  rewriteVerdicts: Record<ImprovementStatus, RoleVariant<RewriteVerdictCopy>>;
};

export function resolveRoleVariant<T extends object>(value: RoleVariant<T>, role: Role): T {
  return {
    ...value.default,
    ...(value[role] ?? {}),
  };
}

export const resultsUiConfig: ResultsUiConfig = {
  states: {
    strong: {
      bestNextMoveTitle: {
        default: { title: 'Optional next move' },
        developer: { title: 'Optional implementation hardening' },
      },
      rewritePanelTitle: {
        default: { title: 'Optional rewrite' },
      },
    },
    usable: {
      bestNextMoveTitle: {
        default: { title: 'Best next move' },
        developer: { title: 'Best implementation upgrade' },
      },
      rewritePanelTitle: {
        default: { title: 'Suggested rewrite' },
      },
    },
    weak: {
      bestNextMoveTitle: {
        default: { title: 'Best next move' },
        developer: { title: 'Best structural fix' },
      },
      rewritePanelTitle: {
        default: { title: 'Recommended rewrite' },
      },
    },
  },
  verdicts: {
    strong_default: {
      state: 'strong',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'why_no_rewrite', 'technical_details'],
      hero: {
        default: {
          headline: 'Strong prompt',
          supporting: 'This prompt is already well scoped and ready to use as-is.',
        },
      },
      primaryAction: 'copy_original_prompt',
      secondaryAction: 'generate_rewrite_anyway',
      noRewrite: {
        default: {
          title: 'No rewrite needed',
          label: 'The current prompt is already strong',
          supporting: 'The expected gain from rewriting is low, so the original prompt remains the best default.',
        },
      },
    },
    strong_suppressed: {
      state: 'strong',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'why_no_rewrite', 'technical_details'],
      hero: {
        default: {
          headline: 'Strong prompt',
          supporting: 'This prompt is already well scoped and does not need a rewrite to perform well.',
        },
      },
      primaryAction: 'copy_original_prompt',
      secondaryAction: 'generate_rewrite_anyway',
      noRewrite: {
        default: {
          title: 'No rewrite needed',
          label: 'Rewrite suppressed by preference',
          supporting: 'You asked to suppress rewrites, and the current prompt is already in good shape.',
        },
      },
    },
    strong_forced: {
      state: 'strong',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'why_no_rewrite', 'technical_details'],
      hero: {
        default: {
          headline: 'Strong prompt, forced rewrite available',
          supporting: 'The original prompt is already strong. The rewrite is optional and mainly useful for comparison.',
        },
      },
      primaryAction: 'copy_original_prompt',
      secondaryAction: 'show_rewrite_anyway',
      noRewrite: {
        default: {
          title: 'No rewrite needed',
          label: 'The current prompt is already strong',
          supporting: 'A rewrite was generated because you forced it, but the original prompt remains the best default.',
        },
      },
    },
    usable_default: {
      state: 'usable',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'rewrite_panel', 'technical_details'],
      hero: {
        default: {
          headline: 'Usable, with one clear upgrade',
          supporting: 'The prompt works now, but one focused change would make the result more reliable.',
        },
      },
      primaryAction: 'copy_template',
      secondaryAction: 'generate_rewrite_anyway',
      guidedCompletion: {
        default: {
          title: 'Guided completion',
          fallbackDetailTitle: 'Complete the missing details first',
          fallbackSummary: 'Tighten the missing boundaries before spending time on a rewrite.',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackDetailTitle: 'Complete the implementation contract first',
          fallbackSummary: 'Define runtime, I/O shape, validation, and failure behavior before spending time on a rewrite.',
        },
      },
    },
    usable_with_rewrite: {
      state: 'usable',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'rewrite_panel', 'technical_details'],
      hero: {
        default: {
          headline: 'Usable, with a stronger rewrite available',
          supporting: 'The prompt is workable now, but the rewrite or guided next step can make it more reliable.',
        },
      },
      primaryAction: 'copy_template',
      secondaryAction: 'show_rewrite_anyway',
      guidedCompletion: {
        default: {
          title: 'Guided completion',
          fallbackDetailTitle: 'Complete the missing details first',
          fallbackSummary: 'Start with the missing structure, then compare the rewrite only if it still helps.',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackDetailTitle: 'Complete the implementation contract first',
          fallbackSummary: 'Lock down runtime, input, validation, and failure handling before switching to the rewrite.',
        },
      },
    },
    weak_default: {
      state: 'weak',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'rewrite_panel', 'technical_details'],
      hero: {
        default: {
          headline: 'This prompt needs tighter boundaries',
          supporting: 'Define the missing constraints first, then decide whether a rewrite is worth using.',
        },
        developer: {
          supporting: 'Define runtime, payload, validation, and failure boundaries first, then decide whether a rewrite is worth using.',
        },
      },
      primaryAction: 'copy_template',
      secondaryAction: 'show_rewrite_anyway',
      guidedCompletion: {
        default: {
          title: 'Guided completion',
          fallbackDetailTitle: 'Complete the missing details first',
          fallbackSummary: 'Tighten the missing boundaries before spending time on a rewrite.',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackDetailTitle: 'Complete the implementation contract first',
          fallbackSummary: 'Add runtime, input, validation, success, and failure boundaries before relying on a rewrite.',
        },
      },
    },
    weak_without_rewrite: {
      state: 'weak',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'rewrite_panel', 'technical_details'],
      hero: {
        default: {
          headline: 'Prompt is too open-ended',
          supporting: 'The prompt needs stronger constraints before a rewrite can add much value.',
        },
        developer: {
          supporting: 'The prompt needs explicit runtime, payload, validation, and failure constraints before a rewrite can add much value.',
        },
      },
      primaryAction: 'copy_template',
      secondaryAction: 'generate_rewrite_anyway',
      guidedCompletion: {
        default: {
          title: 'Guided completion',
          fallbackDetailTitle: 'Complete the missing details first',
          fallbackSummary: 'Tighten the missing boundaries before spending time on a rewrite.',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackDetailTitle: 'Complete the implementation contract first',
          fallbackSummary: 'Add runtime, input, validation, success, and failure boundaries before relying on a rewrite.',
        },
      },
    },
    rewrite_material_improvement: {
      state: 'weak',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'rewrite_panel', 'technical_details'],
      hero: {
        default: {
          headline: 'The rewrite gives you a clearer prompt',
          supporting: 'The rewrite materially improves the structure, so it is the fastest path forward.',
        },
      },
      primaryAction: 'copy_rewritten_prompt',
    },
    rewrite_possible_regression: {
      state: 'usable',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'rewrite_panel', 'technical_details'],
      hero: {
        default: {
          headline: 'Keep the original, use the guidance',
          supporting: 'The rewrite may be weaker than the original, so the safer next move is to tighten the prompt manually.',
        },
      },
      primaryAction: 'copy_template',
      secondaryAction: 'show_rewrite_anyway',
      guidedCompletion: {
        default: {
          title: 'Guided completion',
          fallbackDetailTitle: 'Apply the structural fix manually',
          fallbackSummary: 'Use the guided next step first. The rewrite looks weaker than the original prompt.',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
      },
    },
    rewrite_already_strong: {
      state: 'strong',
      visibleSections: ['subscores', 'findings', 'best_next_move', 'why_no_rewrite', 'technical_details'],
      hero: {
        default: {
          headline: 'The original prompt was already strong',
          supporting: 'A rewrite exists, but the original prompt remains the better default.',
        },
      },
      primaryAction: 'copy_original_prompt',
      secondaryAction: 'show_rewrite_anyway',
      noRewrite: {
        default: {
          title: 'No rewrite needed',
          label: 'The original prompt was already strong',
          supporting: 'The rewrite does not improve enough to justify switching away from the original prompt.',
        },
      },
    },
  },
  findings: {
    clear_scope: { text: { default: { value: 'Clear scope and deliverable.' } } },
    strong_contrast: { text: { default: { value: 'Good trade-off framing and contrast.' } } },
    clear_instruction: { text: { default: { value: 'Instructions are clear and direct.' } } },
    useful_constraints: { text: { default: { value: 'Useful constraints improve precision.' } } },
    low_generic_risk: { text: { default: { value: 'Low generic-output risk.' } } },
    low_token_risk: { text: { default: { value: 'Low token-waste risk.' } } },
    constraints_missing: {
      text: {
        default: { value: 'Key constraints are missing.' },
        developer: { value: 'Runtime, input, validation, or failure constraints are missing.' },
      },
    },
    audience_missing: { text: { default: { value: 'The prompt does not name the audience clearly.' } } },
    exclusions_missing: { text: { default: { value: 'The prompt does not say what should stay out of scope.' } } },
    task_overloaded: { text: { default: { value: 'The request is trying to do too many jobs at once.' } } },
    generic_phrases_detected: { text: { default: { value: 'Generic phrasing is weakening the result shape.' } } },
    high_generic_risk: { text: { default: { value: 'The current wording is likely to produce generic output.' } } },
    rewrite_low_value: { text: { default: { value: 'A rewrite is available, but the expected gain is low.' } } },
    rewrite_forced_by_user: { text: { default: { value: 'A rewrite was generated because you explicitly forced it.' } } },
    rewrite_suppressed_by_user: { text: { default: { value: 'Rewrite generation was suppressed by your preference.' } } },
    rewrite_possible_regression: { text: { default: { value: 'The rewrite may be weaker than the original prompt.' } } },
    already_strong_before_rewrite: { text: { default: { value: 'The original prompt was already strong before rewriting.' } } },
  },
  actions: {
    copy_original_prompt: { text: { default: { label: 'Copy original prompt' } } },
    copy_rewritten_prompt: { text: { default: { label: 'Copy rewritten prompt' } } },
    copy_template: { text: { default: { label: 'Copy template' } } },
    copy_example: { text: { default: { label: 'Copy example' } } },
    copy_questions: { text: { default: { label: 'Copy questions' } } },
    show_rewrite_anyway: { text: { default: { label: 'Show rewrite anyway' } } },
    hide_rewrite_anyway: { text: { default: { label: 'Hide rewrite anyway' } } },
    generate_rewrite_anyway: { text: { default: { label: 'Generate rewrite anyway' } } },
    copy_rewrite_anyway: { text: { default: { label: 'Copy rewrite anyway' } } },
  },
  sections: {
    findings: { title: { default: { value: 'Key findings' } } },
    subscores: { title: { default: { value: 'Score breakdown' } } },
    why_no_rewrite: { title: { default: { value: 'No rewrite needed' } } },
    best_next_move: { title: { default: { value: 'Best next move' } } },
    rewrite_panel: { title: { default: { value: 'Recommended rewrite' } } },
    technical_details: { title: { default: { value: 'Technical details' } } },
  },
  rewriteVerdicts: {
    material_improvement: {
      default: {
        label: 'Clearly better',
        recommendation: 'Use the rewritten prompt.',
      },
    },
    minor_improvement: {
      default: {
        label: 'Slightly better',
        recommendation: 'The rewrite helps a bit, but the original still works.',
      },
    },
    no_significant_change: {
      default: {
        label: 'No significant change',
        recommendation: 'The rewrite does not add enough value to switch.',
      },
    },
    possible_regression: {
      default: {
        label: 'Possible regression',
        recommendation: 'Keep the original and apply the next step manually.',
      },
    },
    already_strong: {
      default: {
        label: 'Already strong',
        recommendation: 'The original prompt was already in good shape.',
      },
    },
  },
};
