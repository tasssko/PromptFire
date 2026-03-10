import { config } from 'dotenv-flow';
import type { SSTConfig } from 'sst';
import { PromptFireStack } from './lib/promptfire-stack';

config({
  default_node_env: 'staging',
});

export default {
  config() {
    return {
      name: `${process.env.APP_NAME ?? 'promptfire'}-infra`,
      region: process.env.REGION ?? 'eu-west-2',
    };
  },
  stacks(app) {
    app.stack(PromptFireStack);
  },
} satisfies SSTConfig;
