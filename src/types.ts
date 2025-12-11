/**
 * Standardized Email Object across all providers
 */
export interface EmailMessage {
    id: string;
    source: 'gmail' | 'outlook';
    subject: string;
    from: {
        name: string;
        email: string;
    };
    to: {
        name: string;
        email: string;
    }[];
    cc?: {
        name: string;
        email: string;
    }[];
    receivedAt: Date;
    snippet: string;
    bodyHtml: string;
    bodyText?: string;
    webLink: string;
    hasAttachments: boolean;
    attachments?: {
        name: string;
        contentType: string;
        size: number;
    }[];
    labels?: string[];
}

/**
 * Interface for any Email Provider Service (Gmail, Outlook)
 */
export interface EmailProvider {
    /**
     * Provider unique identifier (e.g., 'gmail', 'outlook')
     */
    name: string;

    /**
     * Check if the provider is currently authenticated and ready
     */
    isAuthenticated(): boolean;

    /**
     * Initiate or refresh authentication flow
     */
    authenticate(): Promise<void>;

    /**
     * Fetch new starred/flagged messages.
     * @param since Optional Date to limit the search window
     */
    getStarredMessages(since?: Date): Promise<EmailMessage[]>;

    /**
     * Get the user's email address associated with this provider
     */
    getUserEmail(): Promise<string | null>;
}

/**
 * Persistent State for the Sync Engine
 */
export interface SyncStateData {
    lastSyncTime: number;
    /**
     * Map of MessageID -> Timestamp when it was synced.
     * Used for deduplication.
     */
    syncedIds: Record<string, number>;
}

export interface PluginSettings {
    gmail: {
        enabled: boolean;
        clientId: string;
        // Note: Tokens should ideally be stored securely, but for V1 we might keep them in data.json or separate
        encryptedTokenBlob?: string; 
    };
    outlook: {
        enabled: boolean;
        clientId: string;
        encryptedTokenBlob?: string;
    };
    sync: {
        intervalMinutes: number;
        inboxFolder: string;
        templatePath?: string;
    };
}

export const DEFAULT_SETTINGS: PluginSettings = {
    gmail: {
        enabled: false,
        clientId: ''
    },
    outlook: {
        enabled: false,
        clientId: ''
    },
    sync: {
        intervalMinutes: 30,
        inboxFolder: '0 - INBOX'
    }
};
