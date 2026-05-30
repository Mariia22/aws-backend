import {
  APIGatewayAuthorizerEvent,
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';

interface PolicyStatement {
  Action: string;
  Effect: 'Allow' | 'Deny';
  Resource: string;
}

interface AuthorizerContext {
  principalId: string;
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {

  const authorizationToken = event.authorizationToken;
  const methodArn = event.methodArn;

  if (!authorizationToken) {
    throw new Error('Unauthorized');
  }

  try {
    const tokenParts = authorizationToken.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Basic') {
      console.log('Invalid authorization header format');
      throw new Error('Forbidden');
    }

    const encodedCredentials = tokenParts[1];

    let decodedCredentials: string;
    try {
      decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString(
        'utf-8'
      );
    } catch (error) {
      console.log('Failed to decode base64 credentials');
      throw new Error('Forbidden');
    }

    const credentialsParts = decodedCredentials.split(':');
    if (credentialsParts.length !== 2) {
      console.log('Invalid credentials format');
      throw new Error('Forbidden');
    }

    const [username, password] = credentialsParts;
    const credentialsEnv = process.env.CREDENTIALS;
    if (!credentialsEnv) {
      console.log('No credentials configured in environment');
      throw new Error('Forbidden');
    }

    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(credentialsEnv);
    } catch (error) {
      console.log('Failed to parse credentials from environment');
      throw new Error('Forbidden');
    }

    if (credentials[username] !== password) {
      console.log(`Invalid credentials for user: ${username}`);
      throw new Error('Forbidden');
    }

    console.log(`User ${username} authorized successfully`);
    const policy = generatePolicy(username, 'Allow', methodArn);
    return policy;
  } catch (error) {
    console.log(`Authorization error: ${error}`);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === 'Unauthorized') {
      throw new Error('Unauthorized');
    } else {
      throw new Error('Forbidden');
    }
  }
};

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult {
  const authResponse: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };

  authResponse.context = {
    principalId,
  };

  return authResponse;
}
