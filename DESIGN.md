# Email to PARA Sync Plugin - Technical Design Document

## Overview

The Email to PARA Sync plugin automatically monitors starred emails in Gmail and flagged emails in Outlook, creating Obsidian notes in your PARA inbox folder with the full email content, metadata, and links back to the original message.

**Version:** 1.0.0
**Status:** Design Phase
**Author:** Mark Riechers
**Date:** 2025-11-13

## Problem Statement

Email inboxes become black holes for tasks and action items. Users star/flag important emails but:
- Tasks get lost in email threads
- No integration with personal knowledge management systems
- Can't apply PARA organization to email-based tasks
- Requires manual copy-paste to create notes from emails
- Loses context when switching between email and note-taking

## Solution

A custom Obsidian plugin that:
1. Authenticates with Gmail and Outlook via OAuth 2.0
2. Checks for starred/flagged emails every 30 minutes
3. Creates markdown notes in the PARA inbox with full email content
4. Preserves email metadata and links for reference
5. Integrates seamlessly with existing auto-para-tagger plugin
6. Provides manual sync option via ribbon icon

## User Workflow

### Initial Setup
1. User enables plugin in Obsidian settings
2. User clicks "Connect Gmail" button → OAuth flow opens in browser
3. User grants read-only access to Gmail
4. User clicks "Connect Outlook" button → OAuth flow opens in browser
5. User grants read-only access to Outlook
6. Plugin begins background sync every 30 minutes

### Daily Usage
1. User receives important email in Gmail/Outlook
2. User stars email (Gmail) or flags email (Outlook)
3. Within 30 minutes, plugin creates note in `0 - INBOX/` folder
4. Note contains full email content, metadata, link to original
5. Auto-para-tagger automatically adds `para/inbox` tag
6. User processes note like any other inbox item:
   - Add tasks using Obsidian Tasks syntax
   - Add notes and context
   - Move to appropriate PARA folder when ready
   - Archive when complete

### Manual Sync
1. User stars/flags urgent email
2. User clicks ribbon icon (envelope with sync arrows)
3. Plugin immediately checks both email accounts
4. New notes created within seconds

## Technical Architecture

### Components

```
email-to-para-sync/
├── main.js                 # Plugin entry point, settings UI, sync orchestration
├── manifest.json           # Plugin metadata
├── gmail-client.js         # Gmail API integration
├── outlook-client.js       # Microsoft Graph API integration
├── email-processor.js      # Email parsing and markdown conversion
├── note-creator.js         # Obsidian note generation
├── auth-manager.js         # OAuth 2.0 flows and token management
├── state-manager.js        # Sync state persistence
├── DESIGN.md              # This document
├── CODE_REVIEW_REQUEST.md # Code review questions
├── SUMMARY.md             # High-level overview
└── README.md              # User documentation
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Timer (30 min interval) OR Manual Sync (ribbon click)      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  main.js: syncEmails()                                       │
│  - Check if accounts are authenticated                       │
│  - Load sync state (previously synced email IDs)             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├──────────────────────┬──────────────────────┐
                  ▼                      ▼                      ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────┐
│  gmail-client.js        │ │  outlook-client.js      │ │  state-manager.js   │
│  getStarredEmails()     │ │  getFlaggedEmails()     │ │  getSyncedEmailIds()│
│  - Refresh OAuth token  │ │  - Refresh OAuth token  │ │  - Read .sync-state │
│  - Query Gmail API      │ │  - Query Graph API      │ └─────────────────────┘
│  - Return email objects │ │  - Return email objects │
└─────────────────┬───────┘ └─────────────┬───────────┘
                  │                       │
                  └───────────┬───────────┘
                              ▼
                  ┌─────────────────────────────────┐
                  │  Filter out already-synced IDs  │
                  │  (compare with state-manager)   │
                  └─────────────┬───────────────────┘
                                │
                                ▼
                  ┌─────────────────────────────────┐
                  │  For each new email:            │
                  └─────────────┬───────────────────┘
                                │
                                ▼
                  ┌─────────────────────────────────┐
                  │  email-processor.js             │
                  │  processEmail(rawEmail)         │
                  │  - Extract metadata             │
                  │  - Convert HTML → Markdown      │
                  │  - Generate email link          │
                  │  - Return processed object      │
                  └─────────────┬───────────────────┘
                                │
                                ▼
                  ┌─────────────────────────────────┐
                  │  note-creator.js                │
                  │  createNote(processedEmail)     │
                  │  - Generate filename            │
                  │  - Build frontmatter            │
                  │  - Build note content           │
                  │  - Write to 0 - INBOX/ folder   │
                  └─────────────┬───────────────────┘
                                │
                                ▼
                  ┌─────────────────────────────────┐
                  │  state-manager.js               │
                  │  addSyncedEmail(source, id)     │
                  │  - Update .sync-state file      │
                  │  - Persist to disk              │
                  └─────────────────────────────────┘
```

