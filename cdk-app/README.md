# TypeScript CDK Application

Full TypeScript implementation - both Lambda function and infrastructure as code.

## Structure

```
cdk-app/
├── lambda/
│   └── index.ts          # Lambda handler (TypeScript)
├── lambda-dist/          # Compiled Lambda code
├── lib/
│   └── cdk-app-stack.ts  # CDK infrastructure (TypeScript)
├── bin/
│   └── cdk-app.ts        # CDK app entry point
└── build.sh              # Build script
```

## Build Locally

```bash
./build.sh
```

This will:
1. Bundle Lambda TypeScript code with esbuild
2. Compile CDK TypeScript code
3. Synthesize CloudFormation template

## Deploy

```bash
# Bootstrap CDK (one-time per account/region)
npx cdk bootstrap aws://549725144537/us-west-2

# Deploy
npx cdk deploy
```

## Resources Created

- **DynamoDB Table**: Items storage
- **Lambda Function**: Node.js 20.x runtime
- **API Gateway**: REST API with /items endpoints
- **IAM Roles**: Lambda execution role with DynamoDB permissions

## API Endpoints

- `GET /items` - List all items
- `POST /items` - Create item
- `GET /items/{id}` - Get specific item

## Advantages over SAM

- Real programming language (TypeScript)
- Type safety and IDE autocomplete
- Better code reuse and abstractions
- Single language for app + infrastructure
- More powerful constructs
