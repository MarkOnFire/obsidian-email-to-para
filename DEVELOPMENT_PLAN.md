# Email to PARA - Development Plan

## Architecture Overview

```
Gmail/Outlook/iCloud → Forward Rules → inbox@yourdomain.com
                                              ↓
                              Cloudflare Email Worker (parse, format)
                                              ↓
                                    Cloudflare R2 Bucket
                                              ↓
                              Remotely Save Plugin (existing)
                                              ↓
                            Obsidian (Desktop, iOS, Android)
```

## Components

### 1. Cloudflare Email Worker (To Build)
A single JavaScript worker that:
- Receives forwarded emails via Cloudflare Email Routing
- Parses email headers (from, subject, date)
- Converts HTML body to Markdown
- Applies the email-task template
- Writes `.md` file to R2 bucket in `/INBOX/` folder

### 2. Cloudflare R2 Bucket (To Configure)
- Free tier: 10GB storage, 10M reads/month
- S3-compatible API
- Stores markdown files created by the Worker

### 3. Remotely Save Plugin (Existing)
- Already available in Obsidian community plugins
- Works on iOS, Android, and desktop
- Syncs R2 bucket ↔ local vault folder

### 4. Email Forwarding Rules (To Configure)
- Gmail: Filter for starred emails → forward
- Outlook: Rule for flagged emails → forward
- iCloud Mail: Rule for flagged emails → forward

---

## Implementation Steps

### Phase 1: Cloudflare Setup

#### Step 1.1: Enable Email Routing
- Add domain to Cloudflare (if not already)
- Enable Email Routing in Cloudflare dashboard
- Configure MX records (Cloudflare provides these)

#### Step 1.2: Create R2 Bucket
- Create bucket named `obsidian-inbox` (or similar)
- Generate API credentials (Access Key ID + Secret)
- Note the account ID and bucket endpoint

#### Step 1.3: Create Email Worker
Location: `worker/email-to-markdown.js`

```javascript
// Cloudflare Email Worker
// Receives forwarded emails, converts to markdown, writes to R2

export default {
  async email(message, env, ctx) {
    // 1. Parse email
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get('subject') || 'No Subject';
    const date = message.headers.get('date');
    const messageId = message.headers.get('message-id');

    // 2. Read email body
    const rawEmail = await new Response(message.raw).text();
    const { htmlBody, textBody } = parseEmailBody(rawEmail);

    // 3. Convert HTML to Markdown (or use text body)
    const emailBody = htmlBody
      ? htmlToMarkdown(htmlBody)
      : textBody || '';

    // 4. Detect source from forwarding headers
    const source = detectSource(message.headers);

    // 5. Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const safeSubject = sanitizeFilename(subject).slice(0, 50);
    const filename = `INBOX/${timestamp}-${safeSubject}.md`;

    // 6. Apply template
    const markdown = applyTemplate({
      created_date: new Date().toISOString(),
      from_email: extractEmail(from),
      from_name: extractName(from),
      subject: subject,
      email_date: date,
      email_id: messageId,
      source: source,
      original_link: '', // Can't link back to auth-required emails
      email_body: emailBody,
    });

    // 7. Write to R2
    await env.R2_BUCKET.put(filename, markdown, {
      httpMetadata: { contentType: 'text/markdown' },
    });

    console.log(`Created: ${filename}`);
  }
}

// Helper functions to implement:
// - parseEmailBody(raw) - extract HTML and text parts from MIME
// - htmlToMarkdown(html) - convert HTML to markdown
// - detectSource(headers) - detect Gmail/Outlook/iCloud from headers
// - sanitizeFilename(str) - remove invalid chars
// - extractEmail(from) - parse "Name <email>" format
// - extractName(from) - parse "Name <email>" format
// - applyTemplate(vars) - fill in template placeholders
```

#### Step 1.4: Deploy Worker
```bash
# Install wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create wrangler.toml configuration
# Deploy worker
wrangler deploy
```

#### Step 1.5: Connect Email Routing to Worker
- In Cloudflare dashboard: Email Routing → Routes
- Create route: `inbox@yourdomain.com` → Email Worker

---

### Phase 2: Email Provider Setup

#### Step 2.1: Gmail Forwarding Rule
1. Open Gmail → Settings → Filters and Blocked Addresses
2. Create filter:
   - Condition: `is:starred`
   - Action: Forward to `inbox@yourdomain.com`
3. Note: May need to verify forwarding address first

#### Step 2.2: Outlook Forwarding Rule
1. Open Outlook → Settings → Mail → Rules
2. Create rule:
   - Condition: "Flagged for follow up"
   - Action: Forward to `inbox@yourdomain.com`

#### Step 2.3: iCloud Mail Forwarding Rule
1. Open iCloud.com → Mail → Settings → Rules
2. Create rule:
   - Condition: "Is flagged"
   - Action: Forward to `inbox@yourdomain.com`

