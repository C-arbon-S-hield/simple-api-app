import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
