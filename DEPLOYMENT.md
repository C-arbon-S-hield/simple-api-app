# Deployment Instructions

## Application Overview
- Simple REST API with DynamoDB backend
- Deployed using AWS SAM and CloudFormation
- GitHub Actions for CI/CD

## To Deploy:

### Option 1: Using GitHub Secrets (Recommended for external AWS accounts)
1. Get AWS credentials for your account
2. Add to GitHub repository secrets:
   - Go to: https://github.com/deveshmulmule/simple-api-app/settings/secrets/actions
   - Add `AWS_ACCESS_KEY_ID`
   - Add `AWS_SECRET_ACCESS_KEY`
3. Trigger workflow manually or push to main branch

### Option 2: Using ada credentials locally
```bash
# Get valid ada credentials for your AWS account
ada credentials update --account=YOUR_ACCOUNT_ID --provider=conduit --role=YOUR_ROLE --once

# Deploy using SAM
cd ~/simple-api-app
sam build
sam deploy --guided
```

## Testing the API

Once deployed, you'll get an API URL. Test with:

```bash
# Replace API_URL with your actual endpoint
API_URL="https://xxxxx.execute-api.us-west-2.amazonaws.com/Prod"

# List items (empty initially)
curl $API_URL/items

# Create an item
curl -X POST $API_URL/items \
  -H "Content-Type: application/json" \
  -d '{"id":"1","name":"test item","description":"my first item"}'

# Get specific item
curl $API_URL/items/1

# Create another item
curl -X POST $API_URL/items \
  -H "Content-Type: application/json" \
  -d '{"id":"2","name":"second item"}'

# List all items
curl $API_URL/items
```

## Current Status
- ✅ Application code created
- ✅ CloudFormation template created
- ✅ GitHub Actions workflow configured
- ⏳ Awaiting AWS credentials configuration
- ⏳ Deployment pending

## Next Steps
1. Configure AWS credentials (either GitHub secrets or use ada locally)
2. Deploy the application
3. Test the API endpoints