## API Integration Details

### Gmail API

**OAuth 2.0 Configuration:**
- Scopes: `https://www.googleapis.com/auth/gmail.readonly`
- Auth endpoint: `https://accounts.google.com/o/oauth2/v2/auth`
- Token endpoint: `https://oauth2.googleapis.com/token`
- Flow: PKCE (no client secret needed for desktop apps)

**API Calls:**
```javascript
// List starred emails (100 IDs per page)
GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:starred&pageToken=<optional>

// Get email details
GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{messageId}?format=full
```

**Response Structure:**
```json
{
  "id": "msg_abc123",
  "threadId": "thread_xyz789",
  "labelIds": ["STARRED", "INBOX"],
  "snippet": "Email preview text...",
  "payload": {
    "headers": [
      {"name": "From", "value": "sender@example.com"},
      {"name": "Subject", "value": "Email subject"},
      {"name": "Date", "value": "Wed, 13 Nov 2025 10:45:00 -0500"}
    ],
    "body": {
      "data": "base64_encoded_html_content"
    }
  },
  "internalDate": "1731508000000"
}
```

**Pagination & Incremental Sync:**
- Gmail includes a `nextPageToken` in `messages.list` when more results exist; loop until the token is absent or the per-sync processing limit (configurable, default 500) is reached.
- Persist the most recent `historyId` returned by `messages.get` in `.sync-state.json`. When available, call `users.history.list` with that ID to fetch only STARRED label deltas instead of scanning the entire starred set.
- Respect HTTP 429/503 responses by backing off exponentially and persisting the retry timestamp so both manual and automatic sync honor it.

**Gmail Web Link Format:**
```
https://mail.google.com/mail/u/0/#inbox/{messageId}
```

### Microsoft Graph API (Outlook)

**OAuth 2.0 Configuration:**
- Scopes: `https://graph.microsoft.com/Mail.Read`
- Auth endpoint: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Token endpoint: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- Flow: PKCE (no client secret needed)

**API Calls:**
```javascript
// List flagged emails (request 50 at a time)
GET https://graph.microsoft.com/v1.0/me/messages?$filter=flag/flagStatus eq 'flagged'&$top=50

// Get specific email
GET https://graph.microsoft.com/v1.0/me/messages/{messageId}
```

**Response Structure:**
```json
{
  "id": "msg_def456",
  "subject": "Email subject",
  "from": {
    "emailAddress": {
      "name": "Sender Name",
      "address": "sender@example.com"
    }
  },
  "receivedDateTime": "2025-11-13T10:45:00Z",
  "body": {
    "contentType": "html",
    "content": "<html>Email body...</html>"
  },
  "flag": {
    "flagStatus": "flagged"
  },
  "webLink": "https://outlook.office365.com/mail/inbox/id/msg_def456"
}
```

**Outlook Web Link:**
- Provided directly in `webLink` field of API response

**Pagination & Throttling:**
- Graph returns an `@odata.nextLink` whenever more flagged messages exist; keep fetching until it is absent, honoring `$top` caps.
- Check for `Retry-After` headers or error responses with `throttleLimit` details and pause syncing for the suggested duration. Persist the `retryAfter` timestamp in sync state so manual syncs avoid hammering the API.
- Outlook's default page size is 10, so explicitly setting `$top` keeps the number of requests predictable.

## Data Models

### Email Object (Internal Representation)

