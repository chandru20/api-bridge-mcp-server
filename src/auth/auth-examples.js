
/**
 * APIBridge MCP Server - Authentication Examples
 * 
 * This file provides example implementations for various authentication strategies
 * that can be integrated with the HttpClient.
 */

/**
 * Example 1: Custom API Key in Header
 * 
 * @param {object} client - The Axios client instance
 * @param {string} apiKey - The API key
 * @param {string} headerName - The name of the header (e.g., 'X-API-Key')
 */
export function setupCustomHeaderAuth(client, apiKey, headerName = 'X-API-Key') {
  if (apiKey) {
    client.defaults.headers.common[headerName] = apiKey;
  }
}

/**
 * Example 2: OAuth 2.0 Client Credentials Flow
 * 
 * This example demonstrates how to fetch an OAuth token and attach it
 * to subsequent requests.
 * 
 * @param {object} client - The Axios client instance
 * @param {object} options - OAuth configuration
 * @param {string} options.tokenUrl - The URL to fetch the token from
 * @param {string} options.clientId - The client ID
 * @param {string} options.clientSecret - The client secret
 */
export async function setupOAuth2ClientCredentials(client, options) {
  try {
    // Fetch the token
    const tokenResponse = await client.post(options.tokenUrl, {
      grant_type: 'client_credentials',
      client_id: options.clientId,
      client_secret: options.clientSecret
    });

    const accessToken = tokenResponse.data.access_token;

    if (accessToken) {
      // Attach the token to all subsequent requests
      client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }
  } catch (error) {
    console.error(`[AUTH] Failed to obtain OAuth token: ${error.message}`);
    // Depending on the use case, you might want to throw an error here
  }
}

/**
 * To use these examples, you would modify the `HttpClient` class in `src/utils/http-client.js`.
 * 
 * For example, in the `initialize` method:
 * 
 * import { setupCustomHeaderAuth, setupOAuth2ClientCredentials } from '../auth/auth-examples.js';
 * 
 * // ... inside initialize()
 * 
 * // For custom header auth:
 * // setupCustomHeaderAuth(this.client, config.apiKey, 'X-My-Custom-Header');
 * 
 * // For OAuth 2.0:
 * // const oauthOptions = {
 * //   tokenUrl: 'https://your-auth-server.com/oauth/token',
 * //   clientId: 'your-client-id',
 * //   clientSecret: 'your-client-secret'
 * // };
 * // await setupOAuth2ClientCredentials(this.client, oauthOptions);
 */
