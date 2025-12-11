import { Notice } from 'obsidian';
import * as http from 'http';

export interface OAuthCallbackResult {
    code: string;
    state: string;
}

/**
 * Temporary HTTP server for OAuth callback handling
 * Binds to localhost on a fixed port for OAuth compatibility
 */
export class OAuthServer {
    private server: http.Server | null = null;
    private port: number = 42813; // Fixed port for OAuth redirect URI

    /**
     * Start the OAuth callback server
     * Returns the port number it's listening on
     */
    async start(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer();

            // Bind to localhost on fixed port (required for OAuth redirect URI)
            this.server.listen(this.port, '127.0.0.1', () => {
                const address = this.server!.address();
                if (address && typeof address === 'object') {
                    this.port = address.port;
                    console.log(`OAuth callback server listening on http://127.0.0.1:${this.port}`);
                    resolve(this.port);
                } else {
                    reject(new Error('Failed to get server port'));
                }
            });

            this.server.on('error', (err) => {
                console.error('OAuth server error:', err);
                reject(err);
            });
        });
    }

    /**
     * Wait for OAuth callback with authorization code
     * Returns a promise that resolves when callback is received
     * @param expectedState - The state parameter to verify (CSRF protection)
     * @param timeoutMs - How long to wait for callback (default: 5 minutes)
     */
    waitForCallback(expectedState: string, timeoutMs: number = 5 * 60 * 1000): Promise<OAuthCallbackResult> {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                reject(new Error('Server not started'));
                return;
            }

            const timeout = setTimeout(() => {
                this.stop();
                reject(new Error('OAuth flow timed out after 5 minutes'));
            }, timeoutMs);

            this.server.on('request', (req, res) => {
                const url = new URL(req.url!, `http://127.0.0.1:${this.port}`);

                // Check if this is our OAuth callback path
                if (url.pathname === '/callback') {
                    const code = url.searchParams.get('code');
                    const state = url.searchParams.get('state');
                    const error = url.searchParams.get('error');
                    const errorDescription = url.searchParams.get('error_description');

                    // Handle errors from OAuth provider
                    if (error) {
                        clearTimeout(timeout);
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                                    <h1>❌ Authentication Failed</h1>
                                    <p>${error}: ${errorDescription || 'Unknown error'}</p>
                                    <p>You can close this window and try again.</p>
                                </body>
                            </html>
                        `);
                        this.stop();
                        reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
                        return;
                    }

                    // Validate we have required parameters
                    if (!code || !state) {
                        clearTimeout(timeout);
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                                    <h1>❌ Invalid Callback</h1>
                                    <p>Missing authorization code or state parameter.</p>
                                    <p>You can close this window and try again.</p>
                                </body>
                            </html>
                        `);
                        this.stop();
                        reject(new Error('Missing code or state in OAuth callback'));
                        return;
                    }

                    // Verify state matches (CSRF protection)
                    if (state !== expectedState) {
                        clearTimeout(timeout);
                        res.writeHead(403, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                                    <h1>❌ Security Error</h1>
                                    <p>State parameter mismatch. Possible CSRF attack detected.</p>
                                    <p>You can close this window and try again.</p>
                                </body>
                            </html>
                        `);
                        this.stop();
                        reject(new Error('State mismatch - possible CSRF attack'));
                        return;
                    }

                    // Success!
                    clearTimeout(timeout);
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body style="font-family: system-ui; padding: 40px; text-align: center;">
                                <h1>✅ Authentication Successful!</h1>
                                <p>You can close this window and return to Obsidian.</p>
                                <p style="color: #666; font-size: 14px; margin-top: 40px;">
                                    The Email to PARA Sync plugin is now connected to your account.
                                </p>
                            </body>
                        </html>
                    `);

                    // Stop server and resolve with callback data
                    this.stop();
                    resolve({ code, state });
                } else {
                    // Not our callback path, return 404
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            });
        });
    }

    /**
     * Stop the OAuth callback server
     */
    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('OAuth callback server stopped');
        }
    }

    /**
     * Get the callback URL for OAuth redirect
     */
    getCallbackUrl(): string {
        if (!this.port) {
            throw new Error('Server not started - call start() first');
        }
        return `http://127.0.0.1:${this.port}/callback`;
    }
}

/**
 * Generate a cryptographically random state parameter for OAuth
 */
export function generateOAuthState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
