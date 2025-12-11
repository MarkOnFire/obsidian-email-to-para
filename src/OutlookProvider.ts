import { EmailProvider, EmailMessage, PluginSettings } from './types';
import { OAuthServer, generateOAuthState } from './OAuthServer';
import { Notice, requestUrl, RequestUrlParam } from 'obsidian';

interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

export class OutlookProvider implements EmailProvider {
    name = 'outlook';
    private settings: PluginSettings['outlook'];
    private tokenData: TokenData | null = null;

    // Microsoft Graph Endpoints
    private static readonly AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    private static readonly TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    private static readonly GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';

    constructor(settings: PluginSettings['outlook']) {
        this.settings = settings;
        
        // Load saved tokens
        if (settings.encryptedTokenBlob) {
            try {
                this.tokenData = JSON.parse(settings.encryptedTokenBlob);
            } catch (e) {
                console.error('Failed to parse Outlook token blob:', e);
            }
        }
    }

    isAuthenticated(): boolean {
        return !!this.tokenData?.refreshToken;
    }

    async authenticate(): Promise<void> {
        if (!this.settings.clientId) {
            throw new Error('Outlook Client ID not configured. Please enter it in settings.');
        }

        new Notice('Starting Outlook authentication...');
        console.log('OutlookProvider: Starting OAuth flow...');

        // Start OAuth callback server
        const server = new OAuthServer();
        try {
            await server.start();
            const callbackUrl = server.getCallbackUrl();
            const state = generateOAuthState();

            // Build authorization URL
            // Note: Microsoft requires 'offline_access' scope to get a refresh token
            const scopes = ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'];
            
            const authParams = new URLSearchParams({
                client_id: this.settings.clientId,
                response_type: 'code',
                redirect_uri: callbackUrl,
                response_mode: 'query',
                scope: scopes.join(' '),
                state: state
            });

            const authUrl = `${OutlookProvider.AUTH_ENDPOINT}?${authParams.toString()}`;

            // Open browser
            console.log('Opening browser to:', authUrl);
            window.open(authUrl, '_blank');

            // Wait for callback
            const result = await server.waitForCallback(state);

            // Exchange code for tokens
            await this.exchangeCodeForTokens(result.code, callbackUrl);

            new Notice('Outlook authenticated successfully!');
            console.log('Outlook authentication successful');

        } catch (e) {
            console.error('Outlook authentication failed:', e);
            new Notice(`Outlook authentication failed: ${e.message}`);
            throw e;
        } finally {
            server.stop();
        }
    }

    private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<void> {
        const body = new URLSearchParams({
            client_id: this.settings.clientId,
            scope: 'openid profile offline_access User.Read Mail.Read',
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        // Use Obsidian's requestUrl to avoid CORS issues, although fetch usually works for server-to-server
        const response = await fetch(OutlookProvider.TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        this.saveTokens(data);
    }

    private saveTokens(data: any) {
        this.tokenData = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || this.tokenData?.refreshToken, // Keep old refresh token if new one not provided
            expiresAt: Date.now() + (data.expires_in * 1000)
        };

        // In a real app, we'd encrypt this.
        this.settings.encryptedTokenBlob = JSON.stringify(this.tokenData);
    }

    async getUserEmail(): Promise<string | null> {
        if (!this.isAuthenticated()) return null;
        
        try {
            await this.ensureAccessToken();
            
            const response = await fetch(`${OutlookProvider.GRAPH_ENDPOINT}/me`, {
                headers: { 'Authorization': `Bearer ${this.tokenData?.accessToken}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.userPrincipalName || data.mail || null;
            }
        } catch (e) {
            console.error('Error fetching user email:', e);
        }
        return null;
    }

    async getStarredMessages(since?: Date): Promise<EmailMessage[]> {
        if (!this.isAuthenticated()) {
            throw new Error('Outlook is not authenticated.');
        }

        await this.ensureAccessToken();

        try {
            // Filter for flagged messages
            let filter = "flag/flagStatus eq 'flagged'";
            
            if (since) {
                // ISO format is standard for Graph API
                filter += ` and receivedDateTime ge ${since.toISOString()}`;
            }

            // Select specific fields to reduce payload
            const select = 'id,subject,receivedDateTime,from,toRecipients,ccRecipients,body,bodyPreview,webLink,hasAttachments,flag';
            
            const url = `${OutlookProvider.GRAPH_ENDPOINT}/me/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=50`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.tokenData?.accessToken}` }
            });

            if (!response.ok) {
                console.error('Outlook list failed', await response.text());
                return [];
            }

            const data = await response.json();
            const messages = data.value || [];

            return messages.map((msg: any) => this.parseOutlookMessage(msg));

        } catch (e) {
            console.error('Error fetching Outlook messages:', e);
            return [];
        }
    }

    private async ensureAccessToken(): Promise<void> {
        if (!this.tokenData) {
            throw new Error('Not authenticated');
        }

        // Check if access token is valid (with 5 min buffer)
        if (this.tokenData.expiresAt > Date.now() + (5 * 60 * 1000)) {
            return;
        }

        console.log('Outlook access token expired, refreshing...');

        const body = new URLSearchParams({
            client_id: this.settings.clientId,
            scope: 'openid profile offline_access User.Read Mail.Read',
            refresh_token: this.tokenData.refreshToken,
            grant_type: 'refresh_token'
        });

        const response = await fetch(OutlookProvider.TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            // If refresh fails, we might need to re-authenticate
            const errorText = await response.text();
            throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        this.saveTokens(data);
        console.log('Outlook access token refreshed successfully');
    }

    private parseOutlookMessage(data: any): EmailMessage {
        const from = {
            name: data.from?.emailAddress?.name || data.from?.emailAddress?.address || 'Unknown',
            email: data.from?.emailAddress?.address || ''
        };

        const mapRecipients = (recipients: any[]) => 
            (recipients || []).map((r: any) => ({
                name: r.emailAddress?.name || r.emailAddress?.address || '',
                email: r.emailAddress?.address || ''
            }));

        // Determine body content
        // Outlook returns body.content and body.contentType ('html' or 'text')
        const bodyHtml = data.body?.contentType === 'html' ? data.body.content : '';
        const bodyText = data.body?.contentType === 'text' ? data.body.content : '';

        return {
            id: data.id,
            source: 'outlook',
            subject: data.subject || '(No Subject)',
            from,
            to: mapRecipients(data.toRecipients),
            cc: mapRecipients(data.ccRecipients),
            receivedAt: new Date(data.receivedDateTime),
            snippet: data.bodyPreview || '',
            bodyHtml,
            bodyText,
            webLink: data.webLink,
            hasAttachments: data.hasAttachments,
            labels: [] // Outlook flags don't map neatly to labels like Gmail
        };
    }
}