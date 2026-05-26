import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class StagingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cross-account replication role for disaster recovery
    // The DR account ID is supplied at deploy time via CDK context variable
    // 'drAccountId' (e.g. --context drAccountId=123456789012).
    const drAccountId = this.node.tryGetContext('drAccountId') as string;
    if (!drAccountId || !/^\d{12}$/.test(drAccountId)) {
      throw new Error(
        'CDK context variable "drAccountId" is required and must be a valid 12-digit AWS account ID. ' +
        'Pass it with: --context drAccountId=<account-id>',
      );
    }

    const drReplicationRole = new iam.Role(this, 'DRReplicationRole', {
      roleName: 'staging-dr-replication-role',
      assumedBy: new iam.CompositePrincipal(
        new iam.AccountPrincipal(drAccountId),
        new iam.ServicePrincipal('lambda.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    // Lambda that performs cross-account data sync
    const syncFunction = new lambda.Function(this, 'DataSyncFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
        exports.handler = async () => {
          const sts = new STSClient({ region: 'us-west-2' });
          await sts.send(new AssumeRoleCommand({
            RoleArn: 'arn:aws:iam::${drAccountId}:role/dr-target-role',
            RoleSessionName: 'data-sync'
          }));
        };
      `),
      role: drReplicationRole,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
