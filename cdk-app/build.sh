#!/bin/bash
set -e

echo "Building Lambda function..."
npx esbuild lambda/index.ts --bundle --platform=node --target=node20 --outdir=lambda-dist --external:@aws-sdk/*

echo "Building CDK stack..."
npm run build

echo "Synthesizing CloudFormation..."
npx cdk synth

echo "✅ Build complete!"