```javascript
{
  source: "gmail" | "outlook",
  id: "msg_abc123",
  subject: "Email subject line",
  from: {
    name: "Sender Name",
    email: "sender@example.com"
  },
  date: Date,                    // JavaScript Date object
  bodyHtml: "<html>...</html>",  // Raw HTML body
  bodyMarkdown: "# Content...",  // Converted markdown
  webLink: "https://...",        // Link to view in web client
  snippet: "Preview text..."     // Short preview (optional)
}
```

### Sync State File (`.sync-state.json`)

**Location:** `.obsidian/plugins/email-to-para-sync/.sync-state.json`

```json
{
  "version": "1.0.0",
  "lastSync": "2025-11-13T10:30:00Z",
  "syncedEmails": {
    "gmail": [
      "msg_abc123",
      "msg_def456"
    ],
    "outlook": [
      "msg_ghi789",
      "msg_jkl012"
    ]
  }
}
```

### Plugin Settings

**Location:** `.obsidian/plugins/email-to-para-sync/data.json`

```json
{
  "version": "1.0.0",
  "gmail": {
    "enabled": true,
    "authenticated": true,
    "userEmail": "user@gmail.com",
    "accessToken": "encrypted_or_stored_securely",
    "refreshToken": "encrypted_or_stored_securely",
    "tokenExpiry": "2025-11-14T10:30:00Z"
  },
  "outlook": {
    "enabled": true,
    "authenticated": true,
    "userEmail": "user@outlook.com",
    "accessToken": "encrypted_or_stored_securely",
    "refreshToken": "encrypted_or_stored_securely",
    "tokenExpiry": "2025-11-14T10:30:00Z"
  },
  "sync": {
    "intervalMinutes": 30,
    "autoSync": true,
    "inboxFolder": "0 - INBOX",
    "includeEmailBody": true
  }
}
```

## Note Generation

### Filename Convention

**Format:** `YYYY-MM-DD - [Subject].md`

**Rules:**
- Date is email received date, not sync date
- Subject truncated to 100 characters max
- Invalid filename characters replaced with `-`
- Duplicate filenames get numeric suffix: `(1)`, `(2)`, etc.

**Examples:**
```
2025-11-13 - Follow up on Q4 budget review.md
2025-11-12 - Meeting notes from client call.md
2025-11-11 - Action items from team standup (1).md
```

### Note Template

```markdown
---
tags: [all, para/inbox, email-task]
created: YYYY-MM-DD
email-source: gmail | outlook
email-id: "msg_abc123"
email-from: "sender@example.com"
email-subject: "Original Subject Line"
email-date: YYYY-MM-DD
email-link: "https://mail.google.com/mail/u/0/#inbox/msg_abc123"
synced: YYYY-MM-DDTHH:MM:SSZ
---

# Subject: [Email Subject]

**From:** [Sender Name] <sender@example.com>
**Date:** [Formatted Date - November 13, 2025 10:45 AM]
**Source:** [View in Gmail](https://mail.google.com/mail/u/0/#inbox/msg_abc123)

---

## Email Content

[Full email body converted from HTML to markdown]

[Quoted replies and forward history preserved]

---

## Tasks

- [ ]

## Notes


```

### Frontmatter Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `tags` | Array | Always includes `all`, `para/inbox`, `email-task` | `[all, para/inbox, email-task]` |
| `created` | Date | Email received date (not sync date) | `2025-11-13` |
| `email-source` | String | Source email provider | `gmail` or `outlook` |
| `email-id` | String | Provider's message ID for deduplication | `msg_abc123` |
| `email-from` | String | Sender email address | `sender@example.com` |
| `email-subject` | String | Original email subject | `Follow up on Q4 budget` |
| `email-date` | Date | Email received date (ISO format) | `2025-11-13` |
| `email-link` | URL | Link to view email in web client | `https://mail.google.com/...` |
| `synced` | DateTime | When plugin created this note | `2025-11-13T10:30:00Z` |

### HTML to Markdown Conversion

**Library:** Use TurndownJS or similar HTML-to-markdown converter

**Conversion Rules:**
- Headings: `<h1>` → `# Heading`
- Bold: `<strong>` → `**bold**`
- Italic: `<em>` → `*italic*`
- Links: `<a href="url">text</a>` → `[text](url)`
- Lists: `<ul>`, `<ol>` → markdown lists
- Blockquotes: `<blockquote>` → `> quote`
- Code: `<code>` → `` `code` ``
- Images: `<img src="url">` → `![](url)` (or inline data URLs)
- Tables: `<table>` → markdown tables
- Line breaks: `<br>` → double space + newline

