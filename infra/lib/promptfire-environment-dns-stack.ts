import { CfnOutput, Duration, Fn } from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { StackContext } from 'sst/constructs';
import { getEnvironmentConfig } from './promptfire-environment-config';

function resolveRootZone(stack: StackContext['stack'], rootDomain: string): route53.IHostedZone {
  const rootHostedZoneId = process.env.ROOT_HOSTED_ZONE_ID;
  const shouldCreateRootZone = (process.env.CREATE_ROOT_HOSTED_ZONE ?? 'false').toLowerCase() === 'true';

  if (rootHostedZoneId) {
    return route53.HostedZone.fromHostedZoneAttributes(stack, 'RootHostedZoneImported', {
      hostedZoneId: rootHostedZoneId,
      zoneName: rootDomain,
    });
  }

  if (shouldCreateRootZone) {
    return new route53.PublicHostedZone(stack, 'RootHostedZone', {
      zoneName: rootDomain,
    });
  }

  return route53.HostedZone.fromLookup(stack, 'RootHostedZoneLookup', {
    domainName: rootDomain,
  });
}

export interface PromptFireEnvironmentDnsStackOutputs {
  rootDomain: string;
  environmentName: string;
  environmentDomain: string;
  environmentZone: route53.IHostedZone;
}

export function PromptFireEnvironmentDnsStack({ stack }: StackContext): PromptFireEnvironmentDnsStackOutputs {
  const { rootDomain, environmentName, environmentDomain } = getEnvironmentConfig();
  const rootZone = resolveRootZone(stack, rootDomain);

  const environmentZone = new route53.PublicHostedZone(stack, 'EnvironmentHostedZone', {
    zoneName: environmentDomain,
    comment: `Delegated ${environmentName} DNS zone`,
  });

  if (!environmentZone.hostedZoneNameServers) {
    throw new Error('Environment hosted zone name servers are not available for NS delegation.');
  }

  new route53.NsRecord(stack, 'EnvironmentNsDelegation', {
    zone: rootZone,
    recordName: environmentDomain,
    values: environmentZone.hostedZoneNameServers,
    ttl: Duration.minutes(30),
  });

  new CfnOutput(stack, 'RootDomain', {
    value: rootDomain,
    description: 'Root domain used for delegation',
  });

  new CfnOutput(stack, 'RootHostedZoneId', {
    value: rootZone.hostedZoneId,
    description: 'Root hosted zone ID (imported/created/looked up)',
  });

  new CfnOutput(stack, 'EnvironmentName', {
    value: environmentName,
    description: 'Environment subdomain label',
  });

  new CfnOutput(stack, 'EnvironmentDomain', {
    value: environmentDomain,
    description: 'Environment delegated domain',
  });

  new CfnOutput(stack, 'EnvironmentHostedZoneId', {
    value: environmentZone.hostedZoneId,
    description: 'Environment hosted zone ID',
  });

  new CfnOutput(stack, 'EnvironmentHostedZoneNameServers', {
    value: Fn.join(',', environmentZone.hostedZoneNameServers),
    description: 'Environment hosted zone name servers',
  });

  return {
    rootDomain,
    environmentName,
    environmentDomain,
    environmentZone,
  };
}
