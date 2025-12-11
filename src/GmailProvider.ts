import { EmailProvider, EmailMessage, PluginSettings } from './types';
import { OAuthServer, generateOAuthState } from './OAuthServer';
import { Notice } from 'obsidian';

interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // timestamp when access token expires
}

export class GmailProvider implements EmailProvider {
    name = 'gmail';
    private settings: PluginSettings['gmail'];
    private tokenData: TokenData | null = null;

    constructor(settings: PluginSettings['gmail']) {
        this.settings = settings;

        // Decrypt/parse token blob if it exists
        if (settings.encryptedTokenBlob) {
            try {
                this.tokenData = JSON.parse(settings.encryptedTokenBlob);
            } catch (e) {
                console.error('Failed to parse Gmail token blob:', e);
            }
        }
    }

    isAuthenticated(): boolean {
        return !!this.tokenData?.refreshToken;
    }

    async authenticate(): Promise<void> {
        if (!this.settings.clientId) {
            throw new Error('Gmail Client ID not configured. Please enter it in settings.');
        }

        new Notice('Starting Gmail authentication...');
        console.log('GmailProvider: Starting OAuth flow...');

        // Start OAuth callback server
        const server = new OAuthServer();
        try {
            await server.start();
            const callbackUrl = server.getCallbackUrl();
            const state = generateOAuthState();

            // Build authorization URL
            const authParams = new URLSearchParams({
                client_id: this.settings.clientId,
                redirect_uri: callbackUrl,
                response_type: 'code',
                scope: 'https://www.googleapis.com/auth/gmail.readonly',
                state: state,
                access_type: 'offline', // Get refresh token
                prompt: 'consent' // Force consent screen to ensure refresh token
            });

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

            // Open browser
            console.log('Opening browser to:', authUrl);
            window.open(authUrl, '_blank');

            // Wait for callback
            const result = await server.waitForCallback(state);

            // Exchange code for tokens
            const tokens = await this.exchangeCodeForTokens(result.code, callbackUrl);

            // Store tokens
            this.tokenData = {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: Date.now() + (tokens.expires_in * 1000)
            };

            // Save to settings (in future, should encrypt this)
            this.settings.encryptedTokenBlob = JSON.stringify(this.tokenData);

            new Notice('Gmail authenticated successfully!');
            console.log('Gmail authentication successful');

        } catch (e) {
            console.error('Gmail authentication failed:', e);
            new Notice(`Gmail authentication failed: ${e.message}`);
            throw e;
        } finally {
            server.stop();
        }
    }

    private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<any> {
        const params = new URLSearchParams({
            code: code,
            client_id: this.settings.clientId,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        const response = await fetch('https://oauth2.googleapis.com/token', {
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

        return await response.json();
    }

    async getUserEmail(): Promise<string | null> {
        // This would ideally be stored in settings after auth
        // or fetched from a userinfo endpoint
        return null; 
    }

    async getStarredMessages(since?: Date): Promise<EmailMessage[]> {
        if (!this.isAuthenticated()) {
            throw new Error('Gmail is not authenticated.');
        }

        // Ensure we have a valid access token
        await this.ensureAccessToken();

        try {
            // 1. List messages
            let query = 'q=is:starred';
            if (since) {
                // Gmail uses seconds for 'after'
                const seconds = Math.floor(since.getTime() / 1000);
                query += ` after:${seconds}`;
            }
            
            const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`;
            const listRes = await fetch(listUrl, {
                headers: { 'Authorization': `Bearer ${this.tokenData!.accessToken}` }
            });

            if (!listRes.ok) {
                console.error('Gmail list failed', await listRes.text());
                return [];
            }

            const listData = await listRes.json();
            const messages = listData.messages || [];

            if (messages.length === 0) return [];

            // 2. Fetch details for each message
            // In production, use batching or limit concurrency.
            const emailMessages: EmailMessage[] = [];

            for (const msg of messages) {
                const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
                const detailRes = await fetch(detailUrl, {
                    headers: { 'Authorization': `Bearer ${this.tokenData!.accessToken}` }
                });
                
                if (detailRes.ok) {
                    const data = await detailRes.json();
                    emailMessages.push(this.parseGmailMessage(data));
                }
            }

            return emailMessages;

        } catch (e) {
            console.error('Error fetching Gmail messages:', e);
            return [];
        }
    }

    private async ensureAccessToken(): Promise<void> {
        if (!this.tokenData) {
            throw new Error('Not authenticated');
        }

        // Check if access token is still valid (with 5 minute buffer)
        if (this.tokenData.expiresAt > Date.now() + (5 * 60 * 1000)) {
            return; // Token still valid
        }

        // Need to refresh the access token
        console.log('Gmail access token expired, refreshing...');

        const params = new URLSearchParams({
            refresh_token: this.tokenData.refreshToken,
            client_id: this.settings.clientId,
            grant_type: 'refresh_token'
        });

        const response = await fetch('https://oauth2.googleapis.com/token', {
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

        const tokens = await response.json();

        // Update token data
        this.tokenData.accessToken = tokens.access_token;
        this.tokenData.expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Save updated tokens
        this.settings.encryptedTokenBlob = JSON.stringify(this.tokenData);

        console.log('Gmail access token refreshed successfully');
    }

    private parseAddress(raw: string): { name: string; email: string } {
        const match = raw.match(/(.*)<(.*)>/);
        if (match) {
            return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
        }
        return { name: raw.trim().replace(/^"|"$/g, ''), email: raw.trim() };
    }

    private getAttachments(payload: any): { name: string; contentType: string; size: number }[] {
        const attachments: { name: string; contentType: string; size: number }[] = [];
        
        const walk = (part: any) => {
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    name: part.filename,
                    contentType: part.mimeType,
                    size: part.body.size || 0
                });
            }
            if (part.parts) {
                part.parts.forEach(walk);
            }
        };

        walk(payload);
        return attachments;
    }

    private parseGmailMessage(data: any): EmailMessage {
        const headers = data.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const subject = getHeader('subject') || '(No Subject)';
        const fromRaw = getHeader('from');
        const dateRaw = getHeader('date');
        const toRaw = getHeader('to');
        const ccRaw = getHeader('cc');

        const from = this.parseAddress(fromRaw);

        const parseAddressList = (listStr: string) => {
            if (!listStr) return [];
            // Simple split by comma - imperfect for names with commas but sufficient for MVP
            return listStr.split(',').map(s => this.parseAddress(s.trim()));
        };

        const to = parseAddressList(toRaw);
        const cc = parseAddressList(ccRaw);

        // Body decoding
        let bodyHtml = '';
        if (data.payload?.body?.data) {
            bodyHtml = Buffer.from(data.payload.body.data, 'base64').toString('utf-8');
        } else if (data.payload?.parts) {
            // Simple multipart handling: find text/html
            const htmlPart = data.payload.parts.find((p: any) => p.mimeType === 'text/html');
            if (htmlPart?.body?.data) {
                bodyHtml = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
            } else {
                // Fallback to text/plain
                 const textPart = data.payload.parts.find((p: any) => p.mimeType === 'text/plain');
                 if (textPart?.body?.data) {
                     bodyHtml = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                 }
            }
        }
        
        const attachments = this.getAttachments(data.payload);

        return {
            id: data.id,
            source: 'gmail',
            subject,
            from,
            to,
            cc,
            receivedAt: new Date(parseInt(data.internalDate)),
            snippet: data.snippet,
            bodyHtml,
            webLink: `https://mail.google.com/mail/u/0/#inbox/${data.id}`,
            hasAttachments: attachments.length > 0,
            attachments,
            labels: data.labelIds
        };
    }
}