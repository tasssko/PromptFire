import type { Mode, Role } from '@promptfire/shared';

export const roles: Role[] = ['general', 'developer', 'marketer'];
export const modes: Mode[] = ['balanced', 'tight_scope', 'high_contrast', 'low_token_cost'];

export const fixtures = {
  marketer: 'Write landing page copy for our IAM service.',
  developer: 'Write a webhook handler.',
};
