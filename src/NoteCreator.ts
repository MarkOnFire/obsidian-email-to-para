import { App, normalizePath, TFile } from 'obsidian';
import { EmailMessage, PluginSettings } from './types';
import { HtmlToMarkdown } from './HtmlToMarkdown';

export class NoteCreator {
    private app: App;
    private settings: PluginSettings;
    private markdownConverter: HtmlToMarkdown;

    constructor(app: App, settings: PluginSettings) {
        this.app = app;
        this.settings = settings;
        this.markdownConverter = new HtmlToMarkdown();
    }

    /**
     * Creates a new note in the vault from an email message.
     */
    async createNote(email: EmailMessage): Promise<TFile | null> {
        const inboxFolder = this.settings.sync.inboxFolder || '0 - INBOX';
        
        // Ensure inbox folder exists
        if (!this.app.vault.getAbstractFileByPath(inboxFolder)) {
            try {
                await this.app.vault.createFolder(inboxFolder);
            } catch (e) {
                console.error(`Failed to create inbox folder: ${inboxFolder}`, e);
                return null;
            }
        }

        const filename = await this.generateUniqueFilename(email, inboxFolder);
        const content = this.generateNoteContent(email);

        try {
            const file = await this.app.vault.create(filename, content);
            return file;
        } catch (e) {
            console.error(`Failed to create note for email ${email.id}`, e);
            return null;
        }
    }

    /**
     * Generates a unique filename based on date and subject.
     * Format: YYYY-MM-DD - Subject.md
     */
    private async generateUniqueFilename(email: EmailMessage, folder: string): Promise<string> {
        const dateStr = email.receivedAt.toISOString().split('T')[0]; // YYYY-MM-DD
        const safeSubject = this.sanitizeFilename(email.subject).substring(0, 100); // Limit length
        let basename = `${dateStr} - ${safeSubject}`;
        
        let fullPath = normalizePath(`${folder}/${basename}.md`);
        let counter = 1;

        while (this.app.vault.getAbstractFileByPath(fullPath)) {
            fullPath = normalizePath(`${folder}/${basename} (${counter}).md`);
            counter++;
        }

        return fullPath;
    }

    private sanitizeFilename(name: string): string {
        // Remove illegal characters for file names (Windows/Unix safe)
        return name.replace(/[\\/:*?"<>|]/g, '-').trim();
    }

    private generateNoteContent(email: EmailMessage): string {
        const bodyMarkdown = this.markdownConverter.convert(email.bodyHtml);
        const dateFormatted = email.receivedAt.toLocaleString();
        
        // Safe subject for frontmatter (escape double quotes)
        const safeSubject = email.subject.split('"').join('\"');

        // Frontmatter
        const frontmatter = [
            '---',
            'tags: [all, para/inbox, email-task]',
            `created: ${email.receivedAt.toISOString().split('T')[0]}`,
            `email-source: ${email.source}`,
            `email-id: "${email.id}"`, 
            `email-from: "${email.from.email}"`, 
            `email-subject: "${safeSubject}"`, 
            `email-date: ${email.receivedAt.toISOString()}`,
            `email-link: "${email.webLink}"`, 
            `synced: ${new Date().toISOString()}`,
            '---'
        ].join('\n');

        // Note Body
        const content = [
            frontmatter,
            '',
            `# Subject: ${email.subject}`,
            '',
            `**From:** ${email.from.name} <${email.from.email}>`,
            `**Date:** ${dateFormatted}`,
            `**Source:** [View in ${email.source === 'gmail' ? 'Gmail' : 'Outlook'}](${email.webLink})`,
            '',
            '---',
            '',
            '## Email Content',
            '',
            bodyMarkdown,
            '',
            '---',
            '',
            '## Tasks',
            '',
            '- [ ] ',
            '',
            '## Notes',
            '',
            ''
        ].join('\n');

        return content;
    }
}
