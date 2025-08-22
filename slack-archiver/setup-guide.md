# Fixing "Invalid client_id parameter" Error

This error occurs when the OAuth & Permissions settings aren't properly configured. Here's how to fix it:

## Step-by-Step Fix

### 1. Check OAuth & Permissions Settings

Go to your app settings at https://api.slack.com/apps and select your app, then:

1. Navigate to **"OAuth & Permissions"** in the sidebar
2. Scroll down to **"Redirect URLs"**
3. Add this redirect URL:
   ```
   https://slack.com/oauth/v2/authorize
   ```
4. Click **"Save URLs"**

### 2. Verify App Credentials

1. Go to **"Basic Information"** in the sidebar
2. Check that your app has:
   - Client ID (should be visible)
   - Client Secret (click "Show" to verify it exists)
   - Verification Token (should be set)

### 3. Clear and Reinstall

1. Go back to **"OAuth & Permissions"**
2. If there's an existing installation, click **"Revoke Token"**
3. Scroll down to **"User Token Scopes"**
4. Verify these scopes are added:
   - `channels:history`
   - `channels:read`
   - `groups:history`
   - `groups:read`
   - `im:history`
   - `im:read`
   - `mpim:history`
   - `mpim:read`
   - `users:read`

### 4. Alternative: Create a Fresh App

If the error persists, create a new app from scratch:

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name it something like "Slack Archiver Personal"
4. Select your workspace
5. Go directly to **"OAuth & Permissions"**
6. Add the redirect URL: `https://slack.com/oauth/v2/authorize`
7. Add all the User Token Scopes listed above
8. Click **"Install to Workspace"**

### 5. Use the Direct Installation Link

If you still get errors, try the direct installation:

1. In **"OAuth & Permissions"**, look for **"Shareable URL"** or construct it manually:
   ```
   https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read&user_scope=channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read
   ```
2. Replace `YOUR_CLIENT_ID` with your actual Client ID from Basic Information
3. Visit this URL in your browser

## Quick Alternative: Use Slack's Legacy Token (Deprecated but might work)

If you have an older Slack workspace, you might be able to use a legacy token:
1. Visit https://api.slack.com/custom-integrations/legacy-tokens (if available)
2. Generate a token for your workspace

## Still Having Issues?

The error might be due to:
- Workspace restrictions (admin disabled app installations)
- OAuth redirect URL not properly set
- App not properly configured in the workspace

Try creating a completely new app and following the steps from the beginning, making sure to add the redirect URL before attempting installation.