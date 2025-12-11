import { Notice } from 'obsidian';

export interface OAuthConfig {
    authUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    scopes: string[];
}

export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
}

export class OAuthHelper {
    /**
     * Generate a random state parameter for CSRF protection
     */
    static generateState(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Start OAuth flow by opening authorization URL in browser
     */
    static async startAuthFlow(config: OAuthConfig): Promise<OAuthTokens> {
        const state = this.generateState();

        // Build authorization URL
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: config.scopes.join(' '),
            state: state,
            access_type: 'offline', // Request refresh token
            prompt: 'consent' // Force consent screen to get refresh token
        });

        const authUrl = `${config.authUrl}?${params.toString()}`;

        // Open browser
        window.open(authUrl, '_blank');

        new Notice('Opening browser for authentication. Please complete the OAuth flow.');

        // Start local server to receive callback
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('OAuth flow timed out after 5 minutes'));
            }, 5 * 60 * 1000);

            // Set up a simple callback listener using Obsidian's HTTP server capability
            // NOTE: Obsidian doesn't have built-in HTTP server, so we need a workaround

            // For now, we'll use a polling approach with localStorage
            // The redirect page will write the code to localStorage
            const checkInterval = setInterval(async () => {
                const authCode = localStorage.getItem('oauth_auth_code');
                const receivedState = localStorage.getItem('oauth_state');

                if (authCode && receivedState) {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);

                    // Clean up
                    localStorage.removeItem('oauth_auth_code');
                    localStorage.removeItem('oauth_state');

                    // Verify state
                    if (receivedState !== state) {
                        reject(new Error('State mismatch - possible CSRF attack'));
                        return;
                    }

                    // Exchange code for tokens
                    try {
                        const tokens = await this.exchangeCodeForTokens(authCode, config);
                        resolve(tokens);
                    } catch (e) {
                        reject(e);
                    }
                }
            }, 1000); // Check every second
        });
    }

    /**
     * Exchange authorization code for access/refresh tokens
     */
    private static async exchangeCodeForTokens(code: string, config: OAuthConfig): Promise<OAuthTokens> {
        const params = new URLSearchParams({
            code: code,
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code'
        });

        // Add client secret if provided (Outlook requires it, Gmail doesn't for desktop apps)
        if (config.clientSecret) {
            params.append('client_secret', config.clientSecret);
        }

        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            tokenType: data.token_type
        };
    }

    /**
     * Refresh an expired access token using refresh token
     */
    static async refreshAccessToken(refreshToken: string, config: OAuthConfig): Promise<OAuthTokens> {
        const params = new URLSearchParams({
            refresh_token: refreshToken,
            client_id: config.clientId,
            grant_type: 'refresh_token'
        });

        if (config.clientSecret) {
            params.append('client_secret', config.clientSecret);
        }

        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
            expiresIn: data.expires_in,
            tokenType: data.token_type
        };
    }
}
