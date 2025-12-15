# Email to PARA - Brainstorming Notes

*December 12, 2025*

## Problem Statement

The original plugin design used OAuth to connect directly to Gmail and Outlook APIs to fetch starred/flagged emails. The OAuth setup process (creating apps in Google Cloud Console and Azure Portal) is tedious and creates friction for users.

**Goal:** Flag an email in Outlook, Gmail, or iCloud Mail → automatically create a task note in the INBOX folder of a PARA vault with the email content formatted as markdown.

## Constraints Identified

- User has custom domain already on Cloudflare DNS: `bymarkriechers.com`
- Prefer no-cost solution
- Uses iCloud sync for vault currently
- Cross-platform support needed (including iOS)
- Real-time sync preferred, but 5-minute polling acceptable
- Companion service + plugin architecture is acceptable
- Attachments are mostly disposable; can't link back to originals (auth-required)

## Why OAuth is Painful

- Gmail: Requires Google Cloud Console project, OAuth consent screen, credentials
- Outlook: Requires Azure AD app registration, permissions configuration
- Both: Token refresh logic, local HTTP server for callbacks, user-facing complexity

## Alternative Approaches Researched

### Rejected: Direct IMAP with App Passwords
- **Gmail**: Personal accounts with 2FA still support app passwords, but Google is pushing OAuth
- **Outlook**: App passwords **no longer work** for IMAP - Microsoft deprecated basic auth entirely
- **Verdict**: Not viable long-term

### Rejected: n8n Self-Hosted
- Still requires OAuth setup for Gmail/Outlook
- Doesn't escape the complexity we're trying to avoid

### Selected: Cloudflare Email Workers + R2

**Architecture:**
```
Gmail/Outlook/iCloud → Forward Rules → inbox@bymarkriechers.com
                                              ↓
                              Cloudflare Email Worker (parse, format)
                                              ↓
                                    Cloudflare R2 Bucket
                                              ↓
                              Remotely Save Plugin (existing)
                                              ↓
                            Obsidian (Desktop, iOS, Android)
```

**Why this works:**
- No OAuth - emails arrive via simple forwarding rules
- Cloudflare free tier is generous (100K emails/day, 10GB R2 storage)
- Remotely Save plugin already exists, works on iOS
- Real-time processing (emails arrive in seconds)
- Only need to build one component: the Email Worker

## Key Discovery: Remotely Save Plugin

https://github.com/remotely-save/remotely-save

- Existing Obsidian community plugin
- Works on iOS, Android, desktop
- Supports Cloudflare R2 via S3-compatible API
- Eliminates need to write a custom sync plugin

## Vault Analysis

**MarkBrain vault stats:**
- Total size: 440 MB (well under 10GB free tier)
- 1,461 markdown files
- 58 PDFs
- 101 images

**By folder:**
- 0 - INBOX: 208 KB
- 1 - PROJECTS: 228 KB
- 2 - AREAS: 2.7 MB
- 3 - RESOURCES: 11 MB
- 4 - ARCHIVE: 170 MB
- .obsidian: 41 MB

**Conclusion:** Vault could easily fit in R2 free tier with room to grow 20x.

## Sync Scope Decision Point

### Option A: INBOX-only sync via R2
- Keep iCloud for main vault sync
- Remotely Save only syncs INBOX folder from R2
- More conservative, keeps existing workflow
- Slightly more complex (two sync systems)

### Option B: Full vault on R2
- Replace iCloud with R2 for all Obsidian sync
- Simpler (one sync solution)
- Free at current vault size
- But: R2 lacks native versioning (see below)

## Versioning/Recovery Gap

**User concern:** If switching entirely to R2, want versioning/rollback capability for accidental deletions.

**R2 limitations:**
- No native object versioning (unlike S3)
- Known feature gap that users have requested
- Would need to build custom versioning layer with Workers

**Obsidian Sync comparison:**
| Feature | Obsidian Sync | R2 Solution |
|---------|---------------|-------------|
| Price | $4-10/month | $0 |
| Version History | 1 month to 1 year | None native |
| External API | **No** | **Yes** (S3 API) |
| Email workflow possible | No | Yes |

**Critical finding:** Obsidian Sync has no external API - can't write files to it from outside Obsidian. So even with Sync, you'd still need R2 for the email workflow.

## Possible Architectures

