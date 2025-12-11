import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { EmailToParaSettingTab } from './src/SettingsTab';
import { PluginSettings, DEFAULT_SETTINGS, EmailProvider, EmailMessage } from './src/types';
import { SyncStateManager } from './src/SyncStateManager';
import { GmailProvider } from './src/GmailProvider';
import { OutlookProvider } from './src/OutlookProvider';
import { NoteCreator } from './src/NoteCreator';

export default class EmailToParaPlugin extends Plugin {
	settings: PluginSettings;
    syncStateManager: SyncStateManager;
    gmailProvider: GmailProvider;
    outlookProvider: OutlookProvider;
    noteCreator: NoteCreator;
    
    private syncIntervalId: number | null = null;
    private isSyncing: boolean = false;
    private statusBarItem: HTMLElement;

	async onload() {
		console.log('Loading Email to PARA Sync Plugin');

        await this.loadSettings();

        // Initialize components
        this.syncStateManager = new SyncStateManager(this);
        await this.syncStateManager.load();

        this.gmailProvider = new GmailProvider(this.settings.gmail);
        this.outlookProvider = new OutlookProvider(this.settings.outlook);
        this.noteCreator = new NoteCreator(this.app, this.settings);

        // UI: Settings
        this.addSettingTab(new EmailToParaSettingTab(this.app, this));

        // UI: Status Bar
		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.setText('Email Sync: Ready');

		// UI: Ribbon Icon
		this.addRibbonIcon('mail', 'Sync emails', async (evt: MouseEvent) => {
            new Notice('Starting email sync...');
			await this.syncEmails();
		});

		// UI: Command
		this.addCommand({
			id: 'sync-emails-manually',
			name: 'Sync Emails Manually',
			callback: async () => {
                new Notice('Starting email sync...');
				await this.syncEmails();
			}
		});

        // Auto-Sync
        this.startAutoSync();
	}

	async onunload() {
		console.log('Unloading Email to PARA Sync Plugin');
        this.stopAutoSync();
	}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        // Update provider settings references if they exist
        if (this.gmailProvider) this.gmailProvider = new GmailProvider(this.settings.gmail);
        if (this.outlookProvider) this.outlookProvider = new OutlookProvider(this.settings.outlook);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Restart auto-sync in case interval changed
        this.stopAutoSync();
        this.startAutoSync();
    }

    startAutoSync() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
        }
        
        const intervalMs = this.settings.sync.intervalMinutes * 60 * 1000;
        console.log(`Email Sync: Auto-sync started (Interval: ${this.settings.sync.intervalMinutes}m)`);
        
        this.syncIntervalId = window.setInterval(() => {
            this.syncEmails();
        }, intervalMs);
    }

    stopAutoSync() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    async syncEmails() {
        if (this.isSyncing) {
            console.log('Email Sync: Sync already in progress. Skipping.');
            return;
        }

        this.isSyncing = true;
        this.statusBarItem.setText('Email Sync: Checking...');
        
        let newCount = 0;
        let errorCount = 0;

        try {
            const providers: EmailProvider[] = [];
            if (this.settings.gmail.enabled) providers.push(this.gmailProvider);
            if (this.settings.outlook.enabled) providers.push(this.outlookProvider);

            if (providers.length === 0) {
                console.log('Email Sync: No providers enabled.');
                this.statusBarItem.setText('Email Sync: Off');
                this.isSyncing = false;
                return;
            }

            for (const provider of providers) {
                try {
                    if (!provider.isAuthenticated()) {
                        console.log(`Email Sync: ${provider.name} enabled but not authenticated.`);
                        continue;
                    }

                    // Only fetch recent if we want to optimize, but for now fetch all starred
                    // Logic refinement: getStarredMessages currently doesn't handle "since" robustly in stub
                    // but let's pass the lastSyncTime just in case we enhance it.
                    const lastSync = this.syncStateManager.getLastSyncTime();
                    const messages = await provider.getStarredMessages(lastSync > 0 ? new Date(lastSync) : undefined);

                    for (const msg of messages) {
                        if (this.syncStateManager.isSynced(msg.id)) {
                            continue;
                        }

                        const file = await this.noteCreator.createNote(msg);
                        if (file) {
                            await this.syncStateManager.addSynced(msg.id);
                            newCount++;
                        } else {
                            errorCount++;
                        }
                    }

                } catch (e) {
                    console.error(`Email Sync: Error syncing ${provider.name}`, e);
                    errorCount++;
                    new Notice(`Email Sync Error (${provider.name}): ${e.message}`);
                }
            }

            await this.syncStateManager.setLastSyncTime(Date.now());
            
            if (newCount > 0) {
                new Notice(`Email Sync: Created ${newCount} new notes.`);
            } else if (errorCount > 0) {
                new Notice(`Email Sync: Finished with ${errorCount} errors.`);
            } else {
                // Quietly finish if nothing new
                console.log('Email Sync: No new emails.');
            }

        } catch (e) {
            console.error('Email Sync: Critical Error', e);
            new Notice('Email Sync Failed');
        } finally {
            this.isSyncing = false;
            const timeStr = new Date().toLocaleTimeString();
            this.statusBarItem.setText(`Email Sync: Done ${timeStr}`);
        }
    }
}
