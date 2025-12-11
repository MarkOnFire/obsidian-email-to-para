# Email to PARA Sync Plugin - Summary

## What It Does

Automatically syncs starred Gmail emails and flagged Outlook emails into your Obsidian vault as fully-formatted markdown notes in your PARA inbox folder.

## The Problem

- Important emails get lost in inbox clutter
- Starring/flagging emails doesn't integrate with your task management system
- Manual copy-paste from email to Obsidian is tedious
- Email tasks live in a separate silo from your PARA workflow

## The Solution

A plugin that:
1. Monitors your Gmail (starred) and Outlook (flagged) emails
2. Automatically creates notes in `0 - INBOX/` every 30 minutes
3. Converts email HTML to clean markdown
4. Includes full email content, metadata, and link to original
5. Integrates with your existing auto-para-tagger workflow

## How It Works

```
Star email in Gmail
         ↓
Wait 30 min (or click manual sync button)
         ↓
Plugin creates note in 0 - INBOX/
         ↓
Auto-para-tagger adds para/inbox tag
         ↓
Process like any other inbox item
         ↓
Move to appropriate PARA folder when ready
```

## Example Note Generated

**Filename:** `2025-11-13 - Follow up on Q4 budget review.md`

**Content:**
```markdown
---
tags: [all, para/inbox, email-task]
created: 2025-11-13
email-source: gmail
email-from: "manager@company.com"
email-subject: "Follow up on Q4 budget review"
email-link: "https://mail.google.com/mail/u/0/#inbox/abc123"
---

# Subject: Follow up on Q4 budget review

**From:** Manager Name <manager@company.com>
**Date:** November 13, 2025 10:45 AM
**Source:** [View in Gmail](https://mail.google.com/...)

---

## Email Content

Hi Mark,

Can you review the **Q4 budget** projections and send me your
feedback by Friday? Key areas to focus on:

- Marketing spend allocation
- Engineering headcount
- Infrastructure costs

Thanks!

---

## Tasks

- [ ] Review Q4 budget projections 📅 2025-11-15

## Notes

[Your notes here]
```

## Key Features

### Automatic Sync with Incremental Updates
- Checks for new starred/flagged emails every 30 minutes
- **Incremental sync:** Gmail uses `historyId` to fetch only new/changed starred emails (not full scan)
- **Pagination:** Processes up to 500 emails per sync, handles large inboxes gracefully
- **Rate limiting:** Respects API throttling with exponential backoff
- Ribbon button for immediate manual sync
- Deduplication prevents syncing same email twice

