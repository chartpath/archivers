# Archivers

A collection of archiving tools to backup and preserve your digital communications and data from Google and Slack services.

## Overview

This repository contains two specialized archiving tools:

1. **Google Archiver** - Archive Gmail emails and Google Calendar events
2. **Slack Archiver** - Archive Slack conversations and messages

Both tools export data to human-readable text files for long-term preservation and easy searching.

## Tools

### 📧 Google Archiver

Archive your Gmail emails and Google Calendar events with flexible filtering options.

**Features:**
- Download all Gmail emails or filter by labels, dates, or search queries
- Archive Google Calendar events with attendees, locations, and conference details
- Automatic batching for large archives
- OAuth2 authentication for secure access
- Rate limiting to respect API quotas

**Quick Setup:**
```bash
cd google-archiver
pnpm install
npm run auth  # Authenticate with Google
npm run gmail  # Archive emails
npm run calendar  # Archive calendar events
```

[Full documentation →](google-archiver/README.md)

### 💬 Slack Archiver

Export all your Slack conversations to text files for backup and record keeping.

**Features:**
- Archive all channels, private groups, and direct messages
- Support for both user tokens (recommended) and bot tokens
- Chronologically sorted messages with timestamps
- Preserves user names, attachments, and file references
- Respects Slack rate limits

**Quick Setup:**
```bash
cd slack-archiver
pnpm install
SLACK_USER_TOKEN=xoxp-your-token node index.js
```

[Full documentation →](slack-archiver/README.md)

## Output Formats

Both tools generate organized text files:

- **Google Archives**: Structured by service (Gmail/Calendar) and organized by labels, years, or batches
- **Slack Archives**: One file per conversation with chronological messages

All archives are stored locally as plain text files for maximum portability and longevity.

## Security & Privacy

- **Local storage only**: All data is saved locally on your machine
- **Read-only access**: Tools only request read permissions
- **Standard authentication**: Uses OAuth2 (Google) and official tokens (Slack)
- **No third-party services**: Direct API connections only

## Prerequisites

- Node.js 16+ and pnpm
- Google Cloud project with Gmail and Calendar APIs enabled (for Google Archiver)
- Slack app with appropriate scopes (for Slack Archiver)

## Getting Started

1. Clone this repository
2. Choose the archiver you need
3. Follow the setup instructions in the respective README
4. Run the archiver to backup your data

## License

MIT