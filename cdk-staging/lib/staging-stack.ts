import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class StagingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cross-account ECR image for the data-sync microservice
    // Image is built and pushed by the Platform team (account 887321449012)
    const ecrRepo = ecr.Repository.fromRepositoryAttributes(this, 'PlatformSyncRepo', {
      repositoryArn: 'arn:aws:ecr:us-west-2:887321449012:repository/platform/data-sync',
      repositoryName: 'platform/data-sync',
    });

    const syncFunction = new lambda.DockerImageFunction(this, 'DataSyncFunction', {
      code: lambda.DockerImageCode.fromEcr(ecrRepo, { tagOrDigest: 'v2.4.1-stable' }),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        SYNC_TARGET_REGION: 'us-east-1',
        SYNC_MODE: 'incremental',
      },
    });

    new logs.LogGroup(this, 'SyncLogs', {
      logGroupName: `/aws/lambda/${syncFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
