import { handler } from './basicAuthorizer';
import { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

describe('basicAuthorizer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.CREDENTIALS = JSON.stringify({
      testuser: 'TEST_PASSWORD',
      johndoe: 'TEST_PASSWORD',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 401 when Authorization header is missing', async () => {
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: '',
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });

  it('should return 403 when credentials are invalid', async () => {
    const invalidCredentials = Buffer.from('testuser:wrong_password').toString(
      'base64'
    );
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: `Basic ${invalidCredentials}`,
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    await expect(handler(event)).rejects.toThrow('Forbidden');
  });

  it('should return 403 when user does not exist', async () => {
    const invalidCredentials = Buffer.from(
      'nonexistent:TEST_PASSWORD'
    ).toString('base64');
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: `Basic ${invalidCredentials}`,
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    await expect(handler(event)).rejects.toThrow('Forbidden');
  });

  it('should return IAM policy when credentials are valid', async () => {
    const validCredentials = Buffer.from('testuser:TEST_PASSWORD').toString(
      'base64'
    );
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: `Basic ${validCredentials}`,
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    const result = await handler(event);

    expect(result.principalId).toBe('testuser');
    expect(result.policyDocument).toBeDefined();
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect((result.policyDocument.Statement[0] as any).Action).toBe(
      'execute-api:Invoke'
    );
    expect(result.context?.principalId).toBe('testuser');
  });

  it('should handle multiple users', async () => {
    const validCredentials = Buffer.from('johndoe:TEST_PASSWORD').toString(
      'base64'
    );
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: `Basic ${validCredentials}`,
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    const result = await handler(event);

    expect(result.principalId).toBe('johndoe');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
  });

  it('should return 403 when Authorization header has invalid format', async () => {
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: 'InvalidFormat',
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    await expect(handler(event)).rejects.toThrow('Forbidden');
  });

  it('should return 403 when Authorization header has invalid base64', async () => {
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: 'Basic !!!invalid_base64!!!',
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    await expect(handler(event)).rejects.toThrow('Forbidden');
  });

  it('should return 403 when credentials do not contain colon separator', async () => {
    const invalidCredentials = Buffer.from('testuserwithoutcolon').toString(
      'base64'
    );
    const event: APIGatewayTokenAuthorizerEvent = {
      type: 'TOKEN',
      authorizationToken: `Basic ${invalidCredentials}`,
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789:api/stage/GET/resource',
    };

    await expect(handler(event)).rejects.toThrow('Forbidden');
  });
});
