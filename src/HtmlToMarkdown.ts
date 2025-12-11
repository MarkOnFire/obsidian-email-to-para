import TurndownService from 'turndown';

/**
 * Converts HTML content to Markdown using TurndownService.
 * This utility can be extended with more specific rules for email conversion.
 */
export class HtmlToMarkdown {
    private turndownService: TurndownService;

    constructor() {
        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            fence: '```',
            emDelimiter: '*', 
            strongDelimiter: '**',
            linkStyle: 'inlined',
            linkReferenceStyle: 'collapsed'
        });

        // Example custom rule: Strip script tags
        this.turndownService.remove('script');
        // Example: Preserve blockquotes (Turndown does this by default, but useful to know)
        // this.turndownService.addRule('blockquote', {
        //     filter: ['blockquote'],
        //     replacement: function (content) {
        //         return '> ' + content.split('\n').join('\n> ') + '\n\n';
        //     }
        // });

        // TODO: Implement rules for stripping email signatures
        // TODO: Implement rules for handling inline images (cid: references)
        // TODO: Implement rules for removing tracking pixels and invisible elements
        // TODO: Implement rules for handling tables more gracefully (Turndown has some table support)
    }

    /**
     * Converts an HTML string to a Markdown string.
     * @param html The HTML content to convert.
     * @returns The converted Markdown content.
     */
    convert(html: string): string {
        return this.turndownService.turndown(html);
    }
}
