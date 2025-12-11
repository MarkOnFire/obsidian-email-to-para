# Email to PARA Sync - Quick Start Guide

This guide will help you get the plugin running in under 10 minutes.

## Prerequisites

- Obsidian installed with a vault using PARA structure
- A Gmail or Outlook account
- 10-15 minutes for OAuth setup

## Step 1: Enable the Plugin

1. Open your Obsidian vault in the desktop app
2. Go to **Settings → Community Plugins**
3. Scroll down to **Email to PARA Sync**
4. Toggle the plugin **ON**

You should see a mail icon (✉️) appear in the left ribbon.

## Step 2: Choose Your Email Provider

Pick **ONE** to start with (you can add more later):

- **Gmail** - Best if you use Google Workspace or Gmail
- **Outlook** - Best if you use Microsoft 365 or Outlook.com

## Step 3: Set Up OAuth Credentials

### Option A: Gmail

See [OAUTH-SETUP-GMAIL.md](./OAUTH-SETUP-GMAIL.md) for detailed instructions.

**TL;DR:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "Obsidian Email Sync"
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Desktop app type)
5. Copy Client ID
6. Add authorized redirect URI: `http://localhost:42813/callback`

### Option B: Outlook

See [OAUTH-SETUP-OUTLOOK.md](./OAUTH-SETUP-OUTLOOK.md) for detailed instructions.

**TL;DR:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Register new app: "Obsidian Email Sync"
3. Add Microsoft Graph API permissions: `Mail.Read`
4. Create client secret
5. Copy Application (client) ID
6. Add redirect URI: `http://localhost:42813/callback`

## Step 4: Configure Plugin Settings

1. In Obsidian, go to **Settings → Email to PARA Sync**
2. Enable your chosen provider (Gmail or Outlook)
3. Paste your **Client ID** from Step 3
4. If using Outlook, also paste your **Client Secret**
5. Click **Save**

## Step 5: Authenticate

1. Click the **Authenticate Gmail** or **Authenticate Outlook** button
2. Your browser will open asking you to sign in
3. Grant the requested permissions:
   - Gmail: "Read your email messages"
   - Outlook: "Read your mail"
4. You'll be redirected to a success page
5. Return to Obsidian - you should see "✅ Authenticated"

## Step 6: Test Your First Sync

1. **Star/Flag an email** in Gmail or Outlook
   - Gmail: Click the star icon ⭐
   - Outlook: Click the flag icon 🚩
2. In Obsidian, click the **mail icon** in the left ribbon
3. Watch the status bar (bottom right) for "Email Sync: Checking..."
4. Check your **0 - INBOX** folder for a new note!

## What Gets Synced?

The plugin syncs:
- ⭐ **Starred emails** (Gmail)
- 🚩 **Flagged emails** (Outlook)
- Only **new** emails since last sync (no duplicates)
- Automatically every **30 minutes** (configurable)

## What the Note Looks Like

Each email becomes a note with:

```markdown
---
tags: [all, email-import]
created: 2025-12-02
source: gmail
email-id: 18abc123def456
from: sender@example.com
subject: Important Project Update
received: 2025-12-02T10:30:00
link: https://mail.google.com/...
---

# Important Project Update

**From:** John Doe <sender@example.com>
**To:** you@example.com
**Date:** December 2, 2025 at 10:30 AM

---

[Email body converted to markdown]
```

## Customization

### Change Sync Interval

Settings → Email to PARA Sync → **Sync Interval**: `30` minutes (default)

- Minimum: 5 minutes
- Recommended: 15-30 minutes
- Battery-friendly: 60+ minutes

### Change Inbox Folder

Settings → Email to PARA Sync → **Inbox Folder**: `0 - INBOX` (default)

You can change this to any folder path in your vault, like:
- `Inbox`
- `1 - Projects/Email Inbox`
- `PARA/Inbox`

### Use a Custom Template

Settings → Email to PARA Sync → **Template Path**: (optional)

Point to a Templater template file to customize note format.

## Automatic Sync

Once authenticated, the plugin will:
- ✅ Sync automatically every 30 minutes (or your interval)
- ✅ Run sync when you click the ribbon icon
- ✅ Run sync via Command Palette: "Sync Emails Manually"
- ✅ Skip emails already synced (no duplicates)
- ✅ Show notifications for new emails

## Troubleshooting

### "Not authenticated" error

**Solution:** Click the "Authenticate" button in settings and complete OAuth flow.

### No notes created after sync

**Possible causes:**
1. No starred/flagged emails in your inbox
2. All starred emails were already synced (check `.sync-state.json` in vault root)
3. Authentication expired - re-authenticate in settings

**How to test:** Star a brand new email, then click sync.

### Authentication window doesn't open

**Solution:**
1. Check that plugin is enabled
2. Manually navigate to the OAuth URL shown in console (Help → Toggle Developer Tools)
3. Ensure redirect URI in Google/Azure matches: `http://localhost:42813/callback`

### Notes created in wrong folder

**Solution:** Check Settings → Email to PARA Sync → Inbox Folder path. Make sure the folder exists in your vault.

### "Build failed" when loading plugin

**Solution:**
1. Make sure you're using Obsidian desktop (not mobile)
2. Check that `main.js` exists in `.obsidian/plugins/email-to-para-sync/`
3. Try disabling and re-enabling the plugin

## Advanced: Manual Testing

### Check Sync State

Look at `.sync-state.json` in your vault root to see:
- Last sync timestamp
- List of synced email IDs

### View Logs

Open Developer Console (Ctrl/Cmd + Shift + I) and filter for "Email Sync" to see:
- Authentication status
- Sync progress
- Error details

### Reset Sync State

To force re-sync all emails:
1. Delete `.sync-state.json` from vault root
2. Restart Obsidian
3. Click sync

**Warning:** This will create duplicate notes if you've already synced emails before.

## Next Steps

1. ⭐ Star important emails in Gmail/Outlook
2. 🚩 Flag action items
3. Let the plugin automatically sync them to your PARA inbox
4. Process emails using your PARA workflow (inbox zero!)

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Enable Developer Console to view detailed logs
3. Check `DESIGN.md` for technical architecture details
4. File an issue with error logs and steps to reproduce

---

**Tip:** Start by starring/flagging just 2-3 test emails to verify everything works before syncing your whole inbox!
