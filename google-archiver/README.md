# Google Archiver

Archive your Gmail emails and Google Calendar events to text files for record keeping.

## Features

### Gmail Archiver
- Download all emails or filter by labels, dates, or search queries
- Includes full email content, attachments list, and metadata
- Handles threading and conversation organization
- Respects Gmail API rate limits
- Splits large archives into manageable files

### Calendar Archiver
- Download events from all your calendars
- Includes attendees, locations, descriptions, and attachments
- Groups events by month and year for better organization
- Handles recurring events and conference details
- Flexible date range selection

## Quick Start

### 1. Install Dependencies
```bash
cd apps/google-archiver
pnpm install
```

### 2. Google Cloud Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or select a project**
3. **Enable APIs**:
   - Go to "APIs & Services" → "Library"
   - Search and enable "Gmail API"
   - Search and enable "Google Calendar API"
4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Desktop application" as application type
   - Name it (e.g., "Gmail Calendar Archiver")
   - Download the JSON file
5. **Save credentials**: Rename the downloaded file to `credentials.json` and place it in this directory

### 3. Authenticate
```bash
npm run auth
```

This will:
- Open your browser for Google OAuth consent
- Request permissions for Gmail and Calendar read access
- Save authentication tokens for future use

### 4. Run Archivers

**Archive Gmail:**
```bash
npm run gmail
```

Options include:
- All emails
- By labels/folders
- Custom search queries
- Recent emails only

**Archive Calendar:**
```bash
npm run calendar
```

Options include:
- Last year
- Last 5 years
- All time
- Custom date range

## Output Structure

### Gmail Archive
```
gmail-archive/
├── gmail_archive_batch_1.txt      # Main inbox (batched)
├── gmail_archive_batch_2.txt
├── gmail_Sent_batch_1.txt         # By label
└── gmail_Important_batch_1.txt
```

### Calendar Archive
```
calendar-archive/
├── calendar_primary_2024.txt      # Main calendar by year
├── calendar_work_2024.txt         # Work calendar
└── calendar_personal_2024.txt     # Personal calendar
```

## File Formats

### Email Format
```
================================================================================
Message ID: abc123
Thread ID: def456
From: sender@example.com
To: recipient@example.com
Subject: Important Email
Date: Mon, 15 Jan 2024 10:30:00 GMT
Labels: INBOX, IMPORTANT

Attachments (2):
  - document.pdf (application/pdf, 1024000 bytes)
  - image.jpg (image/jpeg, 512000 bytes)

--------------------------------------------------------------------------------

Email content here...
================================================================================
```

### Calendar Format
```
################################################################################
# January 2024
# Events: 25
################################################################################

================================================================================
Event: Weekly Team Meeting
Start: Monday, January 15, 2024 at 10:00 AM PST
End: Monday, January 15, 2024 at 11:00 AM PST
Location: Conference Room A
Organizer: manager@company.com

Attendees (5):
  - John Doe (accepted)
  - Jane Smith (tentative)
  - Bob Wilson (declined) [optional]

Conference:
  Video: https://meet.google.com/abc-defg-hij

Reminders:
  - 15 minutes before (popup)
  - 1 day before (email)

Description:
--------------------------------------------------------------------------------
Weekly sync meeting to discuss project progress and blockers.
================================================================================
```

## Advanced Usage

### Gmail Search Queries
Use Gmail's powerful search syntax:
```bash
# Emails from specific sender
from:important@company.com

# Emails with attachments after a date
has:attachment after:2024/1/1

# Important emails with specific subject
is:important subject:"quarterly report"

# Emails in specific labels
label:work OR label:projects
```

### Custom Date Ranges
Both archivers support flexible date filtering:
- Gmail: Use `after:YYYY/MM/DD` and `before:YYYY/MM/DD` in search
- Calendar: Interactive date range selection

## Privacy & Security

- **Local storage only**: All archives are saved locally as text files
- **Read-only access**: Scripts only request read permissions
- **OAuth2 security**: Uses Google's standard authentication flow
- **Rate limiting**: Respects API quotas with built-in delays
- **Token management**: Automatically handles token refresh

## Troubleshooting

### "credentials.json not found"
Make sure you've downloaded OAuth credentials from Google Cloud Console and saved as `credentials.json`.

### "Authentication error"
1. Delete `token.json` and run `npm run auth` again
2. Check that APIs are enabled in Google Cloud Console
3. Verify OAuth consent screen is configured

### "Quota exceeded"
Gmail and Calendar APIs have daily quotas:
- Gmail: 1 billion quota units per day
- Calendar: 1 million requests per day

The scripts include rate limiting to stay within limits.

### Large archives taking too long
- Use date ranges to split archives into smaller chunks
- Use Gmail search queries to filter specific conversations
- Archives are automatically split into batches for manageability

## API Limits

- **Gmail**: ~250 requests/minute, 1B quota units/day
- **Calendar**: ~100 requests/minute, 1M requests/day
- **Built-in delays**: Scripts automatically pace requests

## File Size Estimates

- **Average email**: ~2-5KB per message in text format
- **10,000 emails**: ~20-50MB of text files
- **Average calendar event**: ~1KB per event
- **1 year of events**: ~1-5MB depending on meeting frequency