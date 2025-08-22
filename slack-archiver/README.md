# Slack Archiver

Archive all your Slack conversations to text files.

## Quick Start with User Token (Recommended)

User tokens have access to all channels you're a member of, making this the easiest option.

### Step 1: Create a Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Give it a name (e.g., "Slack Archiver") and select your workspace

### Step 2: Add User Token Scopes

1. Go to "OAuth & Permissions" in the sidebar
2. Scroll down to "User Token Scopes" (NOT Bot Token Scopes)
3. Add these scopes:
   - `channels:history`
   - `channels:read`
   - `groups:history`
   - `groups:read`
   - `im:history`
   - `im:read`
   - `mpim:history`
   - `mpim:read`
   - `users:read`

### Step 3: Install & Get Token

1. Scroll back up to "OAuth Tokens for Your Workspace"
2. Click "Install to Workspace"
3. Authorize the app
4. Copy the "User OAuth Token" (starts with `xoxp-`)

### Step 4: Run the Archiver

```bash
cd apps/slack-archiver
SLACK_USER_TOKEN=xoxp-your-token-here node index.js
```

## Alternative: Bot Token

Bot tokens only have access to channels they're explicitly invited to.

### Additional Setup for Bot Token

1. Add the same scopes to "Bot Token Scopes" instead
2. Install the app and get the Bot Token (starts with `xoxb-`)
3. **Manually invite the bot to each channel** you want to archive:
   - In each channel, type: `/invite @YourBotName`

```bash
SLACK_BOT_TOKEN=xoxb-your-token-here node index.js
```

## Output

The script creates a `slack-archive/` directory with:
- One text file per conversation
- Messages sorted chronologically
- User names, timestamps, and attachments included
- File references preserved

## Privacy Note

- User tokens can only access channels you're a member of
- Bot tokens can only access channels they're invited to
- Private messages (DMs) are included if you have the appropriate scopes
- The script respects Slack's rate limits with built-in delays