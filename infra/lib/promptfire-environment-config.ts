export interface EnvironmentConfig {
  rootDomain: string;
  environmentName: string;
  environmentDomain: string;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const rootDomain = process.env.ROOT_DOMAIN ?? 'peakprompt.ai';
  const environmentName = process.env.ENVIRONMENT_NAME ?? process.env.STAGING_SUBDOMAIN_LABEL ?? 'staging';
  const environmentDomain = `${environmentName}.${rootDomain}`;

  return {
    rootDomain,
    environmentName,
    environmentDomain,
  };
}
