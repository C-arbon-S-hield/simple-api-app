import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

// Known placeholder/dummy AWS account IDs that must never be used as a real
// principal. IAM rejects these with "Invalid principal in policy" because they
// do not correspond to real accounts. Guarding against them here ensures a
// regression where the placeholder slips back into config fails fast at synth
// time rather than at CloudFormation create time.
const PLACEHOLDER_ACCOUNT_IDS = new Set<string>([
  '111222333444',
  '123456789012',
  '000000000000',
]);

function resolveDrSourceAccountId(stack: cdk.Stack): string {
  // Order of resolution:
  //   1. Env var DR_SOURCE_ACCOUNT_ID (set in CI / locally)
  //   2. CDK context value 'drSourceAccountId' (cdk.json / -c flag)
  //   3. Fall back to the stack's own account (single-account deploy)
  const fromEnv = process.env.DR_SOURCE_ACCOUNT_ID;
  const fromContext = stack.node.tryGetContext('drSourceAccountId') as
    | string
    | undefined;
  const resolved = (fromEnv || fromContext || stack.account || '').trim();

  if (!resolved || cdk.Token.isUnresolved(resolved)) {
    throw new Error(
      'DR source account ID could not be resolved. Set the ' +
        'DR_SOURCE_ACCOUNT_ID environment variable or the ' +
        "'drSourceAccountId' CDK context value.",
    );
  }
  if (!/^\d{12}$/.test(resolved)) {
    throw new Error(
      `DR source account ID '${resolved}' is not a valid 12-digit AWS ` +
        'account number.',
    );
  }
  if (PLACEHOLDER_ACCOUNT_IDS.has(resolved)) {
    throw new Error(
      `DR source account ID '${resolved}' is a known placeholder value. ` +
        'Set DR_SOURCE_ACCOUNT_ID (or the drSourceAccountId CDK context ' +
        'value) to the real DR partner/source account ID.',
    );
  }
  return resolved;
}

export class StagingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cross-account replication role for disaster recovery.
    // The DR source account ID must be supplied at synth time via the
    // DR_SOURCE_ACCOUNT_ID env var or the 'drSourceAccountId' CDK context
    // value. It must NOT be hard-coded to a placeholder like 111222333444 -
    // IAM rejects placeholder accounts with "Invalid principal in policy".
    const drSourceAccountId = resolveDrSourceAccountId(this);

    const drReplicationRole = new iam.Role(this, 'DRReplicationRole', {
      roleName: 'staging-dr-replication-role',
      assumedBy: new iam.CompositePrincipal(
        new iam.AccountPrincipal(drSourceAccountId),
        new iam.ServicePrincipal('lambda.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    // Lambda that performs cross-account data sync. The target role lives in
    // the DR source account, so its ARN is built from the resolved account ID
    // rather than a hard-coded placeholder.
    const drTargetRoleArn = `arn:aws:iam::${drSourceAccountId}:role/dr-target-role`;
    new lambda.Function(this, 'DataSyncFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
        const TARGET_ROLE_ARN = ${JSON.stringify(drTargetRoleArn)};
        exports.handler = async () => {
          const sts = new STSClient({ region: 'us-west-2' });
          await sts.send(new AssumeRoleCommand({
            RoleArn: TARGET_ROLE_ARN,
            RoleSessionName: 'data-sync'
          }));
        };
      `),
      role: drReplicationRole,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
