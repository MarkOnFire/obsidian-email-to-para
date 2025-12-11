# Email to PARA Sync Plugin - Code Review Request

## Purpose

This document outlines specific questions and areas where I need feedback before implementing the email-to-para-sync plugin. Please review the design document (`DESIGN.md`) before reading this.

## Design Enhancements (from Codex Review)

Several critical improvements have been incorporated into the design based on best practices:

### Performance & Scalability
- **Pagination:** Gmail fetches 100 IDs per page, Outlook uses `$top=50`, both loop until complete or hit 500-email processing limit
- **Incremental Sync:** Gmail uses `historyId` to fetch only STARRED label deltas; Outlook can use delta queries (future enhancement)
- **Rate Limiting:** HTTP 429/503 responses trigger exponential backoff with persisted retry timestamps
- **Processing Limits:** Default 500 emails per sync to prevent UI blocking

### MIME Handling
- **Recursive MIME Parsing:** Walk `payload.parts` tree to find `text/html`, fall back to `text/plain`
- **Multipart Detection:** Ignore `multipart/mixed` containers, skip attachment parts
- **Attachment Metadata:** List attachments in note (e.g., "2 files - not downloaded")
- **Inline Images:** Resolve `cid:` references to attachment metadata for placeholders

### Advanced Features
- **Re-import Command:** Command palette action to remove email from state and reprocess
- **Reset Sync State:** Button in settings to clear state, fetch only last 20 emails (prevents full re-download on vault migration)
- **Auto-Pruning:** Sync state entries older than 90 days automatically removed

## Critical Design Questions

### 1. OAuth Implementation in Obsidian ✅ RESOLVED

**Decision:** Embedded HTTP Server with Device Code Fallback

**Implementation:**
- Plugin spins up temporary loopback HTTP server on `127.0.0.1:0` (OS-assigned port)
- Redirect URIs follow pattern: `http://127.0.0.1:{port}/oauth/{provider}`
- Server shuts down after success or 2-minute timeout
- **Fallback:** If server bind fails (firewall, mobile), use OAuth device-code flow with verification URL + code polling
- Error notices distinguish between browser rejection, callback failure, and token-exchange issues

**Rationale:**
- Standard OAuth flow with best UX
- Random port avoids conflicts
- Device code fallback ensures mobile/firewall compatibility
- Clear error messaging reduces support burden

---

### 2. Token Storage Security ✅ RESOLVED

**Decision:** Multi-Tier Security Strategy

**Implementation:**
- **Access tokens:** Keep in memory only, never persist to disk
- **Refresh tokens:**
  - **First choice:** OS keychain (macOS Keychain, Windows Credential Locker, libsecret) via Electron bridge
  - `data.json` stores only a stable identifier to retrieve from keychain
  - **Fallback:** If keychain unavailable, prompt for vault-specific passphrase
  - Derive AES-256-GCM key from passphrase
  - Store only ciphertext + nonce in `data.json`
  - **Last resort:** Without keychain or passphrase, refuse to save refresh tokens and disable auto-sync

**Documentation:**
- README warns that syncing `.obsidian` to Git/iCloud is safe (only encrypted blobs)
- OAuth client IDs/secrets should remain private
- Settings page shows security status (keychain/passphrase/disabled)

**Rationale:**
- Best-in-class security using OS-native secure storage
- Graceful degradation with passphrase encryption
- User control over security vs. convenience trade-off
- No plaintext tokens on disk

---

### 3. HTML to Markdown Conversion

**Question:** Which library should I use for converting email HTML to markdown?

**Context:**
- Emails contain complex HTML (nested tables, inline styles, images)
- Need reliable conversion to clean markdown
- Library must work in Obsidian's environment (Electron/Node.js)

**Candidate Libraries:**

