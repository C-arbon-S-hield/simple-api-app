#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StagingStack } from '../lib/staging-stack';

const app = new cdk.App();
new StagingStack(app, 'StagingDRStack', {
  env: { account: '549725144537', region: 'us-west-2' },
});
