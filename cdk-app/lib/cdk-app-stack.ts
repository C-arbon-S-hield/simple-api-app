import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Resolve the cache endpoint. The SSM path is environment-specific, so it
    // is provided via CDK context (`-c cacheEndpointSsmParam=/staging/cache/redis-endpoint`)
    // or the `CACHE_ENDPOINT_SSM_PARAM` env var. If neither is set, we fall
    // back to a literal value from `cacheEndpoint` context / `CACHE_ENDPOINT`
    // env var, defaulting to an empty string so the stack can synthesize
    // without requiring an SSM parameter to exist in the target account.
    //
    // Previously this was hard-coded to `/prod/cache/redis-endpoint`, which
    // caused CloudFormation to fail resolving the parameter when deploying
    // to the staging account where it does not exist.
    const ssmParamName =
      (this.node.tryGetContext('cacheEndpointSsmParam') as string | undefined) ??
      process.env.CACHE_ENDPOINT_SSM_PARAM;

    const cacheEndpoint = ssmParamName
      ? ssm.StringParameter.valueForStringParameter(this, ssmParamName)
      : ((this.node.tryGetContext('cacheEndpoint') as string | undefined) ??
          process.env.CACHE_ENDPOINT ??
          '');

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