---

### Phase 3: Obsidian Setup

#### Step 3.1: Install Remotely Save Plugin
1. Open Obsidian → Settings → Community Plugins
2. Search for "Remotely Save"
3. Install and enable

#### Step 3.2: Configure R2 Connection
1. Open Remotely Save settings
2. Select "S3 or S3-compatible" as remote type
3. Enter:
   - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - Region: `auto`
   - Access Key ID: (from R2 API credentials)
   - Secret Access Key: (from R2 API credentials)
   - Bucket: `obsidian-inbox`
4. Test connection

#### Step 3.3: Configure Sync Settings
- Sync direction: Bidirectional (or pull-only if preferred)
- Sync interval: 5 minutes
- Folder to sync: Can be entire vault or just INBOX subfolder

#### Step 3.4: Repeat for Mobile
- Install Remotely Save on iOS/Android Obsidian
- Use same configuration
- Vault name must match exactly

---

## File Structure

```
obsidian-email-to-para/
├── worker/
│   ├── email-to-markdown.js    # Main Email Worker
│   ├── html-to-markdown.js     # HTML conversion utility
│   ├── email-parser.js         # MIME parsing utility
│   └── template.js             # Template application
├── templates/
│   ├── email-task-template.md  # Note template
│   └── inbox-template.md       # Original inbox template
├── docs/
│   ├── SETUP_CLOUDFLARE.md     # Cloudflare setup guide
│   ├── SETUP_EMAIL_RULES.md    # Email provider setup
│   └── SETUP_OBSIDIAN.md       # Remotely Save setup
├── wrangler.toml               # Worker configuration
├── package.json
└── DEVELOPMENT_PLAN.md         # This file
```

---

## Template Variables

The Email Worker will replace these placeholders in the template:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{created_date}}` | ISO timestamp when note created | `2025-01-15T10:30:00Z` |
| `{{from_email}}` | Sender email address | `john@example.com` |
| `{{from_name}}` | Sender display name | `John Smith` |
| `{{subject}}` | Email subject line | `Project Update` |
| `{{email_date}}` | Original email date | `Mon, 15 Jan 2025 10:00:00 -0600` |
| `{{email_id}}` | Message-ID header | `<abc123@mail.example.com>` |
| `{{source}}` | Detected source | `Gmail`, `Outlook`, or `iCloud` |
| `{{original_link}}` | Link to original (empty - not possible) | `` |
| `{{email_body}}` | Markdown-converted body | `Hello,\n\nHere's the update...` |

---

## Cost Analysis

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| Cloudflare Email Routing | 100,000 emails/day | <100/day | $0 |
| Cloudflare Workers | 100,000 requests/day | <100/day | $0 |
| Cloudflare R2 Storage | 10 GB | <1 GB | $0 |
| Cloudflare R2 Operations | 10M Class B/month | <10K/month | $0 |
| **Total** | | | **$0** |

---

## Testing Plan

### Unit Tests
- [ ] HTML to Markdown conversion
- [ ] Email header parsing
- [ ] Template variable substitution
- [ ] Filename sanitization

### Integration Tests
- [ ] Send test email from Gmail → verify note created
- [ ] Send test email from Outlook → verify note created
- [ ] Send test email from iCloud → verify note created
- [ ] Verify Remotely Save syncs to desktop
- [ ] Verify Remotely Save syncs to iOS

### Edge Cases
- [ ] Email with no subject
- [ ] Email with special characters in subject
- [ ] Email with only HTML body (no text)
- [ ] Email with only text body (no HTML)
- [ ] Email with inline images
- [ ] Email with attachments (verify names listed)
- [ ] Very long email body
- [ ] Email with non-ASCII characters

---

## Future Enhancements (Out of Scope for v1)

1. **Attachment Storage**: Option to save attachments to R2 with links
2. **AI Summarization**: Use Workers AI to summarize long emails
3. **Smart Categorization**: Auto-tag based on sender/content
4. **Duplicate Detection**: Skip if email already processed
5. **Custom Templates**: Per-sender or per-source templates
6. **Web Dashboard**: View processed emails, retry failures

---

## Timeline

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1 | Cloudflare setup + Email Worker | Core implementation |
| Phase 2 | Email provider rules | Configuration |
| Phase 3 | Obsidian + Remotely Save | Configuration |
| Testing | End-to-end verification | Validation |

---

## Dependencies

### Worker Dependencies
- `postal-mime` - MIME email parsing (or similar)
- `turndown` - HTML to Markdown (may need bundling for Workers)

### Cloudflare Requirements
- Domain with Cloudflare DNS: `bymarkriechers.com` ✓
- Email Routing enabled
- R2 bucket created
- Workers enabled (free tier)

### Obsidian Requirements
- Remotely Save plugin installed
- Same vault name across devices
