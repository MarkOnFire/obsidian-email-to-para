import { App, PluginSettingTab, Setting } from 'obsidian';
import EmailToParaPlugin from '../main'; 
import { PluginSettings, DEFAULT_SETTINGS } from './types';

export class EmailToParaSettingTab extends PluginSettingTab {
    plugin: EmailToParaPlugin;

    constructor(app: App, plugin: EmailToParaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Email to PARA Sync Settings' });

        // --- OAuth Setup Instructions Section ---
        containerEl.createEl('h3', { text: 'OAuth Application Setup' });
        containerEl.createEl('p', { text: 'Before connecting accounts, you need to register OAuth applications with Google and Microsoft. This allows the plugin to securely access your emails.' });
        containerEl.createEl('p', { text: 'Please refer to the plugin\'s README.md for detailed, step-by-step instructions on how to create these applications and obtain your Client IDs.' });
        
        const oauthLinksEl = containerEl.createEl('ul');
        oauthLinksEl.createEl('li', { text: 'Google Cloud Console (for Gmail): ' }).createEl('a', {
            href: 'https://console.cloud.google.com',
            text: 'https://console.cloud.google.com'
        });
        oauthLinksEl.createEl('li', { text: 'Azure Portal (for Outlook): ' }).createEl('a', {
            href: 'https://portal.azure.com',
            text: 'https://portal.azure.com'
        });
        
        containerEl.createEl('h3', { text: 'Account Management' });

        // --- Gmail Settings ---
        new Setting(containerEl)
            .setName('Enable Gmail Sync')
            .setDesc('Toggle to enable or disable synchronization with Gmail.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.gmail.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.gmail.enabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Re-render to show/hide related settings
                }));
        
        if (this.plugin.settings.gmail.enabled) {
            new Setting(containerEl)
                .setName('Gmail Client ID')
                .setDesc('Enter your Google OAuth Client ID for this plugin.')
                .addText(text => text
                    .setPlaceholder('Enter your Client ID')
                    .setValue(this.plugin.settings.gmail.clientId)
                    .onChange(async (value) => {
                        this.plugin.settings.gmail.clientId = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Connect Gmail Account')
                .setDesc('Click to authenticate with your Gmail account.')
                .addButton(button => button
                    .setButtonText(this.plugin.gmailProvider.isAuthenticated() ? 'Reconnect' : 'Connect')
                    .setCta()
                    .onClick(async () => {
                        try {
                            await this.plugin.gmailProvider.authenticate();
                            await this.plugin.saveSettings(); // Save the new tokens
                            this.display(); // Refresh UI to show connected status
                        } catch (e) {
                            console.error('Gmail authentication error:', e);
                            // Notice already shown in authenticate() method
                        }
                    }));

            // Show authentication status
            const statusText = this.plugin.gmailProvider.isAuthenticated()
                ? '✅ Connected'
                : '❌ Not Connected';
            containerEl.createEl('p', {text: `Gmail Status: ${statusText}`});
        }
        
        containerEl.createEl('h3', { text: 'Outlook Settings' });

        // --- Outlook Settings ---
        new Setting(containerEl)
            .setName('Enable Outlook Sync')
            .setDesc('Toggle to enable or disable synchronization with Outlook.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.outlook.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.outlook.enabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Re-render
                }));

        if (this.plugin.settings.outlook.enabled) {
            new Setting(containerEl)
                .setName('Outlook Client ID')
                .setDesc('Enter your Microsoft OAuth Client ID for this plugin.')
                .addText(text => text
                    .setPlaceholder('Enter your Client ID')
                    .setValue(this.plugin.settings.outlook.clientId)
                    .onChange(async (value) => {
                        this.plugin.settings.outlook.clientId = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Connect Outlook Account')
                .setDesc('Click to authenticate with your Outlook account.')
                .addButton(button => button
                    .setButtonText('Connect')
                    .setCta()
                    .onClick(async () => {
                        // Placeholder for OAuth flow
                        new Notification('Outlook Connection', {body: 'Initiating Outlook OAuth flow (not yet implemented)'});
                        console.log('Initiating Outlook OAuth flow...');
                    }));

            // Placeholder for status
            containerEl.createEl('p', {text: `Outlook Status: ${this.plugin.settings.outlook.encryptedTokenBlob ? 'Connected' : 'Not Connected'}`});
        }
        
        containerEl.createEl('h3', { text: 'Synchronization Settings' });

        // --- Sync Settings ---
        new Setting(containerEl)
            .setName('Sync Interval')
            .setDesc('How often (in minutes) the plugin should check for new starred/flagged emails.')
            .addText(text => text
                .setPlaceholder('e.g., 30')
                .setValue(this.plugin.settings.sync.intervalMinutes.toString())
                .onChange(async (value) => {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        this.plugin.settings.sync.intervalMinutes = parsed;
                        await this.plugin.saveSettings();
                    } else {
                        // Optionally show an error or revert to old value
                        new Notification('Invalid Input', {body: 'Sync interval must be a positive number.'});
                    }
                }));

        new Setting(containerEl)
            .setName('Inbox Folder')
            .setDesc('The folder where new email notes will be created (e.g., "0 - INBOX").')
            .addText(text => text
                .setPlaceholder('0 - INBOX')
                .setValue(this.plugin.settings.sync.inboxFolder)
                .onChange(async (value) => {
                    this.plugin.settings.sync.inboxFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