### Enterprise-Grade Security
- **OAuth 2.0 PKCE** authentication with Gmail and Outlook
- **Loopback server** for callback, with device-code fallback for restrictive networks
- **Access tokens** kept in memory only (never written to disk)
- **Refresh tokens** stored in OS keychain (macOS Keychain, Windows Credential Manager)
- **Fallback encryption:** AES-256-GCM with user passphrase if keychain unavailable
- Read-only access (plugin can't modify your emails)

### Smart Email Processing
- **Full HTML-to-markdown conversion** with TurndownJS
- **MIME parsing:** Recursive walk of email parts to extract HTML/plaintext
- **Attachment handling:** Lists attachments in metadata (downloads deferred to v2.0)
- **Inline images:** Resolves `cid:` references to attachment placeholders
- Preserves formatting: bold, italic, lists, links, tables, blockquotes
- Includes email body, sender info, date, subject
- Direct link to view original email in web client

### PARA Integration
- Notes created in `0 - INBOX/` folder
- Auto-para-tagger automatically adds `para/inbox` tag
- Move to projects/areas/resources as needed
- Un-starring/un-flagging doesn't affect notes (notes are independent)

### Advanced Recovery Features
- **Re-import email:** Command palette action to re-process specific email by ID
- **Reset sync state:** Clear state and fetch only last 20 starred/flagged emails
- **Auto-pruning:** Sync state automatically removes entries older than 90 days

## Setup Requirements

### One-Time Setup (30 minutes)
1. Register OAuth app with Google Cloud Console (for Gmail)
2. Register OAuth app with Microsoft Azure Portal (for Outlook)
3. Install plugin in Obsidian
4. Connect Gmail account via settings
5. Connect Outlook account via settings

### Daily Usage (Zero Effort)
1. Star important email in Gmail (or flag in Outlook)
2. Note appears in Obsidian inbox within 30 minutes
3. Process as normal PARA inbox item

## Technical Details

**APIs Used:**
- Gmail API v1 (read-only scope, `gmail.readonly`)
- Microsoft Graph Mail API (read-only scope, `Mail.Read`)

**Authentication:**
- OAuth 2.0 PKCE flow (no client secret needed)
- Loopback HTTP server on `127.0.0.1:0` (random port)
- Device-code flow fallback for firewall/mobile scenarios
- Automatic token refresh with exponential backoff
- OS keychain storage for refresh tokens (AES-256-GCM fallback)

**Sync Logic:**
- 30-minute interval (configurable)
- **Incremental sync:** Gmail `historyId` API for delta changes only
- **Pagination:** 100 IDs/page (Gmail), 50 messages/page (Outlook)
- **Processing limit:** 500 emails max per sync cycle
- **Rate limiting:** HTTP 429/503 handled with backoff + persisted retry timestamps
- State file tracks synced email IDs with `processedAt` timestamps
- Auto-prunes entries older than 90 days
- No duplicate notes created
- Un-starring doesn't delete notes

**Email Processing:**
- **MIME parsing:** Recursive walk of `payload.parts` to find `text/html` or `text/plain`
- **Attachment detection:** Lists in metadata, skips `body.attachmentId` parts
- **Inline image resolution:** Maps `cid:` references to placeholders
- HTML converted to markdown with TurndownJS
- Email metadata preserved in frontmatter
- Links to original email in web client
- Filename: `YYYY-MM-DD - [Subject].md`

## Comparison to Alternatives

### Manual Copy-Paste
- **Plugin:** Automatic, zero effort after setup
- **Manual:** Tedious, error-prone, time-consuming

### Email Forwarding to Obsidian
- **Plugin:** Full HTML conversion, clean markdown
- **Forward:** Plain text only, loses formatting

### IFTTT/Zapier Integration
- **Plugin:** Free, no external dependencies, offline
- **IFTTT:** Paid, requires internet, less control

### Browser Extension
- **Plugin:** Native to Obsidian, automatic sync
- **Extension:** Requires browser, manual trigger

## Limitations (v1.0)

- One Gmail account, one Outlook account (multi-account in v2.0)
- Desktop primary (device-code flow provides mobile compatibility with manual steps)
- No attachment downloads (metadata listed, downloads in v2.0)
- No bi-directional sync (can't update email from Obsidian)
- No smart folder routing (all notes go to inbox)
- 500 email processing limit per sync (configurable, prevents UI blocking)

## Future Enhancements

**Version 1.1:**
- Configurable sync interval (15, 30, 60 minutes)
- Email body truncation options for long emails
- Custom inbox folder path
- Sync statistics dashboard

**Version 2.0:**
- Multi-account support (multiple Gmail/Outlook accounts)
- Smart folder routing based on email content
- Email attachment downloads
- Bi-directional sync (mark email as done when note archived)
- Mobile support (iOS/Android OAuth)

## File Structure

```
custom-extensions/plugins/email-to-para-sync/
├── main.js                    # Plugin core logic
├── gmail-client.js            # Gmail API integration
├── outlook-client.js          # Microsoft Graph API
├── email-processor.js         # HTML to markdown conversion
├── note-creator.js            # Obsidian note generation
├── auth-manager.js            # OAuth flows and tokens
├── state-manager.js           # Sync state tracking
├── manifest.json              # Plugin metadata
├── DESIGN.md                  # Technical specification (40+ pages)
├── CODE_REVIEW_REQUEST.md     # Implementation questions (17 items)
├── SUMMARY.md                 # This document
└── README.md                  # User setup guide
```

## Status

**Current Phase:** Design & Code Review

**Next Steps:**
1. Code review by `code-reviewer` agent
2. Address review feedback
3. Implementation (~10-15 hours)
4. Testing with real Gmail/Outlook accounts
5. Deployment to vault
6. User acceptance testing

**Estimated Timeline:**
- Code review: 1-2 hours
- Implementation: 10-15 hours (spread over 1-2 weeks)
- Testing: 1 week
- Deployment: 1 hour
- **Total: ~3 weeks to production**

## Questions?

See `CODE_REVIEW_REQUEST.md` for detailed implementation questions requiring review before development begins.

See `DESIGN.md` for comprehensive technical specification including API integration details, data models, security considerations, and testing strategy.

See `README.md` for user-facing setup instructions and troubleshooting guide.
