# Simple API Application

API backed by DynamoDB, deployed via GitHub Actions to AWS.

## Endpoints

- `GET /items` - List all items
- `POST /items` - Create item (body: `{"id": "123", "name": "example"}`)
- `GET /items/{id}` - Get specific item

## Setup

Add AWS credentials to GitHub repository secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Local Testing

```bash
sam build
sam local start-api
```

Test endpoints:
```bash
# List items
curl http://127.0.0.1:3000/items

# Create item
curl -X POST http://127.0.0.1:3000/items -d '{"id":"1","name":"test"}'

# Get item
curl http://127.0.0.1:3000/items/1
```

## Deployment

Push to main branch triggers automatic deployment via GitHub Actions.
