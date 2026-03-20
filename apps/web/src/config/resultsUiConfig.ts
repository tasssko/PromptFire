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
  | 'action_card'
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
  fallbackLead: string;
  fallbackSummary: string;
  questionTitle: string;
  templateLabel: string;
  exampleLabel: string;
  rewritePreviewTitle: string;
};

export type RewriteVerdictCopy = {
  label: string;
  recommendation: string;
};

export type StateConfig = {
  actionCardTitle: RoleVariant<{ title: string }>;
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
      actionCardTitle: {
        default: { title: 'Optional next move' },
        developer: { title: 'Optional implementation hardening' },
      },
      rewritePanelTitle: {
        default: { title: 'Optional rewrite' },
      },
    },
    usable: {
      actionCardTitle: {
        default: { title: 'Best next move' },
        developer: { title: 'Best implementation upgrade' },
      },
      rewritePanelTitle: {
        default: { title: 'Suggested rewrite' },
      },
    },
    weak: {
      actionCardTitle: {
        default: { title: 'Best structural fix' },
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
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
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
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
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
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
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
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
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
          title: 'Best next move',
          fallbackLead: 'Complete the missing details first',
          fallbackSummary: 'Tighten the missing boundaries before spending time on a rewrite.',
          questionTitle: 'Ask first',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackLead: 'Complete the implementation contract first',
          fallbackSummary: 'Define runtime, I/O shape, validation, and failure behavior before spending time on a rewrite.',
          questionTitle: 'Lock down first',
        },
      },
    },
    usable_with_rewrite: {
      state: 'usable',
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
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
          title: 'Best next move',
          fallbackLead: 'Complete the missing details first',
          fallbackSummary: 'Start with the missing structure, then compare the rewrite only if it still helps.',
          questionTitle: 'Ask first',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackLead: 'Complete the implementation contract first',
          fallbackSummary: 'Lock down runtime, input, validation, and failure handling before switching to the rewrite.',
          questionTitle: 'Lock down first',
        },
      },
    },
    weak_default: {
      state: 'weak',
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
      hero: {
        default: {
          headline: 'Prompt is too open-ended',
          supporting: 'The prompt needs stronger boundaries before a rewrite can add much value.',
        },
        developer: {
          supporting: 'The prompt needs stronger boundaries before a rewrite can add much value.',
        },
      },
      primaryAction: 'copy_template',
      secondaryAction: 'show_rewrite_anyway',
      guidedCompletion: {
        default: {
          title: 'Best structural fix',
          fallbackLead: 'Complete the missing details first',
          fallbackSummary: 'Tighten the missing boundaries before spending time on a rewrite.',
          questionTitle: 'Ask first',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackLead: 'Complete the implementation contract first',
          fallbackSummary: 'Add runtime, input, validation, success, and failure boundaries before relying on a rewrite.',
          questionTitle: 'Lock down first',
        },
      },
    },
    weak_without_rewrite: {
      state: 'weak',
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
      hero: {
        default: {
          headline: 'Prompt is too open-ended',
          supporting: 'The prompt needs stronger boundaries before a rewrite can add much value.',
        },
        developer: {
          supporting: 'The prompt needs stronger boundaries before a rewrite can add much value.',
        },
      },
      primaryAction: 'copy_template',
      secondaryAction: 'generate_rewrite_anyway',
      guidedCompletion: {
        default: {
          title: 'Best structural fix',
          fallbackLead: 'Complete the missing details first',
          fallbackSummary: 'Tighten the missing boundaries before spending time on a rewrite.',
          questionTitle: 'Ask first',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
        developer: {
          fallbackLead: 'Complete the implementation contract first',
          fallbackSummary: 'Add runtime, input, validation, success, and failure boundaries before relying on a rewrite.',
          questionTitle: 'Lock down first',
        },
      },
    },
    rewrite_material_improvement: {
      state: 'weak',
      visibleSections: ['subscores', 'findings', 'action_card', 'rewrite_panel', 'technical_details'],
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
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
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
          title: 'Best next move',
          fallbackLead: 'Apply the structural fix manually',
          fallbackSummary: 'Use the guided next step first. The rewrite looks weaker than the original prompt.',
          questionTitle: 'Ask first',
          templateLabel: 'Template',
          exampleLabel: 'Example',
          rewritePreviewTitle: 'Rewrite preview',
        },
      },
    },
    rewrite_already_strong: {
      state: 'strong',
      visibleSections: ['subscores', 'findings', 'action_card', 'technical_details'],
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
    clear_scope: { text: { default: { value: 'Clear scope' } } },
    strong_contrast: { text: { default: { value: 'Good contrast' } } },
    clear_instruction: { text: { default: { value: 'Clear wording' } } },
    useful_constraints: { text: { default: { value: 'Useful constraints' } } },
    low_generic_risk: { text: { default: { value: 'Low generic risk' } } },
    low_token_risk: { text: { default: { value: 'Low wordiness' } } },
    constraints_missing: {
      text: {
        default: { value: 'Missing constraints' },
        developer: { value: 'Missing runtime or I/O constraints' },
      },
    },
    audience_missing: { text: { default: { value: 'Audience is unclear' } } },
    exclusions_missing: { text: { default: { value: 'Missing exclusions' } } },
    task_overloaded: { text: { default: { value: 'Too many jobs at once' } } },
    generic_phrases_detected: { text: { default: { value: 'Generic phrasing' } } },
    high_generic_risk: { text: { default: { value: 'Likely generic output' } } },
    rewrite_low_value: { text: { default: { value: 'Rewrite gain looks low' } } },
    rewrite_forced_by_user: { text: { default: { value: 'Rewrite was forced' } } },
    rewrite_suppressed_by_user: { text: { default: { value: 'Rewrite was suppressed' } } },
    rewrite_possible_regression: { text: { default: { value: 'Rewrite may be weaker' } } },
    already_strong_before_rewrite: { text: { default: { value: 'Original was already strong' } } },
  },
  actions: {
    copy_original_prompt: { text: { default: { label: 'Copy original prompt' } } },
    copy_rewritten_prompt: { text: { default: { label: 'Copy rewritten prompt' } } },
    copy_template: { text: { default: { label: 'Copy template' } } },
    copy_example: { text: { default: { label: 'Copy example' } } },
    copy_questions: { text: { default: { label: 'Copy questions' } } },
    show_rewrite_anyway: { text: { default: { label: 'Show rewrite anyway' } } },
    hide_rewrite_anyway: { text: { default: { label: 'Hide rewrite anyway' } } },
    generate_rewrite_anyway: { text: { default: { label: 'Rewrite anyway' } } },
    copy_rewrite_anyway: { text: { default: { label: 'Copy rewrite anyway' } } },
  },
  sections: {
    findings: { title: { default: { value: 'Main issues' } } },
    subscores: { title: { default: { value: 'Score breakdown' } } },
    action_card: { title: { default: { value: 'Best structural fix' } } },
    rewrite_panel: { title: { default: { value: 'Recommended rewrite' } } },
    technical_details: { title: { default: { value: 'Show full analysis' } } },
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
