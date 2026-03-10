import type { Analysis, Mode, Preferences, PromptContext, Rewrite, Role } from '@promptfire/shared';

export interface RewriteInput {
  prompt: string;
  role: Role;
  mode: Mode;
  context?: PromptContext;
  preferences: Preferences;
  analysis?: Analysis;
}

export interface RewriteEngine {
  rewrite(input: RewriteInput): Promise<Rewrite>;
}