**Option A: TurndownJS**
- Popular, well-maintained
- Size: ~20KB minified
- Customizable conversion rules
- [GitHub](https://github.com/mixmark-io/turndown)

**Option B: Showdown**
- Bidirectional (markdown ↔ HTML)
- Size: ~75KB minified
- May be overkill for one-way conversion

**Option C: Remark/Rehype**
- Part of unified ecosystem
- Very powerful, plugin-based
- Size: Varies, can be large
- May be complex for our needs

**Option D: Custom Parser**
- Write our own HTML → markdown converter
- Full control, lightweight
- More maintenance burden

**Which library is best suited for email HTML conversion? Are there Obsidian plugins using any of these that I should reference?**

---

### 4. Filename Collision Handling

**Question:** What's the best strategy for handling duplicate filenames?

**Context:**
- Filenames generated from email subjects: `YYYY-MM-DD - [Subject].md`
- Multiple emails can have same subject on same day
- Need deterministic, user-friendly collision resolution

**Proposed Solutions:**

**Option A: Numeric Suffix**
```
2025-11-13 - Follow up.md
2025-11-13 - Follow up (1).md
2025-11-13 - Follow up (2).md
```
- **Pros:** Clear, simple, familiar pattern
- **Cons:** Loses chronological info, requires checking existing files

**Option B: Include Time in Filename**
```
2025-11-13 10-45 - Follow up.md
2025-11-13 14-30 - Follow up.md
```
- **Pros:** Naturally unique, preserves chronology
- **Cons:** Filename gets longer, less clean

**Option C: Append Email ID**
```
2025-11-13 - Follow up [abc123].md
2025-11-13 - Follow up [def456].md
```
- **Pros:** Guaranteed unique, traceable to source
- **Cons:** Ugly, meaningless to user

**Option D: Prompt User**
- Detect collision, ask user for filename
- **Pros:** User gets to decide
- **Cons:** Breaks automatic sync, requires user interaction

**Which approach provides best balance of uniqueness and usability?**

---

### 5. Error Recovery Strategy

**Question:** How should the plugin handle transient errors during sync?

**Context:**
- Network can fail mid-sync
- API rate limits might be hit
- Token refresh can fail
- File system can be temporarily unavailable

**Scenarios:**

**Scenario A: Network Failure During Sync**
- Fetched 5 emails from Gmail API
- Processed 2, created notes
- Network drops before processing remaining 3

**Options:**
1. Mark all 5 as synced (lose 3 emails)
2. Mark only 2 as synced (re-process all on next sync)
3. Retry immediately with exponential backoff
4. Queue failed emails for next sync

**Scenario B: Invalid/Expired Refresh Token**
- Auto-sync runs in background
- Refresh token was revoked by user
- Cannot re-authenticate without user interaction

**Options:**
1. Disable auto-sync, show persistent error notice
2. Log error silently, retry on next interval
3. Show modal dialog interrupting user
4. Show non-intrusive notice in status bar

**What's the expected behavior for different error types? Should sync be transactional (all or nothing)?**

---

### 6. Sync State Granularity ✅ RESOLVED

**Decision:** Timestamps with Auto-Pruning (Option B Enhanced)

**Implementation:**
```json
{
  "version": "1.0.0",
  "lastSync": "2025-11-13T10:30:00Z",
  "gmail": {
    "historyId": "123456",
    "retryAfter": null
  },
  "outlook": {
    "deltaToken": "abc...",
    "retryAfter": null
  },
  "syncedEmails": {
    "gmail": {
      "id1": {"processedAt": "2025-11-13T10:30:00Z"},
      "id2": {"processedAt": "2025-11-13T10:35:00Z"}
    },
    "outlook": {
      "id3": {"processedAt": "2025-11-13T10:40:00Z"}
    }
  }
}
```

**Features:**
- Store `processedAt` timestamps for each email ID
- Auto-prune entries older than 90 days to keep file manageable
- Track `historyId` (Gmail) and `deltaToken` (Outlook) for incremental sync
- Persist `retryAfter` timestamps for API throttling
- "Re-import email" command removes ID from state and reprocesses
- "Reset sync state" button clears IDs, fetches only last 20 starred/flagged emails

**Rationale:**
- Timestamps enable auto-cleanup without losing recent history
- Incremental sync tokens reduce API calls
- Recovery commands provide user control
- Throttling state prevents API hammering

---

### 7. Multi-Account Support (Future)

**Question:** Should the initial design accommodate multiple accounts per provider?

**Context:**
- Current design: One Gmail account, one Outlook account
- User might have multiple work emails
- Adding later requires breaking changes to settings structure

**Trade-offs:**

**Design for Single Account Now:**
```javascript
settings.gmail = {
  enabled: true,
  userEmail: "user@gmail.com",
  accessToken: "..."
}
```
- **Pros:** Simpler v1 implementation
- **Cons:** Breaking change to add multi-account later

**Design for Multi-Account from Start:**
```javascript
settings.accounts = [
  {
    id: "gmail-primary",
    provider: "gmail",
    userEmail: "user@gmail.com",
    accessToken: "..."
  },
  {
    id: "gmail-work",
    provider: "gmail",
    userEmail: "work@company.com",
    accessToken: "..."
  }
]
```
- **Pros:** Future-proof, no migration needed
- **Cons:** More complex v1, feature might never be needed

**Should I over-engineer for multi-account support now, or keep it simple and refactor later if needed?**

---

### 8. Inbox Folder Customization

**Question:** Should the plugin support custom inbox folder paths, or hardcode `0 - INBOX`?

**Context:**
- Current design assumes `0 - INBOX/` is the destination folder
- User's PARA system might have different folder structure
- Plugin could validate folder exists or create it

**Proposed Solutions:**

**Option A: Hardcoded `0 - INBOX`**
- Plugin always creates notes in `0 - INBOX/`
- Create folder if it doesn't exist
- **Pros:** Simple, matches project's PARA structure
- **Cons:** Inflexible if user has different folder name

**Option B: Configurable with Default**
- Setting for "Inbox folder path"
- Default to `0 - INBOX`
- Validate folder exists, show error if not
- **Pros:** Flexible for different PARA implementations
- **Cons:** More complex, need folder picker UI

**Option C: Configurable with Auto-Creation**
- Setting for "Inbox folder path"
- Create folder automatically if missing
- **Pros:** Works with any structure, user-friendly
- **Cons:** Might create unwanted folders if user typos

**Which approach fits best with the project's philosophy? Is configurability worth the complexity?**

---

### 9. Email Body Truncation/Formatting

**Question:** Should we impose limits on email body length or formatting?

**Context:**
- Some emails are very long (newsletters, automated reports)
- Large notes can slow down Obsidian
- Users might prefer summaries over full content

**Proposed Options:**

**Option A: No Limits (Full Body)**
- Include entire email body regardless of length
- Trust markdown conversion to handle formatting
- **Pros:** Complete information, no data loss
- **Cons:** Can create huge notes, clutter

**Option B: Truncate at Character Limit**
- Limit email body to 10,000 characters
- Add "... (truncated, view full email in browser)" message
- **Pros:** Keeps notes manageable
- **Cons:** Arbitrary limit, might cut off important info

**Option C: Smart Truncation**
- Detect email type (conversation vs newsletter)
- Truncate newsletters, keep conversations full
- **Pros:** Context-aware, best of both worlds
- **Cons:** Complex heuristics, might get it wrong

**Option D: User Setting**
- Checkbox: "Include full email body" (default: on)
- If off, only include metadata + link
- **Pros:** User controls, simple logic
- **Cons:** All-or-nothing, no middle ground

**User already chose "full email body" in requirements, but should we add safeguards for pathologically long emails?**

---

### 10. Integration with Auto-Para-Tagger

**Question:** Any special considerations for integration with the existing auto-para-tagger plugin?

**Context:**
- auto-para-tagger watches for file create/move events
- Automatically adds `para/inbox` tag to files in `0 - INBOX/`
- Email sync plugin creates notes programmatically

**Potential Issues:**

1. **Tag Duplication:**
   - Email sync adds `para/inbox` in frontmatter
   - Auto-para-tagger tries to add `para/inbox` tag
   - Do both plugins conflict?

2. **Event Timing:**
   - Email sync creates file
   - Auto-para-tagger may trigger before file fully written
   - Could cause race condition?

3. **Tag Format:**
   - Email sync uses frontmatter: `tags: [para/inbox]`
   - Auto-para-tagger uses YAML: `tags: [para/inbox]`
   - Are these compatible?

**Questions:**
- Should email sync plugin NOT add `para/inbox` and rely on auto-para-tagger?
- Do I need to wait for file write to complete before auto-para-tagger triggers?
- Any known issues with plugins creating files programmatically?

---

## General Architecture Questions

### 11. File Structure Organization

Is the proposed file structure appropriate for an Obsidian plugin?

```
email-to-para-sync/
├── main.js                 # Plugin entry point
├── gmail-client.js         # Gmail API integration
├── outlook-client.js       # Microsoft Graph API integration
├── email-processor.js      # Email parsing and markdown conversion
├── note-creator.js         # Obsidian note generation
├── auth-manager.js         # OAuth 2.0 flows and token management
├── state-manager.js        # Sync state persistence
└── manifest.json
```

**Concerns:**
- Is this too many files for a plugin? Should I consolidate?
- Are module imports supported in Obsidian plugins?
- Should I use ES6 modules or CommonJS?

---

### 12. Performance Considerations

**Context:**
- Plugin runs sync every 30 minutes in background
- Could process dozens of emails at once
- Each email requires API call, HTML parsing, file write

**Questions:**
- Should emails be processed sequentially or in parallel?
- Should I implement a processing queue to avoid blocking UI?
- Are there Obsidian API rate limits I should be aware of?
- Should large syncs (>10 emails) show progress indicator?

---

### 13. Testing Strategy

**Question:** What's realistic for testing an Obsidian plugin with external API dependencies?

**Context:**
- Unit testing email parsing is straightforward
- Integration testing requires real Gmail/Outlook accounts
- OAuth makes automated testing complex

**Proposed Approach:**
- Unit tests with mocked API responses
- Manual integration testing with real accounts
- No automated E2E tests (too complex for v1)

**Is this sufficient, or should I invest in more comprehensive testing infrastructure?**

---

## Implementation Priority Questions

### 14. MVP Scope

For a minimal viable v1.0, which features are essential vs. nice-to-have?

**Must-Have:**
- [ ] Gmail OAuth authentication
- [ ] Outlook OAuth authentication
- [ ] Sync starred/flagged emails
- [ ] Create notes with metadata
- [ ] HTML to markdown conversion
- [ ] Deduplication (don't sync same email twice)
- [ ] Manual sync via ribbon icon
- [ ] 30-minute auto-sync

**Nice-to-Have (defer to v1.1?):**
- [ ] Configurable sync interval
- [ ] Configurable inbox folder
- [ ] Email body truncation options
- [ ] Statistics/sync history
- [ ] Error recovery UI
- [ ] Token refresh retry logic

**Should I implement everything in DESIGN.md, or start with MVP and iterate?**

---

### 15. Rollout Strategy

**Question:** How should I approach deployment and testing?

**Proposed Plan:**
1. Implement MVP with Gmail only (prove concept)
2. Test with my own Gmail account for 1 week
3. Add Outlook support
4. Test with both providers for 1 week
5. Deploy to production (vault)
6. Gather feedback, iterate on v1.1

**Does this rollout make sense, or should I build everything at once?**

---

## Documentation Questions

### 16. OAuth Setup Documentation

**Context:**
- Users must register OAuth apps with Google and Microsoft
- This is a complex multi-step process
- README needs to be very detailed

**Question:** How detailed should the OAuth setup guide be?

**Options:**
- Minimal: Link to Google/Microsoft docs, assume user figures it out
- Moderate: Step-by-step with screenshots, highlight key settings
- Comprehensive: Complete walkthrough, troubleshooting, FAQs

**Which level of detail is appropriate? Should I include screenshots in README?**

---

### 17. Error Message UX

**Question:** How should errors be communicated to users?

**Context:**
- Errors can occur during sync (network, auth, API)
- User might not be actively using Obsidian when error occurs
- Need to balance being informative vs. intrusive

**Options:**
1. **Console logs only** - Silent errors, user must check dev tools
2. **Status bar message** - Subtle, non-intrusive, might be missed
3. **Notice popups** - More visible, might be annoying if frequent
4. **Settings page alerts** - Persistent error state, user must check settings
5. **Combination** - Different severities use different channels

**What's the right UX for error communication in an automatic sync plugin?**

---

## Review Request Summary

**✅ RESOLVED (from Codex):**
1. OAuth callback mechanism (Q1) - Loopback server with device code fallback
2. Token storage security (Q2) - OS keychain with passphrase fallback
6. Sync state granularity (Q6) - Timestamps with auto-pruning + incremental sync tokens

**High Priority (Still Need Review):**
3. Integration with auto-para-tagger (Q10)
4. MVP scope definition (Q14)

**Medium Priority (Affects Architecture):**
5. HTML conversion library (Q3) - TurndownJS likely, but need confirmation
7. Error recovery strategy (Q5) - Needs decision on transactional behavior
8. Multi-account design (Q7) - Single account v1 vs. multi-account from start

**Low Priority (Can Decide During Implementation):**
9. Filename collision handling (Q4)
10. Inbox folder customization (Q8)
11. Email body truncation (Q9)
12. File structure organization (Q11)
13. Performance considerations (Q12) - Partially addressed by processing limits

**Documentation/Polish:**
14. Testing strategy (Q13)
15. Rollout strategy (Q15)
16. OAuth setup documentation (Q16)
17. Error message UX (Q17)

---

## Next Steps

After review feedback:
1. Update DESIGN.md with final decisions
2. Create implementation task breakdown
3. Begin development with MVP scope
4. Iterate based on testing and feedback

**Please provide guidance on high-priority questions first, as they block architectural decisions. Medium and low-priority items can be decided during implementation if needed.**
