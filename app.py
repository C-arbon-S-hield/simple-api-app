import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')
table = dynamodb.Table(os.environ['TABLE_NAME'])
AUDIT_TOPIC_ARN = os.environ['AUDIT_TOPIC_ARN']

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super(DecimalEncoder, self).default(obj)

def publish_audit(action, item_id, user):
    sns.publish(
        TopicArn=AUDIT_TOPIC_ARN,
        Subject=f'Item {action}',
        Message=json.dumps({'action': action, 'item_id': item_id, 'user': user}),
    )

def handler(event, context):
    method = event['httpMethod']
    path = event['path']
    user = event['headers'].get('X-User-Id', 'anonymous')

    if method == 'GET' and path == '/items':
        response = table.scan()
        return {'statusCode': 200, 'body': json.dumps(response['Items'], cls=DecimalEncoder)}

    if method == 'POST' and path == '/items':
        body = json.loads(event['body'])
        table.put_item(Item=body)
        publish_audit('created', body['id'], user)
        return {'statusCode': 201, 'body': json.dumps({'message': 'Item created'})}

    if method == 'GET' and path.startswith('/items/'):
        item_id = path.split('/')[-1]
        response = table.get_item(Key={'id': item_id})
        return {'statusCode': 200, 'body': json.dumps(response.get('Item', {}), cls=DecimalEncoder)}

    if method == 'DELETE' and path.startswith('/items/'):
        item_id = path.split('/')[-1]
        table.delete_item(Key={'id': item_id})
        publish_audit('deleted', item_id, user)
        return {'statusCode': 200, 'body': json.dumps({'message': 'Item deleted'})}

    return {'statusCode': 404, 'body': json.dumps({'message': 'Not found'})}
