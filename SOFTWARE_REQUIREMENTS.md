# Email to PARA Sync Plugin - Software Requirements Specification

**Version:** 1.0.0
**Date:** 2025-11-13
**Author:** Mark Riechers
**Status:** Design Phase

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Interface Requirements](#5-interface-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Security Requirements](#7-security-requirements)
8. [Performance Requirements](#8-performance-requirements)
9. [Quality Attributes](#9-quality-attributes)
10. [Constraints and Assumptions](#10-constraints-and-assumptions)
11. [Dependencies](#11-dependencies)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for the Email to PARA Sync plugin, an Obsidian plugin that automatically synchronizes starred Gmail emails and flagged Outlook emails into a PARA-method organized knowledge vault.

### 1.2 Scope

The plugin will:
- Authenticate with Gmail and Outlook via OAuth 2.0
- Monitor for starred/flagged emails
- Convert email content to markdown notes
- Integrate with existing PARA folder structure
- Provide manual and automatic sync capabilities
- Maintain sync state and prevent duplicates

The plugin will NOT:
- Modify or delete emails in email providers
- Download email attachments (v1.0)
- Provide bi-directional sync (v1.0)
- Support multiple accounts per provider (v1.0)

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| PARA | Projects, Areas, Resources, Archive organizational method |
| OAuth | Open Authorization standard for secure API access |
| PKCE | Proof Key for Code Exchange (OAuth security extension) |
| MIME | Multipurpose Internet Mail Extensions |
| API | Application Programming Interface |
| SRS | Software Requirements Specification |
| MVP | Minimum Viable Product |

### 1.4 References

- OAuth 2.0 RFC 6749: https://tools.ietf.org/html/rfc6749
- OAuth 2.0 PKCE RFC 7636: https://tools.ietf.org/html/rfc7636
- Gmail API Documentation: https://developers.google.com/gmail/api
- Microsoft Graph API: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
- Obsidian Plugin API: https://docs.obsidian.md/Plugins

---

## 2. System Overview

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────┐
│                      Email Providers                         │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │   Gmail API      │          │  Microsoft Graph │         │
│  │   (starred)      │          │  (flagged)       │         │
│  └────────┬─────────┘          └────────┬─────────┘         │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            │ OAuth 2.0 PKCE              │
            │ HTTPS/JSON                   │
            │                              │
┌───────────▼──────────────────────────────▼──────────────────┐
│                 Email to PARA Sync Plugin                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Auth Manager │ Email Processor │ Note Creator       │   │
│  │  State Manager │ Sync Orchestrator │ Settings UI    │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────┬──────────────────────────────────────────────────┘
            │
            │ Obsidian API
            │ File System
            │
┌───────────▼──────────────────────────────────────────────────┐
│                    Obsidian Vault                             │
│  ┌──────────────────┐          ┌──────────────────┐          │
│  │  0 - INBOX/      │          │  .obsidian/      │          │
│  │  (notes)         │          │  (plugin data)   │          │
│  └──────────────────┘          └──────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 User Classes

| User Class | Description | Technical Expertise |
|------------|-------------|---------------------|
| Primary User | Individual using PARA method for personal knowledge management | Medium - can follow OAuth setup guides |
| Power User | Advanced user with multiple workflows, custom vault structures | High - comfortable with API configuration |
| IT Administrator | Setting up plugin for organization/team | High - familiar with OAuth, security policies |

---

## 3. Functional Requirements

### 3.1 Authentication (AUTH)

#### AUTH-001: Gmail OAuth Connection
**Priority:** MUST
**Description:** User shall be able to authenticate with Gmail using OAuth 2.0 PKCE flow.

**Requirements:**
- System shall generate PKCE code verifier and challenge
- System shall open browser to Google OAuth consent screen
- System shall spin up temporary loopback HTTP server on `127.0.0.1:0`
- System shall capture authorization code from callback
- System shall exchange code for access and refresh tokens
- System shall store refresh token in OS keychain (or encrypted fallback)
- System shall display connection status in settings

**Acceptance Criteria:**
- [ ] User clicks "Connect Gmail" button
- [ ] Browser opens to Google consent screen
- [ ] User grants read-only Gmail access
- [ ] Plugin shows "✓ Connected as user@gmail.com"
- [ ] Refresh token stored securely in keychain

#### AUTH-002: Outlook OAuth Connection
**Priority:** MUST
**Description:** User shall be able to authenticate with Outlook using OAuth 2.0 PKCE flow.

**Requirements:**
- System shall generate PKCE code verifier and challenge
- System shall open browser to Microsoft OAuth consent screen
- System shall spin up temporary loopback HTTP server on `127.0.0.1:0`
- System shall capture authorization code from callback
- System shall exchange code for access and refresh tokens
- System shall store refresh token in OS keychain (or encrypted fallback)
- System shall display connection status in settings

**Acceptance Criteria:**
- [ ] User clicks "Connect Outlook" button
- [ ] Browser opens to Microsoft consent screen
- [ ] User grants read-only Mail access
- [ ] Plugin shows "✓ Connected as user@outlook.com"
- [ ] Refresh token stored securely in keychain

#### AUTH-003: OAuth Callback Fallback
**Priority:** MUST
**Description:** System shall provide device-code flow fallback when loopback server fails.

**Requirements:**
- System shall detect when HTTP server cannot bind (firewall, port conflict)
- System shall initiate OAuth device-code flow
- System shall display verification URL and code to user
- System shall poll token endpoint until user approves
- System shall show clear instructions for manual authorization

**Acceptance Criteria:**
- [ ] Loopback server fails to bind
- [ ] Plugin shows device code and verification URL
- [ ] User visits URL and enters code
- [ ] Plugin polls and receives tokens upon approval
- [ ] Connection succeeds without loopback server

#### AUTH-004: Token Refresh
**Priority:** MUST
**Description:** System shall automatically refresh expired access tokens.

**Requirements:**
- System shall check token expiry before each API call
- System shall use refresh token to obtain new access token when expired
- System shall update token expiry timestamp
- System shall retry failed API call with new token
- System shall handle refresh token expiration (prompt re-authentication)

**Acceptance Criteria:**
- [ ] Access token expires (1 hour)
- [ ] System detects expiry before API call
- [ ] System uses refresh token to get new access token
- [ ] API call succeeds with new token
- [ ] No user interaction required

#### AUTH-005: Disconnect Account
**Priority:** MUST
**Description:** User shall be able to disconnect email accounts.

**Requirements:**
- System shall provide "Disconnect" button in settings
- System shall remove tokens from keychain/storage
- System shall update connection status
- System shall disable auto-sync for disconnected account
- System shall preserve existing synced notes

**Acceptance Criteria:**
- [ ] User clicks "Disconnect Gmail" button
- [ ] Confirmation dialog appears
- [ ] Tokens removed from keychain
- [ ] Status shows "Not connected"
- [ ] Auto-sync disabled for Gmail
- [ ] Existing notes remain in vault

---

### 3.2 Email Synchronization (SYNC)

#### SYNC-001: Fetch Starred Emails (Gmail)
**Priority:** MUST
**Description:** System shall fetch list of starred emails from Gmail.

**Requirements:**
- System shall query Gmail API with `q=is:starred` filter
- System shall handle pagination with `pageToken`
- System shall fetch up to 100 message IDs per page
- System shall continue until no `nextPageToken` or 500 emails processed
- System shall use `historyId` for incremental sync when available
- System shall handle API rate limiting (429/503 responses)

**Acceptance Criteria:**
- [ ] User has 250 starred emails
- [ ] System fetches all 250 IDs in 3 API calls (100+100+50)
- [ ] System respects 500-email processing limit
- [ ] Rate limit responses trigger exponential backoff

#### SYNC-002: Fetch Flagged Emails (Outlook)
**Priority:** MUST
**Description:** System shall fetch list of flagged emails from Outlook.

**Requirements:**
- System shall query Microsoft Graph with `$filter=flag/flagStatus eq 'flagged'`
- System shall set `$top=50` for predictable pagination
- System shall handle `@odata.nextLink` for pagination
- System shall continue until no next link or 500 emails processed
- System shall check for `Retry-After` headers
- System shall persist retry timestamp in sync state

**Acceptance Criteria:**
- [ ] User has 150 flagged emails
- [ ] System fetches all 150 in 3 API calls (50+50+50)
- [ ] System respects 500-email processing limit
- [ ] Throttling responses pause sync for suggested duration

#### SYNC-003: Deduplication
**Priority:** MUST
**Description:** System shall prevent duplicate notes from same email.

**Requirements:**
- System shall maintain list of synced email IDs in `.sync-state.json`
- System shall compare fetched IDs against synced IDs
- System shall process only new IDs not in state file
- System shall update state file after successful note creation
- System shall store `processedAt` timestamp with each ID

**Acceptance Criteria:**
- [ ] Email `msg_123` already synced
- [ ] User manually deletes note
- [ ] System detects `msg_123` in state file
- [ ] System skips `msg_123` (does not create duplicate)
- [ ] State file unchanged

#### SYNC-004: Automatic Sync Interval
**Priority:** MUST
**Description:** System shall automatically sync emails at configurable intervals.

**Requirements:**
- System shall default to 30-minute sync interval
- System shall allow user to configure interval (15, 30, 60 minutes)
- System shall start interval timer on plugin load
- System shall stop interval timer on plugin unload
- System shall respect rate limit retry timestamps during auto-sync

**Acceptance Criteria:**
- [ ] Plugin loads with 30-minute interval
- [ ] System syncs at 10:00, 10:30, 11:00
- [ ] User changes interval to 60 minutes
- [ ] System syncs at 11:00, 12:00, 13:00
- [ ] Rate limited sync skipped, retries next interval

#### SYNC-005: Manual Sync
**Priority:** MUST
**Description:** User shall be able to trigger immediate sync via ribbon icon.

**Requirements:**
- System shall provide ribbon icon (envelope with sync arrows)
- System shall execute sync immediately on click
- System shall show notice "Syncing emails..."
- System shall show result notice with count of new emails
- System shall respect rate limit retry timestamps

**Acceptance Criteria:**
- [ ] User clicks ribbon icon
- [ ] Notice shows "Syncing emails..."
- [ ] System fetches from both providers
- [ ] Notice shows "Synced 3 new emails (2 Gmail, 1 Outlook)"
- [ ] Rate limited provider skipped with warning

#### SYNC-006: Incremental Sync (Gmail)
**Priority:** SHOULD
**Description:** System shall use Gmail History API for incremental sync.

**Requirements:**
- System shall store `historyId` from last sync in state file
- System shall call `users.history.list` with stored `historyId`
- System shall process only STARRED label changes
- System shall fallback to full query if `historyId` invalid
- System shall update `historyId` after successful sync

**Acceptance Criteria:**
- [ ] Initial sync stores `historyId: "12345"`
- [ ] User stars 2 new emails
- [ ] Next sync calls history API with `historyId=12345`
- [ ] System receives only 2 deltas (not full starred list)
- [ ] State file updates to new `historyId`

#### SYNC-007: State Auto-Pruning
**Priority:** SHOULD
**Description:** System shall automatically prune old entries from sync state.

**Requirements:**
- System shall check `processedAt` timestamps during sync
- System shall remove entries older than 90 days
- System shall preserve entries newer than 90 days
- System shall log pruning activity to console

**Acceptance Criteria:**
- [ ] State file has 500 entries, 100 older than 90 days
- [ ] Sync executes
- [ ] System removes 100 old entries
- [ ] State file has 400 entries
- [ ] Console logs "Pruned 100 old state entries"

---

### 3.3 Email Processing (PROC)

#### PROC-001: Fetch Email Details
**Priority:** MUST
**Description:** System shall fetch full email content for each new email ID.

**Requirements:**
- System shall call Gmail `messages.get` with `format=full`
- System shall call Microsoft Graph `messages/{id}` for Outlook
- System shall extract headers (From, Subject, Date)
- System shall extract message body (HTML or plaintext)
- System shall handle network errors with retry (3 attempts, exponential backoff)

**Acceptance Criteria:**
- [ ] System has new email ID `msg_abc`
- [ ] System calls API to fetch full email
- [ ] System extracts sender, subject, date, body
- [ ] Network failure retries up to 3 times
- [ ] Persistent failure logs error, skips email

#### PROC-002: MIME Parsing (Gmail)
**Priority:** MUST
**Description:** System shall parse Gmail MIME structure to extract body content.

**Requirements:**
- System shall recursively walk `payload.parts` tree
- System shall prioritize `text/html` over `text/plain`
- System shall ignore `multipart/mixed` container parts
- System shall skip parts with `body.attachmentId` present
- System shall handle nested multipart structures
- System shall fallback to `payload.body.data` if no parts

**Acceptance Criteria:**
- [ ] Email has multipart/alternative with text/plain and text/html
- [ ] System selects text/html part
- [ ] Email has multipart/mixed with message and attachment
- [ ] System extracts message, ignores attachment part
- [ ] Simple email with body.data uses that directly

#### PROC-003: HTML to Markdown Conversion
**Priority:** MUST
**Description:** System shall convert email HTML to clean markdown.

**Requirements:**
- System shall use TurndownJS library for conversion
- System shall preserve headings, bold, italic, links, lists, blockquotes
- System shall convert tables to markdown tables
- System shall strip tracking pixels (1x1 images)
- System shall remove invisible elements (display:none, visibility:hidden)
- System shall preserve email threading/quoting structure

**Acceptance Criteria:**
- [ ] HTML has `<strong>bold</strong>` → markdown has `**bold**`
- [ ] HTML has `<ul><li>item</li></ul>` → markdown has `- item`
- [ ] HTML has `<blockquote>quote</blockquote>` → markdown has `> quote`
- [ ] HTML has tracking pixel → markdown omits it
- [ ] HTML has quoted reply → markdown preserves with blockquotes

#### PROC-004: Attachment Detection
**Priority:** MUST
**Description:** System shall detect and list email attachments in note metadata.

**Requirements:**
- System shall identify parts with `body.attachmentId` (Gmail)
- System shall identify attachments in Microsoft Graph response
- System shall extract attachment filename and size
- System shall create metadata block listing attachments
- System shall NOT download attachment content

**Acceptance Criteria:**
- [ ] Email has 2 attachments: "report.pdf" (500KB), "image.png" (200KB)
- [ ] Note includes metadata: "Attachments: 2 files (report.pdf 500KB, image.png 200KB)"
- [ ] Attachment content not downloaded to vault
- [ ] User clicks email link to view attachments in web client

#### PROC-005: Inline Image Handling
**Priority:** SHOULD
**Description:** System shall handle inline images referenced by `cid:` URIs.

**Requirements:**
- System shall detect `<img src="cid:xyz">` references
- System shall map CID to corresponding attachment metadata
- System shall replace with placeholder text `[Inline Image: filename.png]`
- System shall preserve external image URLs as markdown links

**Acceptance Criteria:**
- [ ] Email has inline image with `cid:img123`
- [ ] Attachment metadata maps `img123` to `photo.jpg`
- [ ] Markdown has `[Inline Image: photo.jpg]`
- [ ] External image `src="https://..."` → `![](https://...)`

#### PROC-006: Plaintext Fallback
**Priority:** MUST
**Description:** System shall use plaintext when HTML unavailable.

**Requirements:**
- System shall check for `text/html` MIME part first
- System shall fallback to `text/plain` if HTML missing
- System shall preserve plaintext formatting (line breaks, spacing)
- System shall handle plaintext-only emails gracefully

**Acceptance Criteria:**
- [ ] Email has only text/plain part
- [ ] System extracts plaintext content
- [ ] Line breaks preserved in markdown
- [ ] Note created successfully without HTML

---

### 3.4 Note Creation (NOTE)

#### NOTE-001: Generate Filename
**Priority:** MUST
**Description:** System shall generate unique, descriptive filenames for notes.

**Requirements:**
- System shall use format: `YYYY-MM-DD - [Subject].md`
- System shall use email received date, not sync date
- System shall truncate subject to 100 characters max
- System shall replace invalid filename characters with `-`
- System shall detect collisions and append `(1)`, `(2)`, etc.

**Acceptance Criteria:**
- [ ] Email received 2025-11-13, subject "Follow up on Q4 budget review"
- [ ] Filename: `2025-11-13 - Follow up on Q4 budget review.md`
- [ ] Subject >100 chars truncated
- [ ] Subject contains `/` → replaced with `-`
- [ ] Duplicate subject → second file gets `(1)` suffix

#### NOTE-002: Create Frontmatter
**Priority:** MUST
**Description:** System shall create YAML frontmatter with email metadata.

**Requirements:**
- System shall include tags: `[all, para/inbox, email-task]`
- System shall set `created` to email received date
- System shall set `email-source` to `gmail` or `outlook`
- System shall set `email-id` to provider's message ID
- System shall set `email-from` to sender email address
- System shall set `email-subject` to original subject
- System shall set `email-date` to received date (ISO format)
- System shall set `email-link` to web client URL
- System shall set `synced` to current timestamp

**Acceptance Criteria:**
- [ ] Gmail email from sender@example.com, subject "Test", ID msg_123
- [ ] Frontmatter has `email-source: gmail`
- [ ] Frontmatter has `email-id: "msg_123"`
- [ ] Frontmatter has `email-from: "sender@example.com"`
- [ ] Frontmatter has `email-link: "https://mail.google.com/...msg_123"`
- [ ] Frontmatter has `synced: 2025-11-13T10:30:00Z`

#### NOTE-003: Create Note Body
**Priority:** MUST
**Description:** System shall create structured note body with email content.

**Requirements:**
- System shall include heading: `# Subject: [email subject]`
- System shall include metadata block: From, Date, Source link
- System shall include separator: `---`
- System shall include section: `## Email Content` with converted markdown
- System shall include separator: `---`
- System shall include section: `## Tasks` with empty checkbox
- System shall include section: `## Notes` for user annotations

**Acceptance Criteria:**
- [ ] Note has main heading with subject
- [ ] Note has From, Date, Source metadata
- [ ] Note has email content in markdown
- [ ] Note has Tasks section with `- [ ]`
- [ ] Note has empty Notes section

#### NOTE-004: Write Note to Vault
**Priority:** MUST
**Description:** System shall write note file to inbox folder.

**Requirements:**
- System shall create note in `0 - INBOX/` folder
- System shall create folder if it doesn't exist
- System shall write frontmatter and body as UTF-8
- System shall handle filesystem errors (disk full, permissions)
- System shall trigger Obsidian file watcher for auto-para-tagger

**Acceptance Criteria:**
- [ ] Note written to `0 - INBOX/2025-11-13 - Subject.md`
- [ ] Folder created if missing
- [ ] File readable in Obsidian
- [ ] Auto-para-tagger detects new file
- [ ] Filesystem error logged, sync continues with other emails

---

### 3.5 State Management (STATE)

#### STATE-001: Initialize State File
**Priority:** MUST
**Description:** System shall create sync state file on first run.

**Requirements:**
- System shall create `.obsidian/plugins/email-to-para-sync/.sync-state.json`
- System shall initialize with version, empty synced emails object
- System shall set default values for historyId, deltaToken, retryAfter
- System shall handle missing parent directories (create recursively)

**Acceptance Criteria:**
- [ ] Plugin loads for first time
- [ ] State file doesn't exist
- [ ] System creates file with default structure
- [ ] File contains version, lastSync, empty syncedEmails

#### STATE-002: Load State on Startup
**Priority:** MUST
**Description:** System shall load sync state when plugin starts.

**Requirements:**
- System shall read `.sync-state.json` on plugin load
- System shall parse JSON into memory structure
- System shall validate version compatibility
- System shall handle corrupted JSON (recreate with warning)
- System shall handle missing file (create new)

**Acceptance Criteria:**
- [ ] Plugin loads with existing state file
- [ ] State loaded into memory
- [ ] Corrupted JSON triggers warning, recreates file
- [ ] Missing file recreated with defaults

#### STATE-003: Update State After Sync
**Priority:** MUST
**Description:** System shall update state file after each successful sync.

**Requirements:**
- System shall add new email IDs to `syncedEmails` object
- System shall set `processedAt` timestamp for each new ID
- System shall update `lastSync` timestamp
- System shall update `historyId` (Gmail) if provided
- System shall update `retryAfter` if rate limited
- System shall write atomically (temp file + rename)

**Acceptance Criteria:**
- [ ] Sync processes 3 new emails
- [ ] State file updated with 3 new IDs
- [ ] Each ID has `processedAt` timestamp
- [ ] `lastSync` updated to current time
- [ ] File write atomic (no corruption on crash)

#### STATE-004: Persist Rate Limit State
**Priority:** MUST
**Description:** System shall persist API rate limit retry timestamps.

**Requirements:**
- System shall store `retryAfter` timestamp per provider
- System shall check `retryAfter` before each sync
- System shall skip provider if current time < `retryAfter`
- System shall clear `retryAfter` after successful sync
- System shall show notice when sync skipped due to rate limit

**Acceptance Criteria:**
- [ ] Gmail returns 429 with `Retry-After: 300` (5 minutes)
- [ ] State file sets `gmail.retryAfter` to 5 minutes from now
- [ ] Next auto-sync checks timestamp, skips Gmail
- [ ] Notice shows "Gmail sync skipped (rate limited, retry at 10:35)"
- [ ] After retry time, Gmail syncs normally

---

### 3.6 User Interface (UI)

#### UI-001: Settings Tab
**Priority:** MUST
**Description:** System shall provide settings UI for plugin configuration.

**Requirements:**
- System shall display account management section for Gmail
- System shall display account management section for Outlook
- System shall show connection status (connected/not connected)
- System shall show connected email address when authenticated
- System shall provide Connect/Disconnect/Reconnect buttons
- System shall display sync settings (interval, folder, options)

**Acceptance Criteria:**
- [ ] User opens plugin settings
- [ ] Gmail section shows connection status
- [ ] If connected, shows "✓ Connected as user@gmail.com"
- [ ] Connect button opens OAuth flow
- [ ] Disconnect button removes tokens
- [ ] Sync interval dropdown has 15/30/60 minute options

#### UI-002: Ribbon Icon
**Priority:** MUST
**Description:** System shall provide ribbon icon for manual sync.

**Requirements:**
- System shall display envelope with sync arrows icon
- System shall show tooltip "Sync starred/flagged emails"
- System shall trigger immediate sync on click
- System shall show status notice during sync
- System shall show result notice after sync

**Acceptance Criteria:**
- [ ] Ribbon icon visible in left sidebar
- [ ] Hover shows tooltip
- [ ] Click triggers sync immediately
- [ ] Notice shows "Syncing emails..."
- [ ] Notice shows "Synced X new emails" on completion

#### UI-003: Sync Status Notices
**Priority:** MUST
**Description:** System shall show user-friendly notices for sync events.

**Requirements:**
- System shall show notice when sync starts
- System shall show notice with count on success
- System shall show notice with error message on failure
- System shall distinguish between network errors, auth errors, rate limits
- System shall auto-dismiss success notices after 5 seconds
- System shall require manual dismissal for error notices

**Acceptance Criteria:**
- [ ] Sync starts → "Syncing emails..."
- [ ] Sync succeeds → "Synced 3 new emails (2 Gmail, 1 Outlook)" (auto-dismiss)
- [ ] Network error → "Sync failed: Network error. Retrying in 30 min." (manual dismiss)
- [ ] Auth error → "Gmail authentication expired. Please reconnect." (manual dismiss)
- [ ] Rate limit → "Sync skipped: Gmail rate limited, retry at 10:35" (manual dismiss)

#### UI-004: Command Palette Integration
**Priority:** SHOULD
**Description:** System shall provide command palette actions.

**Requirements:**
- System shall register "Email to PARA: Manual sync" command
- System shall register "Email to PARA: Re-import email" command
- System shall register "Email to PARA: Reset sync state" command
- Commands shall be searchable in command palette

**Acceptance Criteria:**
- [ ] User opens command palette (Ctrl/Cmd+P)
- [ ] Types "email sync"
- [ ] "Email to PARA: Manual sync" appears
- [ ] Selects command → sync executes

---

### 3.7 Recovery & Maintenance (MAINT)

#### MAINT-001: Re-import Email Command
**Priority:** SHOULD
**Description:** User shall be able to re-import specific email by ID.

**Requirements:**
- System shall prompt user for email message ID
- System shall validate ID format (Gmail: msg_xxx, Outlook: uuid)
- System shall remove ID from sync state
- System shall immediately fetch and process that email
- System shall create new note (or overwrite if filename collision)

**Acceptance Criteria:**
- [ ] User opens command "Re-import email"
- [ ] Prompt asks for message ID
- [ ] User enters `msg_abc123`
- [ ] System removes from state, fetches email
- [ ] New note created in inbox
- [ ] Notice shows "Re-imported email: [Subject]"

#### MAINT-002: Reset Sync State Command
**Priority:** SHOULD
**Description:** User shall be able to reset sync state and fetch recent emails.

**Requirements:**
- System shall show confirmation dialog with warning
- System shall clear all synced email IDs from state
- System shall preserve provider tokens (don't disconnect)
- System shall fetch only last 20 starred/flagged emails per provider
- System shall create notes for those 20 emails only

**Acceptance Criteria:**
- [ ] User clicks "Reset sync state" in settings
- [ ] Dialog warns "This will re-import up to 20 recent emails per account"
- [ ] User confirms
- [ ] State file cleared
- [ ] System fetches 20 most recent starred (Gmail) + 20 flagged (Outlook)
- [ ] 40 total notes created (max)
- [ ] Notice shows "Sync state reset. Imported 15 Gmail + 18 Outlook emails."

#### MAINT-003: Debug Mode
**Priority:** SHOULD
**Description:** System shall provide debug logging for troubleshooting.

**Requirements:**
- System shall allow enabling debug mode via console
- System shall log all API requests/responses to console
- System shall log sync state changes
- System shall log email processing steps
- System shall NOT log sensitive data (tokens, email content)

**Acceptance Criteria:**
- [ ] User enables debug mode via console
- [ ] Console logs "Fetching Gmail starred emails..."
- [ ] Console logs "Received 50 email IDs"
- [ ] Console logs "Processing email msg_123"
- [ ] Access tokens not logged
- [ ] Email content not logged (only IDs, subjects)

---

## 4. Non-Functional Requirements

### 4.1 Usability

#### NFR-USABILITY-001: Setup Time
**Requirement:** New user shall complete OAuth setup in under 30 minutes with provided documentation.

**Measurement:** User testing with 5 users, average setup time < 30 minutes.

#### NFR-USABILITY-002: Sync Transparency
**Requirement:** User shall be aware of sync status without opening settings.

**Implementation:** Ribbon icon tooltip shows last sync time, notices show sync results.

#### NFR-USABILITY-003: Error Recovery
**Requirement:** User shall be able to recover from errors without data loss.

**Implementation:** Re-import and reset commands, state file backup on corruption.

### 4.2 Reliability

#### NFR-RELIABILITY-001: Sync Reliability
**Requirement:** 99% of emails shall sync successfully under normal conditions.

**Measurement:** Test with 1000 emails, <10 failures acceptable (transient network errors).

#### NFR-RELIABILITY-002: State Consistency
**Requirement:** Sync state shall remain consistent across plugin restarts.

**Implementation:** Atomic file writes, version validation on load.

#### NFR-RELIABILITY-003: Fault Tolerance
**Requirement:** Single email processing error shall not block entire sync.

**Implementation:** Try-catch per email, log error, continue with next email.

### 4.3 Maintainability

#### NFR-MAINTAINABILITY-001: Code Modularity
**Requirement:** Code shall be organized in logical modules for easy maintenance.

**Implementation:** Separate files for auth, sync, processing, state, UI.

#### NFR-MAINTAINABILITY-002: Logging
**Requirement:** All errors shall be logged with sufficient context for debugging.

**Implementation:** Console.error with error type, email ID, stack trace.

#### NFR-MAINTAINABILITY-003: Documentation
**Requirement:** All public functions shall have JSDoc comments.

**Implementation:** JSDoc for parameters, return values, examples.

---

## 5. Interface Requirements

### 5.1 External API Interfaces

#### API-001: Gmail API v1
**Endpoint:** `https://gmail.googleapis.com/gmail/v1/users/me/`

**Methods Used:**
- `GET messages?q=is:starred` - List starred emails
- `GET messages/{id}?format=full` - Get email details
- `GET users/history/list?historyId=xxx` - Incremental sync

**Authentication:** OAuth 2.0 Bearer token

**Rate Limits:** 250 quota units/user/second

#### API-002: Microsoft Graph Mail API
**Endpoint:** `https://graph.microsoft.com/v1.0/me/`

**Methods Used:**
- `GET messages?$filter=flag/flagStatus eq 'flagged'` - List flagged emails
- `GET messages/{id}` - Get email details

**Authentication:** OAuth 2.0 Bearer token

**Rate Limits:** 10,000 requests per 10 minutes

### 5.2 Obsidian Plugin API

**Methods Used:**
- `this.app.vault.create()` - Create note files
- `this.app.vault.adapter.exists()` - Check folder existence
- `this.app.vault.adapter.mkdir()` - Create folders
- `this.addRibbonIcon()` - Add ribbon button
- `this.addCommand()` - Add command palette commands
- `this.addSettingTab()` - Add settings UI
- `new Notice()` - Show user notifications

### 5.3 File System Interface

**Directories:**
- `.obsidian/plugins/email-to-para-sync/` - Plugin data
- `0 - INBOX/` - Note destination

**Files Created:**
- `.obsidian/plugins/email-to-para-sync/data.json` - Settings
- `.obsidian/plugins/email-to-para-sync/.sync-state.json` - Sync state
- `0 - INBOX/YYYY-MM-DD - [Subject].md` - Email notes

**Permissions Required:**
- Read/Write to vault directory
- Read/Write to .obsidian directory

---

## 6. Data Requirements

### 6.1 Data Models

#### Settings Data (`data.json`)
```json
{
  "version": "1.0.0",
  "gmail": {
    "enabled": true,
    "authenticated": true,
    "userEmail": "user@gmail.com",
    "keychainId": "obsidian-email-sync-gmail-refresh",
    "tokenExpiry": "2025-11-14T10:30:00Z"
  },
  "outlook": {
    "enabled": true,
    "authenticated": true,
    "userEmail": "user@outlook.com",
    "keychainId": "obsidian-email-sync-outlook-refresh",
    "tokenExpiry": "2025-11-14T10:30:00Z"
  },
  "sync": {
    "intervalMinutes": 30,
    "autoSync": true,
    "inboxFolder": "0 - INBOX",
    "processingLimit": 500
  }
}
```

#### Sync State Data (`.sync-state.json`)
```json
{
  "version": "1.0.0",
  "lastSync": "2025-11-13T10:30:00Z",
  "gmail": {
    "historyId": "123456",
    "retryAfter": null
  },
  "outlook": {
    "deltaToken": null,
    "retryAfter": null
  },
  "syncedEmails": {
    "gmail": {
      "msg_id_1": {"processedAt": "2025-11-13T10:30:00Z"},
      "msg_id_2": {"processedAt": "2025-11-13T10:35:00Z"}
    },
    "outlook": {
      "msg_id_3": {"processedAt": "2025-11-13T10:40:00Z"}
    }
  }
}
```

#### Note Frontmatter
```yaml
---
tags: [all, para/inbox, email-task]
created: 2025-11-13
email-source: gmail
email-id: "msg_abc123"
email-from: "sender@example.com"
email-subject: "Email subject"
email-date: 2025-11-13
email-link: "https://mail.google.com/mail/u/0/#inbox/msg_abc123"
synced: 2025-11-13T10:30:00Z
---
```

### 6.2 Data Retention

**Sync State:**
- Retain email IDs for 90 days after `processedAt`
- Auto-prune entries older than 90 days
- Preserve current `historyId` and `deltaToken` indefinitely

**Notes:**
- Persist indefinitely in vault (user manages lifecycle)
- Deleted notes won't be re-synced (ID remains in state)

### 6.3 Data Migration

**Version Compatibility:**
- State file includes `version` field
- Plugin checks version on load
- Incompatible versions trigger migration or reset

**Migration Path:**
- v1.0.0 → v1.1.0: Add new fields, preserve existing
- Breaking changes require user confirmation before migration

---

## 7. Security Requirements

### 7.1 Authentication Security

#### SEC-AUTH-001: OAuth PKCE
**Requirement:** All OAuth flows shall use PKCE to prevent authorization code interception.

**Implementation:** Generate cryptographically random code verifier (128 bytes), compute SHA-256 challenge.

#### SEC-AUTH-002: Token Storage
**Requirement:** Refresh tokens shall be stored in OS keychain or encrypted with AES-256-GCM.

**Implementation:**
- macOS: Keychain Access API
- Windows: Credential Manager API
- Linux: libsecret/GNOME Keyring
- Fallback: AES-256-GCM with user passphrase

#### SEC-AUTH-003: Access Token Lifetime
**Requirement:** Access tokens shall remain in memory only, never persisted to disk.

**Implementation:** Store in plugin class instance, cleared on unload.

#### SEC-AUTH-004: Minimum Scopes
**Requirement:** OAuth shall request minimum necessary scopes (read-only email access).

**Implementation:** Gmail `gmail.readonly`, Outlook `Mail.Read` (not `Mail.ReadWrite`).

### 7.2 Data Security

#### SEC-DATA-001: Email Content Privacy
**Requirement:** Email content shall not be logged or transmitted except to local vault.

**Implementation:** Debug mode logs only IDs and subjects, not email bodies.

#### SEC-DATA-002: Encryption at Rest
**Requirement:** Sensitive data in plugin settings shall be encrypted or stored in keychain.

**Implementation:** Refresh tokens in keychain, access tokens in memory, no plaintext secrets on disk.

#### SEC-DATA-003: Secure Communication
**Requirement:** All API communication shall use HTTPS with certificate validation.

**Implementation:** Use Obsidian's built-in `requestUrl` which enforces HTTPS and cert validation.

### 7.3 Input Validation

#### SEC-INPUT-001: API Response Validation
**Requirement:** All API responses shall be validated before processing.

**Implementation:** Check for expected fields, validate data types, handle malformed JSON.

#### SEC-INPUT-002: Filename Sanitization
**Requirement:** Email subjects shall be sanitized before use as filenames.

**Implementation:** Replace invalid characters (`/ \ : * ? " < > |`), truncate to 255 bytes.

#### SEC-INPUT-003: HTML Sanitization
**Requirement:** Email HTML shall be safely converted without XSS risk.

**Implementation:** TurndownJS strips scripts, event handlers, dangerous tags during conversion.

---

## 8. Performance Requirements

### 8.1 Response Time

#### PERF-RESPONSE-001: Manual Sync Latency
**Requirement:** Manual sync shall show status notice within 500ms of button click.

**Measurement:** 95th percentile < 500ms from click to notice display.

#### PERF-RESPONSE-002: Email Processing Time
**Requirement:** Single email shall be processed (fetch + convert + write) in under 5 seconds.

**Measurement:** 95th percentile < 5 seconds per email.

### 8.2 Throughput

#### PERF-THROUGHPUT-001: Sync Capacity
**Requirement:** System shall process up to 500 emails per sync without UI blocking.

**Measurement:** 500-email sync completes in under 30 minutes, UI remains responsive.

#### PERF-THROUGHPUT-002: API Request Rate
**Requirement:** System shall stay within provider rate limits.

**Measurement:** No 429 responses under normal usage (30-minute auto-sync intervals).

### 8.3 Resource Usage

#### PERF-RESOURCE-001: Memory Footprint
**Requirement:** Plugin shall use less than 100MB RAM during typical operation.

**Measurement:** Process memory < 100MB with 1000 synced emails in state.

#### PERF-RESOURCE-002: Storage Footprint
**Requirement:** State file shall remain under 5MB with 10,000 synced emails.

**Measurement:** State file size < 5MB with 10k entries (JSON overhead).

### 8.4 Scalability

#### PERF-SCALE-001: Large Inbox Handling
**Requirement:** System shall handle users with 10,000+ starred/flagged emails.

**Measurement:** Pagination and processing limits prevent memory exhaustion.

#### PERF-SCALE-002: Long-Running Operation
**Requirement:** Plugin shall remain stable across extended use (weeks without restart).

**Measurement:** No memory leaks, interval timers properly cleared, no zombie processes.

---

## 9. Quality Attributes

### 9.1 Testability

**Requirements:**
- All modules shall have clear interfaces for unit testing
- Mock objects available for API clients
- State manager shall support in-memory mode for testing

**Acceptance:**
- 80%+ code coverage with unit tests
- Integration tests for critical paths (OAuth, sync, note creation)

### 9.2 Portability

**Requirements:**
- Plugin shall work on Windows, macOS, Linux (where Obsidian runs)
- Keychain storage shall gracefully degrade on unsupported platforms
- File paths shall use platform-agnostic APIs

**Acceptance:**
- Plugin tested on Windows 10+, macOS 12+, Ubuntu 22.04+
- Keychain works on macOS/Windows, encrypted fallback on Linux

### 9.3 Accessibility

**Requirements:**
- Settings UI shall be keyboard navigable
- Ribbon icon shall have descriptive tooltip
- Error messages shall be screen-reader friendly

**Acceptance:**
- Tab navigation works through all settings
- Screen reader announces connection status changes

### 9.4 Compatibility

**Requirements:**
- Plugin shall support Obsidian v0.15.0+
- Plugin shall not conflict with auto-para-tagger plugin
- Plugin shall work with community themes

**Acceptance:**
- Tested on Obsidian v0.15.0, v1.0.0, latest
- Auto-para-tagger correctly tags synced notes
- UI renders correctly with default and 5 popular themes

---

## 10. Constraints and Assumptions

### 10.1 Technical Constraints

#### CONST-TECH-001: Obsidian Plugin API
**Constraint:** Plugin must use Obsidian Plugin API (no native Node.js modules).

**Impact:** Cannot use native keychain libraries directly, must use Electron bridge or fallback.

#### CONST-TECH-002: Browser Environment
**Constraint:** Plugin runs in Electron/Chromium environment with sandbox restrictions.

**Impact:** HTTP server for OAuth callback may require additional permissions.

#### CONST-TECH-003: File System Access
**Constraint:** Plugin can only write to vault directory and `.obsidian/plugins/` subdirectory.

**Impact:** Cannot store data outside vault, must use vault-relative paths.

### 10.2 Business Constraints

#### CONST-BIZ-001: OAuth Registration
**Constraint:** User must register their own OAuth applications (no shared credentials).

**Impact:** Setup complexity increased, but better security and rate limit isolation.

#### CONST-BIZ-002: Free Tier Limits
**Constraint:** Gmail and Outlook free tiers have usage limits.

**Impact:** Plugin must respect rate limits, may not work for enterprise-scale usage without paid plans.

### 10.3 Assumptions

#### ASSUME-001: Network Availability
**Assumption:** User has reliable internet connection during sync.

**Mitigation:** Retry logic handles transient failures, manual sync available.

#### ASSUME-002: Vault Structure
**Assumption:** User follows PARA method with `0 - INBOX/` folder.

**Mitigation:** Plugin creates folder if missing, configurable in settings.

#### ASSUME-003: Email Volume
**Assumption:** User stars/flags <100 emails per day.

**Mitigation:** 500-email processing limit prevents runaway syncs.

#### ASSUME-004: English Language
**Assumption:** Email subjects and bodies are primarily English.

**Mitigation:** UTF-8 encoding supports international characters, markdown conversion language-agnostic.

---

## 11. Dependencies

### 11.1 External Libraries

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| TurndownJS | ^7.1.2 | HTML to Markdown conversion | MIT |
| crypto-js | ^4.2.0 | AES-256-GCM encryption (fallback) | MIT |

### 11.2 Obsidian APIs

| API | Minimum Version | Purpose |
|-----|-----------------|---------|
| Vault API | 0.15.0 | File creation and management |
| Plugin API | 0.15.0 | Settings, commands, ribbons |
| Notice API | 0.15.0 | User notifications |

### 11.3 External Services

| Service | Purpose | Availability SLA |
|---------|---------|------------------|
| Gmail API | Email synchronization | 99.9% (Google SLA) |
| Microsoft Graph | Email synchronization | 99.9% (Microsoft SLA) |
| Google OAuth | Authentication | 99.9% (Google SLA) |
| Microsoft OAuth | Authentication | 99.9% (Microsoft SLA) |

### 11.4 Development Dependencies

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Build and development |
| npm | 9+ | Package management |
| TypeScript | 5+ | Type checking (if used) |
| esbuild | Latest | Bundling |

---

## 12. Acceptance Criteria

### 12.1 MVP Acceptance Criteria

**Critical (Must Have for v1.0):**
- [ ] User can connect Gmail account via OAuth
- [ ] User can connect Outlook account via OAuth
- [ ] Plugin syncs starred Gmail emails every 30 minutes
- [ ] Plugin syncs flagged Outlook emails every 30 minutes
- [ ] Email converted to markdown note in `0 - INBOX/`
- [ ] No duplicate notes created for same email
- [ ] Refresh tokens stored securely in keychain or encrypted
- [ ] Manual sync via ribbon icon works
- [ ] Un-starring email doesn't delete note
- [ ] Auto-para-tagger correctly tags synced notes

**Important (Should Have for v1.0):**
- [ ] Incremental sync using Gmail historyId
- [ ] Rate limiting handled with exponential backoff
- [ ] Attachments listed in note metadata
- [ ] Re-import email command works
- [ ] Reset sync state command works
- [ ] Device-code fallback for OAuth works
- [ ] State auto-pruning removes entries >90 days old

**Nice to Have (Can Defer to v1.1):**
- [ ] Configurable sync interval (15/30/60 minutes)
- [ ] Configurable inbox folder path
- [ ] Email body truncation options
- [ ] Statistics dashboard in settings

### 12.2 User Acceptance Testing

**Test Scenarios:**

1. **New User Setup**
   - [ ] User installs plugin
   - [ ] User registers OAuth apps (Gmail, Outlook)
   - [ ] User connects both accounts
   - [ ] User stars 5 emails in Gmail, flags 5 in Outlook
   - [ ] After 30 minutes, 10 notes appear in inbox
   - [ ] All notes have correct content and metadata

2. **Daily Usage**
   - [ ] User receives important email
   - [ ] User stars email
   - [ ] Within 30 minutes, note appears
   - [ ] User adds tasks to note
   - [ ] User moves note to project folder
   - [ ] Auto-para-tagger updates tags

3. **Manual Sync**
   - [ ] User stars urgent email
   - [ ] User clicks ribbon icon
   - [ ] Note appears within 10 seconds
   - [ ] Notice shows sync result

4. **Error Recovery**
   - [ ] Network fails during sync
   - [ ] Notice shows error, retry scheduled
   - [ ] Network restored, next sync succeeds
   - [ ] No data loss, no duplicate notes

5. **Vault Migration**
   - [ ] User resets sync state
   - [ ] Last 20 emails per account re-imported
   - [ ] No duplicates created
   - [ ] Sync continues normally

### 12.3 Performance Acceptance

**Benchmarks:**

| Scenario | Metric | Target | Acceptable |
|----------|--------|--------|------------|
| Manual sync (0 new emails) | Latency | <2s | <5s |
| Manual sync (10 new emails) | Duration | <30s | <60s |
| Auto-sync (50 new emails) | Duration | <3min | <5min |
| OAuth connection | Time to connect | <30s | <60s |
| Note creation | Per-email time | <3s | <5s |
| State file load | Time to load | <100ms | <500ms |

### 12.4 Security Acceptance

**Security Checklist:**

- [ ] OAuth uses PKCE for all flows
- [ ] Refresh tokens stored in OS keychain (or AES-256-GCM encrypted)
- [ ] Access tokens never written to disk
- [ ] All API calls over HTTPS with cert validation
- [ ] No email content in console logs (debug mode off)
- [ ] Filename sanitization prevents directory traversal
- [ ] HTML conversion strips XSS vectors
- [ ] Rate limit timestamps prevent API abuse

---

## Appendices

### Appendix A: Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-11-13 | Initial SRS document | Mark Riechers |

### Appendix B: Review History

| Date | Reviewer | Status | Notes |
|------|----------|--------|-------|
| 2025-11-13 | Mark Riechers | Draft | Initial creation |

### Appendix C: Traceability Matrix

| Requirement ID | Design Doc | Code Module | Test Case |
|----------------|------------|-------------|-----------|
| AUTH-001 | DESIGN.md §4.1 | auth-manager.js | test-auth-gmail.spec.js |
| AUTH-002 | DESIGN.md §4.1 | auth-manager.js | test-auth-outlook.spec.js |
| SYNC-001 | DESIGN.md §3.1 | gmail-client.js | test-gmail-sync.spec.js |
| SYNC-002 | DESIGN.md §3.1 | outlook-client.js | test-outlook-sync.spec.js |
| PROC-001 | DESIGN.md §3.2 | email-processor.js | test-email-fetch.spec.js |
| NOTE-001 | DESIGN.md §3.3 | note-creator.js | test-note-creation.spec.js |

---

**Document Status:** DRAFT - Pending Code Review
**Next Review Date:** TBD
**Approval Required:** Code Reviewer Agent, Product Owner (Mark Riechers)
