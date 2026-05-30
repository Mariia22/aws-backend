import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

export class AuthorizationServiceStack extends cdk.Stack {
  public basicAuthorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Load credentials from .env file
    const envFilePath = path.join(__dirname, '..', '.env');
    const credentials = this.loadCredentialsFromEnv(envFilePath);

    // Create Basic Authorizer Lambda function
    this.basicAuthorizerFunction = new lambda.Function(
      this,
      'BasicAuthorizerFn',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'basicAuthorizer.handler',
        code: lambda.Code.fromAsset('dist/lambda'),
        functionName: 'BasicAuthorizerFunction',
        environment: {
          CREDENTIALS: credentials,
        },
      }
    );
  }

  private loadCredentialsFromEnv(envFilePath: string): string {
    // Load .env file
    const result = dotenv.config({ path: envFilePath });
    
    if (result.error) {
      console.warn(`Warning: Could not load .env file at ${envFilePath}`);
    }

    const envVars: Record<string, string> = {};
    
    // Extract only the custom credentials (not system/npm variables)
    if (result.parsed) {
      Object.entries(result.parsed).forEach(([key, value]) => {
        if (value) {
          envVars[key] = value;
        }
      });
    }

    // If no credentials found, use empty object
    return JSON.stringify(envVars);
  }
}
