import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface CdkAppStackProps extends cdk.StackProps {
  /**
   * Deployment stage name (e.g. 'staging', 'prod'). Used to namespace
   * environment-specific SSM parameters such as the cache endpoint.
   * If not provided, falls back to the `stage` CDK context value, then 'prod'.
   */
  readonly stageName?: string;
}

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CdkAppStackProps) {
    super(scope, id, props);

    // Resolve the deployment stage. Precedence: explicit prop > CDK context (`-c stage=...`) > 'prod'.
    const stageName: string =
      props?.stageName ?? (this.node.tryGetContext('stage') as string | undefined) ?? 'prod';

    // Fetch cache endpoint from SSM, namespaced by stage so non-prod accounts
    // are not forced to read `/prod/...` parameters that don't exist there.
    const cacheEndpoint = ssm.StringParameter.valueForStringParameter(
      this, `/${stageName}/cache/redis-endpoint`
    );

    // DynamoDB Table
    const table = new dynamodb.Table(this, 'ItemsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function (using AssetCode for pre-bundled code)
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda-dist'),
      environment: {
        TABLE_NAME: table.tableName,
        CACHE_ENDPOINT: cacheEndpoint,
      },
    });

    // Grant Lambda permissions to DynamoDB
    table.grantReadWriteData(apiFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'ItemsApi', {
      restApiName: 'Items Service',
      deployOptions: {
        stageName: 'prod',
      },
    });

    const items = api.root.addResource('items');
    const item = items.addResource('{id}');

    const integration = new apigateway.LambdaIntegration(apiFunction);

    items.addMethod('GET', integration);
    items.addMethod('POST', integration);
    item.addMethod('GET', integration);

    // Output
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });
  }
}
