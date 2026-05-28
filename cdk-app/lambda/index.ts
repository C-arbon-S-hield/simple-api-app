import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path;

  try {
    if (method === 'GET' && path === '/items') {
      const result = await ddb.send(new ScanCommand({ TableName: tableName }));
      return { statusCode: 200, body: JSON.stringify(result.Items || []) };
    }

    if (method === 'POST' && path === '/items') {
      const body = JSON.parse(event.body || '{}');
      await ddb.send(new PutCommand({ TableName: tableName, Item: body }));
      return { statusCode: 201, body: JSON.stringify({ message: 'Item created' }) };
    }

    if (method === 'GET' && path.startsWith('/items/')) {
      const id = path.split('/').pop();
      const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { id } }));
      return { statusCode: 200, body: JSON.stringify(result.Item || {}) };
    }

    return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
  }
};
