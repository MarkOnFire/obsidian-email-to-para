import { App, Plugin, FileSystemAdapter } from 'obsidian';
import { SyncStateData } from './types';
import * as path from 'path';

const DEFAULT_SYNC_STATE: SyncStateData = {
    lastSyncTime: 0,
    syncedIds: {}
};

export class SyncStateManager {
    private plugin: Plugin;
    private state: SyncStateData;
    private statePath: string;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.state = { ...DEFAULT_SYNC_STATE };
        // We construct the path relative to the vault root if using adapter,
        // but .obsidian folders are sometimes tricky with Vault.adapter.
        // However, on Desktop, we can use the adapter's getBasePath() if needed, 
        // or just rely on the fact that manifest.dir is relative to vault root?
        // Actually, manifest.dir is usually the full path? No, it's relative to vault root often.
        // Let's check docs or safe patterns.
        // Best practice: Use the adapter.
        
        // If manifest.dir is "plugins/email-to-para-sync", we append ".sync-state.json".
        this.statePath = `${this.plugin.manifest.dir}/.sync-state.json`;
    }

    /**
     * Load state from disk
     */
    async load(): Promise<void> {
        try {
            const adapter = this.plugin.app.vault.adapter;
            if (await adapter.exists(this.statePath)) {
                const data = await adapter.read(this.statePath);
                this.state = JSON.parse(data);
            } else {
                this.state = { ...DEFAULT_SYNC_STATE };
            }
        } catch (e) {
            console.error("Failed to load sync state:", e);
            this.state = { ...DEFAULT_SYNC_STATE };
        }
    }

    /**
     * Save state to disk
     */
    async save(): Promise<void> {
        try {
            const adapter = this.plugin.app.vault.adapter;
            await adapter.write(this.statePath, JSON.stringify(this.state, null, 2));
        } catch (e) {
            console.error("Failed to save sync state:", e);
        }
    }

    /**
     * Check if a message ID has already been synced
     */
    isSynced(id: string): boolean {
        return !!this.state.syncedIds[id];
    }

    /**
     * Mark a message ID as synced
     */
    async addSynced(id: string): Promise<void> {
        this.state.syncedIds[id] = Date.now();
        // We might want to debounce saving, but for now save immediately for safety
        await this.save();
    }

    /**
     * Get the timestamp of the last successful sync
     */
    getLastSyncTime(): number {
        return this.state.lastSyncTime;
    }

    /**
     * Update the last sync timestamp
     */
    async setLastSyncTime(time: number): Promise<void> {
        this.state.lastSyncTime = time;
        await this.save();
    }

    /**
     * Get the full state object (readonly-ish)
     */
    getState(): SyncStateData {
        return this.state;
    }
}
