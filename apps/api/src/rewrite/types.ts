import type {
  Analysis,
  ImprovementSuggestion,
  Mode,
  Preferences,
  PromptContext,
  Rewrite,
  Role,
} from '@promptfire/shared';
import type { PatternFit, RewriteLadderState } from '@promptfire/heuristics';

export interface RewriteInput {
  prompt: string;
  role: Role;
  mode: Mode;
  context?: PromptContext;
  preferences: Preferences;
  analysis?: Analysis;
  improvementSuggestions?: ImprovementSuggestion[];
  patternFit?: PatternFit;
  ladder?: RewriteLadderState;
}

export interface RewriteEngine {
  rewrite(input: RewriteInput): Promise<Rewrite>;
}
