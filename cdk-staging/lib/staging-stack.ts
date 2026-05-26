import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class StagingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cross-account replication role for disaster recovery
    // This role needs to be assumable by the DR account (111222333444)
    const drReplicationRole = new iam.Role(this, 'DRReplicationRole', {
      roleName: 'staging-dr-replication-role',
      assumedBy: new iam.CompositePrincipal(
        new iam.AccountPrincipal('111222333444'),
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
            RoleArn: 'arn:aws:iam::111222333444:role/dr-target-role',
            RoleSessionName: 'data-sync'
          }));
        };
      `),
      role: drReplicationRole,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