**Email-Specific Handling:**
- Strip email signatures (optional, configurable)
- Preserve quoted reply structure with blockquotes
- Remove tracking pixels and invisible elements
- Handle inline images (convert to links or embed as data URLs)
- Preserve email threading context
- Recursively walk MIME trees: choose `text/html` if available, fall back to `text/plain`. Gmail often nests the desired part in `payload.parts`, so the parser must ignore `multipart/mixed` containers and skip attachment parts (`body.attachmentId` present).
- Detect attachments and list them in the metadata block (e.g., `Attachments: 2 files (not downloaded)`), but defer actual downloads to a future release to avoid large vault writes.
- Resolve inline `cid:` references by mapping them to their attachment metadata so they can be represented as inline placeholders instead of broken links.

**Example:**

**Input HTML:**
```html
<div>
  <p>Hi Mark,</p>
  <p>Here are the <strong>action items</strong> from our call:</p>
  <ul>
    <li>Review Q4 budget</li>
    <li>Schedule follow-up meeting</li>
  </ul>
  <p>Best,<br>John</p>
</div>
```

**Output Markdown:**
```markdown
Hi Mark,

Here are the **action items** from our call:

- Review Q4 budget
- Schedule follow-up meeting

Best,
John
```

## Authentication & Security

### OAuth 2.0 PKCE Flow

**Why PKCE?**
- No client secret required (secure for desktop apps)
- Code verifier prevents authorization code interception
- Standard for native/desktop applications

**Flow Steps:**

1. **Generate Code Verifier & Challenge**
   ```javascript
   const codeVerifier = generateRandomString(128)
   const codeChallenge = base64UrlEncode(sha256(codeVerifier))
   ```

2. **Authorization Request**
   - Open browser to OAuth provider
   - Include `code_challenge` and `code_challenge_method=S256`
   - User grants permissions

3. **Authorization Code Callback**
   - OAuth provider redirects to `http://localhost:PORT/callback`
   - Plugin captures authorization code

4. **Token Exchange**
   - Send authorization code + code verifier
   - Receive access token and refresh token

5. **Callback Handling**
   - Plugin spins up a temporary loopback HTTP server bound to `127.0.0.1:0` (OS assigns a free port) before launching the auth URL.
   - Redirect URIs registered with each provider follow the loopback pattern (`http://127.0.0.1:{port}/oauth/{provider}`) so the authorization code is delivered directly to the plugin, then the server shuts down immediately after success or after a 2-minute timeout.
   - When the listener fails to bind (port in use, firewall, mobile), display guidance and fall back to an OAuth device-code flow that shows the verification URL + code and polls until the user approves access.
   - Error notices should distinguish between browser rejection, callback failure, and token-exchange issues to reduce support load.

6. **Store Tokens Securely**
   - Keep access tokens in memory only; never write them to disk.
   - Persist refresh tokens via the OS keychain when available, or encrypt them with a user-provided passphrase before saving to `data.json`.

### Token Management

**Access Token Lifecycle:**
- Gmail: Expires after 1 hour
- Outlook: Expires after 1 hour
- Check expiry before each API call
- Auto-refresh if expired

**Refresh Token:**
- Stored securely in plugin settings
- Used to obtain new access tokens
- Never expires (unless user revokes access)

**Token Refresh Logic:**
```javascript
async function getValidAccessToken(provider) {
  const settings = this.settings[provider]
  const now = new Date()

  if (now >= new Date(settings.tokenExpiry)) {
    // Token expired, refresh it
    const newTokens = await refreshAccessToken(provider, settings.refreshToken)
    settings.accessToken = newTokens.accessToken
    settings.tokenExpiry = newTokens.expiresAt
    await this.saveSettings()
  }

  return settings.accessToken
}
```

### Security Considerations

