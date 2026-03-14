import { config } from 'dotenv-flow';
import type { SSTConfig } from 'sst';
import { PromptFireEnvironmentDnsStack } from './lib/promptfire-environment-dns-stack';
import { PromptFireEnvironmentEmailStack } from './lib/promptfire-environment-email-stack';
import { PromptFireStack } from './lib/promptfire-stack';

config({
  default_node_env: 'staging',
});

export default {
  config() {
    const environmentName = process.env.ENVIRONMENT_NAME ?? process.env.STAGING_SUBDOMAIN_LABEL ?? 'staging';
    return {
      name: `${process.env.APP_NAME ?? 'promptfire'}-${environmentName}-infra`,
      region: process.env.REGION ?? 'eu-west-2',
    };
  },
  stacks(app) {
    app.stack(PromptFireEnvironmentDnsStack);
    app.stack(PromptFireEnvironmentEmailStack);
    app.stack(PromptFireStack);
  },
} satisfies SSTConfig;
