import type { Mode, Role } from '@promptfire/shared';

export const roles: Role[] = ['general', 'developer', 'marketer'];
export const modes: Mode[] = ['balanced', 'tight_scope', 'high_contrast', 'low_token_cost'];

export const fixtures = {
  general:
    'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
  marketer: 'Write landing page copy for our IAM service.',
  developer: 'Write a webhook handler.',
};