**Token Storage:**
- Access tokens remain in memory; never persist them to disk.
- Refresh tokens are written to the host OS keychain (macOS Keychain, Windows Credential Locker, libsecret) via the Obsidian Electron bridge, and `data.json` only stores a stable identifier to retrieve them.
- When the keychain API is unavailable, prompt the user for a vault-specific passphrase, derive an AES-256-GCM key, and store only the ciphertext + nonce in `data.json`. Without a keychain or passphrase the plugin refuses to save refresh tokens and disables auto-sync.
- README and settings must warn that syncing `.obsidian` to Git/iCloud is safe because only encrypted blobs leave the machine, but OAuth client IDs/secrets should still be private.

**API Permissions:**
- Request minimal scopes: read-only access to emails
- Gmail: `gmail.readonly` (not `gmail.modify`)
- Outlook: `Mail.Read` (not `Mail.ReadWrite`)

**OAuth App Registration:**
- User must register their own OAuth apps (Gmail/Outlook)
- Plugin README provides step-by-step registration guide
- User provides Client ID (no Client Secret needed for PKCE)

**Network Security:**
- All API calls over HTTPS
- Validate SSL certificates
- Handle network errors gracefully

## Sync Logic

### Deduplication Strategy

**State Tracking:**
- Maintain list of synced email IDs in `.sync-state.json`
- Compare API results against synced IDs
- Only process new emails not in state file

**Why Email ID Instead of Subject?**
- Subjects can be identical (e.g., "Follow up")
- Email IDs are unique and persistent
- Prevents duplicate notes from same email

**Edge Cases:**
- User deletes note manually → email won't re-sync (by design)
- User un-stars/un-flags email → note remains (per requirements)
- Email ID changes (rare) → would create duplicate (acceptable)
- Provide a "Re-import email…" command palette action that prompts for a Gmail/Outlook message ID, removes it from `.sync-state.json`, and immediately reprocesses it for recovery scenarios.
- Add a "Reset sync state" button in settings (with confirmation) that clears the cached IDs and fetches only the last N starred/flagged emails (default 20) so vault migrations don't redownload everything.
- Store `processedAt` timestamps with each ID so very old entries (e.g., >90 days) can be pruned automatically without risking duplicate imports for recent emails.

### Sync Interval

**Default:** 30 minutes

**Implementation:**
```javascript
let syncIntervalId = null

function startAutoSync() {
  if (this.settings.sync.autoSync) {
    syncIntervalId = setInterval(
      () => this.syncEmails(),
      this.settings.sync.intervalMinutes * 60 * 1000
    )
  }
}

function stopAutoSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
}
```

**User Controls:**
- Enable/disable auto-sync in settings
- Adjust interval (15, 30, 60 minutes)
- Manual sync always available via ribbon icon

### Error Handling

**Network Errors:**
- Retry with exponential backoff (3 attempts)
- Log error to console, show notice to user
- Don't block other emails if one fails

**Authentication Errors:**
- Token expired → auto-refresh
- Refresh token invalid → prompt user to re-authenticate
- Show clear error message in settings UI

**API Rate Limits:**
- Gmail: 250 quota units/user/second, 1 billion/day
- Outlook: 10,000 requests/10 minutes
- Both are generous for our use case
- Implement basic rate limiting just in case

**File System Errors:**
- Filename conflicts → add numeric suffix
- Folder doesn't exist → create `0 - INBOX/` automatically
- Disk full → log error, show notice

**Malformed Emails:**
- Missing subject → use "(No Subject)"
- Missing body → create note with metadata only
- Invalid HTML → fallback to plain text or raw HTML

## User Interface

### Settings Tab

**Account Management Section:**

```
┌─────────────────────────────────────────────────────────┐
│  Gmail                                                   │
│  ○ Enabled                                              │
│                                                          │
│  Status: ✓ Connected as user@gmail.com                 │
│  Last sync: November 13, 2025 10:30 AM                 │
│                                                          │
│  [Disconnect]  [Reconnect]                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Outlook                                                 │
│  ○ Enabled                                              │
│                                                          │
│  Status: ✗ Not connected                               │
│                                                          │
│  [Connect Outlook]                                      │
└─────────────────────────────────────────────────────────┘
```

**Sync Settings Section:**

