import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super(DecimalEncoder, self).default(obj)

def handler(event, context):
    method = event['httpMethod']
    path = event['path']
    
    if method == 'GET' and path == '/items':
        response = table.scan()
        return {'statusCode': 200, 'body': json.dumps(response['Items'], cls=DecimalEncoder)}
    
    if method == 'POST' and path == '/items':
        body = json.loads(event['body'])
        table.put_item(Item=body)
        return {'statusCode': 201, 'body': json.dumps({'message': 'Item created'})}
    
    if method == 'GET' and path.startswith('/items/'):
        item_id = path.split('/')[-1]
        response = table.get_item(Key={'id': item_id})
        return {'statusCode': 200, 'body': json.dumps(response.get('Item', {}), cls=DecimalEncoder)}
    
    return {'statusCode': 404, 'body': json.dumps({'message': 'Not found'})}
