import type {
  Analysis,
  ImprovementSuggestion,
  Mode,
  Preferences,
  PromptContext,
  Rewrite,
  Role,
} from '@promptfire/shared';
import type { PatternFit } from '@promptfire/heuristics';

export interface RewriteInput {
  prompt: string;
  role: Role;
  mode: Mode;
  context?: PromptContext;
  preferences: Preferences;
  analysis?: Analysis;
  improvementSuggestions?: ImprovementSuggestion[];
  patternFit?: PatternFit;
}

export interface RewriteEngine {
  rewrite(input: RewriteInput): Promise<Rewrite>;
}
