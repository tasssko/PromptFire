import type {
  Analysis,
  ImprovementSuggestion,
  Mode,
  Preferences,
  PromptContext,
  Rewrite,
  Role,
} from '@promptfire/shared';
import type { LadderEvaluation, PatternFit, RewriteLadderState } from '@promptfire/heuristics';

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

export interface InternalLadderTrace {
  current: RewriteLadderState['current'];
  next: RewriteLadderState['next'];
  target: RewriteLadderState['target'];
  maxSafeTarget: RewriteLadderState['maxSafeTarget'];
  stopReason: RewriteLadderState['stopReason'];
  pattern: PatternFit['primary'] | null;
  claimedStep: LadderEvaluation['claimedStep'] | null;
  ladderAccepted: boolean | null;
  ladderReason: LadderEvaluation['reason'] | null;
}

export interface RewriteEngine {
  rewrite(input: RewriteInput): Promise<Rewrite>;
}
