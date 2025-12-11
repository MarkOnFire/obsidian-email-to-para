# OAuth Setup Guide: Outlook

This guide walks you through setting up Microsoft Outlook OAuth credentials for the Email to PARA Sync plugin.

**Time required:** ~10 minutes
**Cost:** Free (Azure free tier)

## Overview

To sync Outlook messages, the plugin needs permission to read your emails. Microsoft requires OAuth 2.0 authentication via Azure Active Directory, which means:

1. You register an app in Azure Portal (free)
2. You configure Microsoft Graph API permissions
3. The plugin uses those credentials to ask for your permission
4. You grant permission once, and the plugin can sync going forward

**Important:** Your emails are ONLY accessed by the plugin running locally on your computer. Nothing is sent to any external server.

## Prerequisites

- A Microsoft account (Outlook.com, Hotmail.com, or Microsoft 365)
- Access to [Azure Portal](https://portal.azure.com)

## Step-by-Step Instructions

### 1. Register an Application in Azure

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft account
3. In the search bar at the top, type: `Azure Active Directory` (or `Microsoft Entra ID`)
4. Click **Azure Active Directory** (or **Microsoft Entra ID**) in the results
5. In the left sidebar, click **App registrations**
6. Click **+ New registration** at the top

7. Fill in the registration form:
   - **Name:** `Obsidian Email Sync`
   - **Supported account types:** Select **"Accounts in any organizational directory and personal Microsoft accounts"**
     - This allows both personal Outlook.com and Microsoft 365 accounts
   - **Redirect URI:**
     - Platform: **Public client/native (mobile & desktop)**
     - URL: `http://localhost:42813/callback`

8. Click **Register**

9. You'll see the app overview page. **Copy this value:**
   - **Application (client) ID:** `12345678-1234-1234-1234-123456789abc`

   Paste it somewhere safe - you'll need the Client ID in Obsidian.

### 2. Configure Authentication Settings (Public Client Flow)

**Critical Step:** Since this is a desktop app running on your machine, we must enable the "Public client" flow. We do **NOT** use a Client Secret, as it cannot be securely stored in a desktop application.

1. In the left sidebar, click **Authentication**
2. Scroll to **Advanced settings**
3. Find **Allow public client flows**
4. Toggle it to **Yes**
5. Click **Save** at the top

### 3. Configure API Permissions

1. In the left sidebar, click **API permissions**
2. You'll see "Microsoft Graph" with "User.Read" already added
3. Click **+ Add a permission**
4. Click **Microsoft Graph**
5. Click **Delegated permissions**
6. In the search box, type: `Mail.Read`
7. Expand **Mail** and check: **Mail.Read** - "Read user mail"
8. Click **Add permissions**

9. Your permissions should now show:
   - ✅ `User.Read` (default)
   - ✅ `Mail.Read` (just added)

10. **(Optional but recommended)** Click **Grant admin consent for [Your Tenant]**
    - This pre-approves the permissions so you won't see a consent screen every time
    - Only available if you're an admin of your Microsoft 365 tenant
    - Skip this for personal Outlook.com accounts

### 4. Configure Plugin in Obsidian

Now you're ready to connect the plugin!

1. Open Obsidian
2. Go to **Settings → Email to PARA Sync**
3. Find the **Outlook** section
4. Toggle **Enable Outlook** to ON
5. Paste your **Application (client) ID** from Step 1:
   ```
   12345678-1234-1234-1234-123456789abc
   ```
   *(Note: No Client Secret is needed for this configuration)*
6. Click **Save**

### 5. Authenticate

1. In the plugin settings, click **Authenticate Outlook**
2. Your browser opens to a Microsoft sign-in page
3. Sign in with your Outlook/Microsoft 365 account
4. You'll see a permissions request screen:
   - **Obsidian Email Sync wants to:**
   - Read your email
   - Maintain access to data you've given it access to
5. Review the permissions
6. Click **Accept**
7. You'll be redirected to: `http://localhost:42813/callback?code=...`
8. You should see: **"Authentication successful! You can close this window."**
9. Return to Obsidian - the plugin status should show: "✅ Authenticated"

### 6. Test the Sync

1. Open Outlook in your browser or desktop app
2. Find an email and click the **🚩 flag icon** (Mark as flagged)
3. Return to Obsidian
4. Click the **✉️ mail ribbon icon** (left sidebar)
5. Watch the status bar: "Email Sync: Checking..."
6. Within a few seconds, check your **0 - INBOX** folder
7. You should see a new note with your email content!

## Understanding OAuth Scopes

The plugin requests minimal permissions:

- **`Mail.Read`** - Read-only access to emails
  - ✅ Can read message content
  - ✅ Can read message metadata (subject, sender, date)
  - ❌ Cannot send emails
  - ❌ Cannot delete or modify emails
  - ❌ Cannot access other Microsoft services (OneDrive, Calendar, etc.)

- **`User.Read`** - Basic profile info
  - ✅ Can read your name and email address
  - Used to display which account is connected

## Security & Privacy

**Where are credentials stored?**
- Client ID: In Obsidian's plugin settings (plaintext, local only)
- Access token: In plugin settings (in memory/settings)
- Refresh token: In plugin settings (stored locally)

**Who can access your emails?**
- Only the plugin running on your local computer
- Microsoft can see that the "Obsidian Email Sync" app accessed your account
- No third-party servers are involved

**What if I want to revoke access?**
1. Go to [Microsoft Account Apps](https://account.microsoft.com/privacy/app-access)
2. Find "Obsidian Email Sync"
3. Click **Remove**

The plugin will stop working until you re-authenticate.

## Troubleshooting

### "AADSTS50011: The reply URL specified in the request does not match"

**Cause:** Redirect URI mismatch

**Solution:**
1. Go to Azure Portal → App registrations → Your app
2. Click **Authentication** in the left sidebar
3. Verify **Redirect URIs** includes: `http://localhost:42813/callback`
4. Make sure it's under **Mobile and desktop applications** (not Web)
5. Make sure there are no typos or extra spaces
6. Click **Save** and wait 1 minute for changes to propagate
7. Try authenticating again

### "AADSTS7000218: The request body must contain the following parameter: 'client_assertion'"

**Cause:** Public client flows not enabled

**Solution:**
1. Go to Azure Portal → App registrations → Your app
2. Click **Authentication**
3. Scroll to **Advanced settings**
4. Toggle **Allow public client flows** to **Yes**
5. Click **Save**
6. Try authenticating again

### Authentication succeeds but no emails sync

**Possible causes:**
1. No flagged emails in your Outlook
2. Emails already synced previously

**Solution:**
1. Flag a brand new email (🚩)
2. Click the sync button in Obsidian
3. Check the status bar for progress
4. Check Developer Console (Ctrl/Cmd+Shift+I) for detailed logs

### "Invalid grant" or "Refresh token expired"

**Cause:** Refresh token expired (they last 90 days by default)

**Solution:**
1. Go to plugin settings
2. Click **Authenticate Outlook** again
3. Complete OAuth flow to get a fresh token

## Microsoft 365 vs Outlook.com Differences

### Microsoft 365 (Work/School)

**Advantages:**
- Admin can pre-approve app permissions
- Longer token lifetimes
- Enhanced security features

**Considerations:**
- Admin might need to allow app registration
- Some organizations block third-party apps
- Check with your IT department if you have issues

### Outlook.com / Hotmail (Personal)

**Advantages:**
- Full control over app permissions
- No admin approval needed
- Works immediately

**Considerations:**
- Must manually accept consent screen
- Standard token expiration (90 days)

Both work with the plugin - just follow the authentication steps above.

## Rate Limits & Quotas

Microsoft Graph API has generous free tier limits:

- **Throttling limit:** 10,000 requests per 10 minutes per app per tenant
- **Mailbox limit:** 4 requests per second per mailbox

The plugin typically uses:
- 1-2 requests per sync (list flagged, fetch message)
- ~50-100 requests per day (if syncing every 30 minutes)

You're extremely unlikely to hit these limits with personal use.