```
┌─────────────────────────────────────────────────────────┐
│  Sync Settings                                           │
│                                                          │
│  ○ Enable automatic sync                               │
│                                                          │
│  Sync interval: [30 ▼] minutes                         │
│                                                          │
│  Inbox folder: [0 - INBOX]                             │
│  (Notes will be created in this folder)                │
│                                                          │
│  ○ Include full email body in notes                    │
│  (If disabled, only metadata and link will be saved)   │
└─────────────────────────────────────────────────────────┘
```

**OAuth Setup Instructions:**

```
┌─────────────────────────────────────────────────────────┐
│  Setup Instructions                                      │
│                                                          │
│  Before connecting accounts, you need to register       │
│  OAuth applications. See README.md for detailed steps.  │
│                                                          │
│  Quick links:                                           │
│  • Gmail OAuth Setup: https://console.cloud.google.com │
│  • Outlook OAuth Setup: https://portal.azure.com       │
└─────────────────────────────────────────────────────────┘
```

### Ribbon Icon

**Icon:** Envelope with circular arrows (sync symbol)

**Tooltip:** "Sync starred/flagged emails"

**Click Behavior:**
1. Show notice: "Syncing emails..."
2. Execute sync for all enabled accounts
3. Show notice with results:
   - "Synced 3 new emails (2 Gmail, 1 Outlook)"
   - "No new emails to sync"
   - "Sync failed: [error message]"

### Status Bar (Optional)

**Display:** Last sync timestamp

**Example:** `Email sync: 2 min ago`

**Click Behavior:** Open settings tab

## Testing Strategy

### Unit Tests

**Mock API Responses:**
- Create fixture data for Gmail and Outlook responses
- Test email parsing with various HTML structures
- Test markdown conversion edge cases

**Test Cases:**
1. Parse Gmail API response correctly
2. Parse Outlook API response correctly
3. Convert simple HTML to markdown
4. Convert complex HTML (tables, images, nested lists)
5. Handle malformed HTML gracefully
6. Generate correct filename from subject
7. Handle filename conflicts with numeric suffix
8. Detect already-synced emails
9. Update sync state after processing

### Integration Tests

**Real API Calls (Manual Testing):**
1. Authenticate with Gmail → verify token stored
2. Authenticate with Outlook → verify token stored
3. Star email in Gmail → verify note created
4. Flag email in Outlook → verify note created
5. Un-star email → verify note remains unchanged
6. Sync same email twice → verify no duplicate note
7. Manual sync via ribbon → verify immediate sync
8. Auto-sync after 30 min → verify background sync
9. Token expiry → verify auto-refresh works
10. Disconnect account → verify sync stops

### User Acceptance Testing

**Workflow Tests:**
1. New user setup flow (OAuth registration, connection)
2. Daily usage (star email, verify note appears)
3. Task management (add tasks to synced email note)
4. PARA organization (move synced note to project folder)
5. Settings changes (disable account, change interval)
6. Error recovery (network failure, re-authentication)

## Future Enhancements

**Version 1.1+:**
- **Smart folder routing:** Automatically detect project mentions in email and route to appropriate PARA folder
- **Email thread reconstruction:** Link notes from same email thread
- **Attachment handling:** Download and embed email attachments
- **Label/folder filtering:** Sync emails from specific Gmail labels or Outlook folders
- **Bi-directional sync:** Mark email as done when note is archived in Obsidian
- **Template customization:** User-defined note templates
- **Search integration:** Search email content from within Obsidian
- **Conflict resolution:** Handle case where email changes after sync
- **Bulk import:** One-time import of all starred/flagged emails
- **Statistics dashboard:** Show sync history, email counts, etc.

**Version 2.0+:**
- **Multi-account support:** Multiple Gmail/Outlook accounts
- **Other email providers:** iCloud Mail, ProtonMail, etc.
- **Mobile support:** iOS/Android OAuth flows
- **Encrypted email support:** Handle S/MIME and PGP emails
- **Calendar integration:** Sync meeting invites as meeting notes
- **Task extraction:** Auto-detect action items in emails and create Obsidian tasks

## Open Questions

See `CODE_REVIEW_REQUEST.md` for specific implementation questions requiring review.

## References

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Microsoft Graph Mail API](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [OAuth 2.0 PKCE Flow](https://oauth.net/2/pkce/)
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [TurndownJS Documentation](https://github.com/mixmark-io/turndown)
- [PARA Method](https://fortelabs.com/blog/para/)
