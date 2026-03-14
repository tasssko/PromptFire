import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ses from 'aws-cdk-lib/aws-ses';
import { StackContext, use } from 'sst/constructs';
import { PromptFireEnvironmentDnsStack } from './promptfire-environment-dns-stack';

export function PromptFireEnvironmentEmailStack({ stack }: StackContext) {
  const { rootDomain, environmentName, environmentDomain, environmentZone } = use(PromptFireEnvironmentDnsStack);

  const emailIdentity = new ses.CfnEmailIdentity(stack, 'EnvironmentSesDomainIdentity', {
    emailIdentity: environmentDomain,
    dkimAttributes: {
      signingEnabled: true,
    },
  });

  const dkimTokens = [
    {
      name: emailIdentity.attrDkimDnsTokenName1,
      value: emailIdentity.attrDkimDnsTokenValue1,
    },
    {
      name: emailIdentity.attrDkimDnsTokenName2,
      value: emailIdentity.attrDkimDnsTokenValue2,
    },
    {
      name: emailIdentity.attrDkimDnsTokenName3,
      value: emailIdentity.attrDkimDnsTokenValue3,
    },
  ];

  dkimTokens.forEach((token, index) => {
    const record = new route53.CnameRecord(stack, `EnvironmentSesDkimRecord${index + 1}`, {
      zone: environmentZone,
      recordName: token.name,
      domainName: token.value,
      ttl: Duration.minutes(30),
    });
    record.node.addDependency(emailIdentity);
  });

  new CfnOutput(stack, 'RootDomain', {
    value: rootDomain,
    description: 'Root domain for environment email identity',
  });

  new CfnOutput(stack, 'EnvironmentName', {
    value: environmentName,
    description: 'Environment subdomain label',
  });

  new CfnOutput(stack, 'EnvironmentDomain', {
    value: environmentDomain,
    description: 'SES domain identity for environment',
  });

  new CfnOutput(stack, 'EnvironmentSenderDomain', {
    value: environmentDomain,
    description: 'Domain to use for environment sender addresses',
  });

  new CfnOutput(stack, 'SuggestedFromLogin', {
    value: `login@${environmentDomain}`,
    description: 'Suggested environment auth sender address',
  });

  new CfnOutput(stack, 'SuggestedFromNoReply', {
    value: `no-reply@${environmentDomain}`,
    description: 'Suggested environment no-reply sender address',
  });
}
