# OAuth Setup Guide: Gmail

This guide walks you through setting up Gmail OAuth credentials for the Email to PARA Sync plugin.

**Time required:** ~10 minutes
**Cost:** Free (Google Cloud free tier)

## Overview

To sync Gmail messages, the plugin needs permission to read your emails. Google requires OAuth 2.0 authentication, which means:

1. You create a Google Cloud project (free)
2. You enable the Gmail API
3. You create OAuth credentials
4. The plugin uses those credentials to ask for your permission
5. You grant permission once, and the plugin can sync going forward

**Important:** Your emails are ONLY accessed by the plugin running locally on your computer. Nothing is sent to any external server.

## Prerequisites

- A Google account (Gmail or Google Workspace)
- Access to [Google Cloud Console](https://console.cloud.google.com)

## Step-by-Step Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google account
3. Click the project dropdown at the top (says "Select a project")
4. Click **"NEW PROJECT"**
5. Enter project details:
   - **Project name:** `Obsidian Email Sync`
   - **Organization:** Leave as "No organization" (unless you have one)
6. Click **"CREATE"**
7. Wait a few seconds for the project to be created
8. Make sure the new project is selected (check the dropdown at the top)

### 2. Enable Gmail API

1. In the Google Cloud Console, make sure your "Obsidian Email Sync" project is selected
2. Click the **☰ hamburger menu** (top left)
3. Navigate to **APIs & Services → Library**
4. In the search bar, type: `Gmail API`
5. Click on **Gmail API** in the results
6. Click the blue **ENABLE** button
7. Wait for the API to be enabled (~5 seconds)

### 3. Configure OAuth Consent Screen

Before creating credentials, you need to configure the consent screen (what users see when authenticating).

1. In the left sidebar, click **OAuth consent screen**
2. Select **External** (unless you have a Google Workspace organization)
3. Click **CREATE**
4. Fill in the required fields:

   **App information:**
   - **App name:** `Obsidian Email Sync`
   - **User support email:** Your email address

   **App logo:** (optional, skip for now)

   **App domain:** (skip all these fields)

   **Developer contact information:**
   - **Email addresses:** Your email address

5. Click **SAVE AND CONTINUE**

6. **Scopes screen:**
   - Click **ADD OR REMOVE SCOPES**
   - In the filter, search for: `gmail.readonly`
   - Check the box for: `.../auth/gmail.readonly` - "View your email messages and settings"
   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**

7. **Test users screen:**
   - Click **+ ADD USERS**
   - Enter your Gmail address (the account you want to sync)
   - Click **ADD**
   - Click **SAVE AND CONTINUE**

8. **Summary screen:**
   - Review your settings
   - Click **BACK TO DASHBOARD**

### 4. Create OAuth 2.0 Credentials

1. In the left sidebar, click **Credentials**
2. Click **+ CREATE CREDENTIALS** at the top
3. Select **OAuth client ID**
4. Configure the OAuth client:
   - **Application type:** Select **Desktop app**
   - **Name:** `Obsidian Desktop Client`
5. Click **CREATE**

6. A dialog appears with your credentials:
   - **Your Client ID:** `1234567890-abcdefg.apps.googleusercontent.com`
   - **Your Client Secret:** `GOCSPX-abcd1234...`

7. **IMPORTANT:** Click the **📋 copy icon** next to Client ID
   - Paste this somewhere safe (you'll need it in Obsidian)
8. Click **OK** to close the dialog

### 5. Download Credentials (Optional but Recommended)

1. On the **Credentials** page, find your OAuth 2.0 Client ID
2. Click the **⬇️ download icon** on the right
3. This downloads a JSON file with your credentials
4. Save this file somewhere safe (like your password manager)
5. **Never commit this file to git or share it publicly**

### 6. Add Redirect URI (Important!)

The plugin needs a specific redirect URI to complete authentication.

1. Still on the **Credentials** page, click your OAuth client name ("Obsidian Desktop Client")
2. Scroll down to **Authorized redirect URIs**
3. Click **+ ADD URI**
4. Enter exactly: `http://localhost:42813/callback`
5. Click **SAVE** at the bottom

**Why this matters:** After you authenticate, Google redirects you to this localhost URL where the plugin captures the authorization code.

### 7. Configure Plugin in Obsidian

Now you're ready to connect the plugin!

1. Open Obsidian
2. Go to **Settings → Email to PARA Sync**
3. Find the **Gmail** section
4. Toggle **Enable Gmail** to ON
5. Paste your **Client ID** from Step 4:
   ```
   1234567890-abcdefg.apps.googleusercontent.com
   ```
6. Click **Save**

### 8. Authenticate

1. In the plugin settings, click **Authenticate Gmail**
2. Your browser opens to a Google sign-in page
3. Sign in with your Gmail account (the one you added as a test user)
4. You'll see a warning: "Google hasn't verified this app"
   - This is normal! You created the app yourself.
   - Click **Advanced** → **Go to Obsidian Email Sync (unsafe)**
5. Review the permissions:
   - "View your email messages and settings"
6. Click **Continue**
7. You'll be redirected to: `http://localhost:42813/callback?code=...`
8. You should see: **"Authentication successful! You can close this window."**
9. Return to Obsidian - the plugin status should show: "✅ Authenticated"

### 9. Test the Sync

1. Open Gmail in your browser
2. Find an email and click the **⭐ star icon**
3. Return to Obsidian
4. Click the **✉️ mail ribbon icon** (left sidebar)
5. Watch the status bar: "Email Sync: Checking..."
6. Within a few seconds, check your **0 - INBOX** folder
7. You should see a new note with your email content!

## Understanding OAuth Scopes

The plugin requests minimal permissions:

- **`gmail.readonly`** - Read-only access to emails
  - ✅ Can read message content
  - ✅ Can read message metadata (subject, sender, date)
  - ❌ Cannot send emails
  - ❌ Cannot delete or modify emails
  - ❌ Cannot access other Google services

## Security & Privacy

**Where are credentials stored?**
- Client ID: In Obsidian's plugin settings (plaintext, local only)
- Access token: In plugin settings (should be encrypted in future versions)
- Refresh token: In plugin settings (should be encrypted in future versions)

**Who can access your emails?**
- Only the plugin running on your local computer
- Google can see that the "Obsidian Email Sync" app accessed your account
- No third-party servers are involved

**What if I want to revoke access?**
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "Obsidian Email Sync"
3. Click **Remove Access**

The plugin will stop working until you re-authenticate.

## Troubleshooting

### "Access blocked: This app's request is invalid"

**Cause:** Redirect URI mismatch

**Solution:**
1. Go back to Google Cloud Console → Credentials
2. Click your OAuth client
3. Verify **Authorized redirect URIs** includes: `http://localhost:42813/callback`
4. Make sure there are no typos or extra spaces
5. Click **Save** and wait 1 minute for changes to propagate
6. Try authenticating again

### "Error 403: access_denied"

**Cause:** You haven't added yourself as a test user

**Solution:**
1. Go to Google Cloud Console → OAuth consent screen
2. Scroll to **Test users**
3. Click **+ ADD USERS**
4. Add your Gmail address
5. Click **Save**
6. Try authenticating again

### "This app hasn't been verified by Google"

**This is normal!** You created the app for personal use.

**Solution:**
1. Click **Advanced**
2. Click **Go to Obsidian Email Sync (unsafe)**
3. Continue with authentication

**To remove this warning (optional):**
- You'd need to submit your app for Google verification
- This is unnecessary for personal use
- Only required if you're distributing the plugin to others

### Authentication succeeds but no emails sync

**Possible causes:**
1. No starred emails in your Gmail
2. Emails already synced previously

**Solution:**
1. Star a brand new email
2. Click the sync button in Obsidian
3. Check the status bar for progress
4. Check Developer Console (Ctrl/Cmd+Shift+I) for detailed logs

### "Invalid grant" error

**Cause:** Refresh token expired or revoked

**Solution:**
1. Go to plugin settings
2. Click **Authenticate Gmail** again
3. Complete OAuth flow to get a fresh token

## Publishing Your App (Optional)

If you want to remove the "unverified app" warning, you can submit for verification:

1. Go to OAuth consent screen in Google Cloud Console
2. Click **PUBLISH APP**
3. Click **Prepare for Verification**
4. Follow Google's verification process

**Requirements:**
- Privacy policy URL
- Terms of service URL
- App homepage URL
- Verified domain ownership
- Security assessment (for sensitive scopes)

**Time:** 4-6 weeks for Google review

**Cost:** Free, but requires significant documentation

**Recommendation:** Only do this if distributing the plugin publicly. For personal use, the "unverified" warning is harmless.

## Rate Limits & Quotas

Gmail API has generous free tier limits:

- **Quota:** 1 billion requests per day (per project)
- **Rate limit:** 250 requests per second per user

The plugin typically uses:
- 1-2 requests per sync (list starred, fetch message)
- ~50-100 requests per day (if syncing every 30 minutes)

You're extremely unlikely to hit these limits with personal use.

## Alternative: App Passwords (Not Recommended)

Google deprecated "Less secure apps" in 2022. The only alternative to OAuth is:

**App Passwords** (Google Workspace only):
- Requires 2FA enabled
- Creates a 16-character password for the app
- Less secure than OAuth
- Not supported by this plugin

**Recommendation:** Stick with OAuth 2.0.

## Next Steps

✅ OAuth setup complete!

Now:
1. Star important emails in Gmail
2. Let the plugin sync them automatically
3. Process emails in your PARA inbox
4. Achieve inbox zero!

**Optional:** Set up [Outlook integration](./OAUTH-SETUP-OUTLOOK.md) to sync multiple accounts.

---

**Having issues?** Check the [Troubleshooting](#troubleshooting) section or review plugin logs in Developer Console.
