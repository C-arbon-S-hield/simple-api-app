import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Determine deployment stage from CDK context or env var (defaults to 'staging').
    // This avoids hardcoding the '/prod/' SSM prefix when deploying to non-prod
    // environments such as the 'staging' GitHub Actions environment.
    const stage: string =
      (this.node.tryGetContext('stage') as string | undefined) ??
      process.env.DEPLOY_STAGE ??
      'staging';

    // Cache endpoint lookup is opt-in. The SSM parameter must exist in the
    // target account/region before enabling. To enable, pass
    // `-c cacheEnabled=true` (or set CACHE_ENABLED=true) once the parameter
    // `/<stage>/cache/redis-endpoint` has been provisioned. When disabled,
    // the Lambda receives an empty CACHE_ENDPOINT and must handle that
    // gracefully (cache layer becomes a no-op).
    const cacheEnabledCtx =
      (this.node.tryGetContext('cacheEnabled') as string | boolean | undefined) ??
      process.env.CACHE_ENABLED;
    const cacheEnabled =
      cacheEnabledCtx === true ||
      cacheEnabledCtx === 'true' ||
      cacheEnabledCtx === '1';

    const cacheEndpoint = cacheEnabled
      ? ssm.StringParameter.valueForStringParameter(
          this,
          `/${stage}/cache/redis-endpoint`
        )
      : '';

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