### 1. INBOX-only via R2 (Conservative)
- iCloud continues syncing main vault
- R2 + Remotely Save only for INBOX
- Email Worker writes to R2 INBOX folder
- Obsidian Edit History plugin for local versioning
- **Cost:** $0
- **Versioning:** Local only (via plugin)

### 2. Full vault on R2 (Simple)
- R2 replaces iCloud entirely
- Single sync solution
- **Cost:** $0
- **Versioning:** None (unless we build it)

### 3. R2 + Custom Versioning Worker
- Full vault on R2
- Build Worker that copies old versions before overwrites
- Custom Obsidian plugin for version browsing
- **Cost:** $0
- **Versioning:** Yes, but significant dev work

### 4. R2 (landing zone) + Obsidian Sync (main sync)
- Email Worker → R2 → Remotely Save pulls to local INBOX
- Obsidian Sync handles everything else including versioning
- **Cost:** $48-100/year
- **Versioning:** Yes (1 month to 1 year)
- **Complexity:** Two sync systems

## Template Design

Created `templates/email-task-template.md` based on user's inbox template:

```markdown
---
tags:
  - all
  - email-task
created: {{created_date}}
from: {{from_email}}
subject: {{subject}}
email_id: {{email_id}}
source: {{source}}
---

## 🗒 Tasks in this note
```tasks
path includes {{query.file.path}}
not done
sort by due
sort by priority
```

---
## 📧 Email
**From:** {{from_name}} <{{from_email}}>
**Date:** {{email_date}}
**Subject:** {{subject}}
{{#if original_link}}[Open in {{source}}]({{original_link}}){{/if}}

{{email_body}}

---
## Notes
*To do items will all be collected at the top of the note.*
- [ ] Review and process this email
- [ ]
```

## What Would Need to Be Built

### Minimal (INBOX-only approach):
1. **Cloudflare Email Worker** (~100-150 lines JS)
   - Receive forwarded emails
   - Parse headers and body
   - Convert HTML to Markdown
   - Apply template
   - Write to R2 bucket

2. **Configuration/Setup (no code)**
   - R2 bucket
   - Email routing rules in Cloudflare
   - Forwarding rules in Gmail/Outlook/iCloud
   - Remotely Save plugin configuration

### If adding versioning:
3. **Versioning Worker** (additional ~100-200 lines)
   - Intercept R2 writes
   - Copy old versions to `.versions/` folder
   - Prune old versions based on retention policy

4. **Obsidian Plugin for Version Browsing**
   - UI to list versions of a file
   - Preview/diff old versions
   - Restore functionality

## Open Questions

1. **Sync scope:** INBOX-only (conservative) vs full vault (simpler)?

2. **Versioning priority:** Is it a must-have or nice-to-have?
   - If must-have: Consider Obsidian Sync hybrid or building custom
   - If nice-to-have: Start with INBOX-only, add later

3. **Email platforms:** Gmail, Outlook, iCloud Mail confirmed. Others?

4. **Attachment handling:** Currently planned to just list names in metadata. Embed inline images in markdown body.

## Cost Summary

| Approach | Monthly | Annual |
|----------|---------|--------|
| R2 only (free tier) | $0 | $0 |
| R2 + Obsidian Sync Standard | $4 | $48 |
| R2 + Obsidian Sync Plus | $8-10 | $100 |
| Current (iCloud) | $0* | $0* |

*iCloud cost assumed covered by existing Apple subscription

## Next Steps (When Ready)

1. Decide on sync scope (INBOX-only vs full vault)
2. Decide on versioning approach
3. Set up Cloudflare Email Routing for `bymarkriechers.com`
4. Create R2 bucket
5. Build and deploy Email Worker
6. Configure email forwarding rules
7. Set up Remotely Save in Obsidian
8. Test end-to-end flow

## References

- [Cloudflare Email Workers docs](https://developers.cloudflare.com/email-routing/email-workers/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Remotely Save plugin](https://github.com/remotely-save/remotely-save)
- [Obsidian Edit History plugin](https://github.com/antoniotejada/obsidian-edit-history)
- [R2 versioning feature request](https://community.cloudflare.com/t/r2-object-versioning-and-replication/524025)
- [Obsidian Sync API request (not available)](https://forum.obsidian.md/t/request-api-for-obsidian-sync/89239)
