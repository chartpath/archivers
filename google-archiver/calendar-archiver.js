#!/usr/bin/env node

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { authenticate } = require('./auth');

class CalendarArchiver {
  constructor(auth) {
    this.calendar = google.calendar({ version: 'v3', auth });
    this.outputDir = './calendar-archive';
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`📁 Output directory created: ${this.outputDir}`);
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
  }

  async getCalendarList() {
    try {
      const res = await this.calendar.calendarList.list();
      return res.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      return [];
    }
  }

  async getEvents(calendarId, timeMin, timeMax, pageToken = null) {
    try {
      const events = [];
      
      do {
        const res = await this.calendar.events.list({
          calendarId: calendarId,
          timeMin: timeMin,
          timeMax: timeMax,
          maxResults: 250,
          singleEvents: true,
          orderBy: 'startTime',
          pageToken: pageToken
        });
        
        if (res.data.items) {
          events.push(...res.data.items);
        }
        
        pageToken = res.data.nextPageToken;
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (pageToken);
      
      return events;
    } catch (error) {
      console.error(`Error fetching events for calendar ${calendarId}:`, error.message);
      return [];
    }
  }

  formatDateTime(dateTime, date) {
    if (dateTime) {
      return new Date(dateTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } else if (date) {
      return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) + ' (All day)';
    }
    return 'Unknown time';
  }

  formatEvent(event) {
    let formatted = '='.repeat(80) + '\n';
    formatted += `Event: ${event.summary || '(No title)'}\n`;
    
    // Time information
    const start = this.formatDateTime(event.start?.dateTime, event.start?.date);
    const end = this.formatDateTime(event.end?.dateTime, event.end?.date);
    formatted += `Start: ${start}\n`;
    formatted += `End: ${end}\n`;
    
    // Status and visibility
    if (event.status) {
      formatted += `Status: ${event.status}\n`;
    }
    
    if (event.visibility) {
      formatted += `Visibility: ${event.visibility}\n`;
    }
    
    // Location
    if (event.location) {
      formatted += `Location: ${event.location}\n`;
    }
    
    // Organizer
    if (event.organizer) {
      formatted += `Organizer: ${event.organizer.displayName || event.organizer.email}\n`;
    }
    
    // Attendees
    if (event.attendees && event.attendees.length > 0) {
      formatted += `\nAttendees (${event.attendees.length}):\n`;
      event.attendees.forEach(attendee => {
        const name = attendee.displayName || attendee.email;
        const status = attendee.responseStatus || 'no response';
        formatted += `  - ${name} (${status})`;
        if (attendee.optional) {
          formatted += ' [optional]';
        }
        if (attendee.organizer) {
          formatted += ' [organizer]';
        }
        formatted += '\n';
      });
    }
    
    // Conference data (video calls)
    if (event.conferenceData && event.conferenceData.entryPoints) {
      formatted += `\nConference:\n`;
      event.conferenceData.entryPoints.forEach(entry => {
        if (entry.entryPointType === 'video') {
          formatted += `  Video: ${entry.uri}\n`;
        } else if (entry.entryPointType === 'phone') {
          formatted += `  Phone: ${entry.uri}\n`;
        }
      });
    }
    
    // Recurrence
    if (event.recurrence && event.recurrence.length > 0) {
      formatted += `\nRecurrence:\n`;
      event.recurrence.forEach(rule => {
        formatted += `  ${rule}\n`;
      });
    }
    
    // Reminders
    if (event.reminders) {
      if (event.reminders.useDefault) {
        formatted += `Reminders: Default\n`;
      } else if (event.reminders.overrides && event.reminders.overrides.length > 0) {
        formatted += `\nReminders:\n`;
        event.reminders.overrides.forEach(reminder => {
          formatted += `  - ${reminder.minutes} minutes before (${reminder.method})\n`;
        });
      }
    }
    
    // Description
    if (event.description) {
      formatted += `\nDescription:\n`;
      formatted += '-'.repeat(80) + '\n';
      formatted += event.description + '\n';
    }
    
    // Attachments
    if (event.attachments && event.attachments.length > 0) {
      formatted += `\nAttachments:\n`;
      event.attachments.forEach(att => {
        formatted += `  - ${att.title || att.fileUrl}\n`;
      });
    }
    
    formatted += '='.repeat(80) + '\n\n';
    
    return formatted;
  }

  async saveCalendarEvents(calendarName, events, year = null) {
    const sanitizedName = calendarName.replace(/[^a-z0-9]/gi, '_');
    const fileName = year 
      ? `calendar_${sanitizedName}_${year}.txt`
      : `calendar_${sanitizedName}.txt`;
    const filePath = path.join(this.outputDir, fileName);
    
    let content = `# Calendar Archive: ${calendarName}\n`;
    if (year) {
      content += `# Year: ${year}\n`;
    }
    content += `# Total Events: ${events.length}\n`;
    content += `# Exported: ${new Date().toISOString()}\n`;
    content += '#' + '='.repeat(79) + '\n\n';
    
    // Group events by month for better organization
    const eventsByMonth = {};
    
    for (const event of events) {
      const eventDate = new Date(event.start?.dateTime || event.start?.date);
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!eventsByMonth[monthKey]) {
        eventsByMonth[monthKey] = [];
      }
      eventsByMonth[monthKey].push(event);
    }
    
    // Sort months and write events
    const sortedMonths = Object.keys(eventsByMonth).sort();
    
    for (const monthKey of sortedMonths) {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      content += `\n${'#'.repeat(80)}\n`;
      content += `# ${monthName}\n`;
      content += `# Events: ${eventsByMonth[monthKey].length}\n`;
      content += `${'#'.repeat(80)}\n\n`;
      
      for (const event of eventsByMonth[monthKey]) {
        content += this.formatEvent(event);
      }
    }
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`    💾 Saved to: ${fileName}`);
  }

  async archiveCalendar(calendarId, calendarName, options = {}) {
    const { startDate, endDate, byYear = false } = options;
    
    console.log(`  📅 Fetching events for: ${calendarName}`);
    
    if (byYear) {
      // Archive year by year
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      
      for (let year = startYear; year <= endYear; year++) {
        const yearStart = new Date(year, 0, 1).toISOString();
        const yearEnd = new Date(year, 11, 31, 23, 59, 59).toISOString();
        
        console.log(`    📆 Processing year ${year}...`);
        const events = await this.getEvents(calendarId, yearStart, yearEnd);
        
        if (events.length > 0) {
          console.log(`      ✓ Found ${events.length} events`);
          await this.saveCalendarEvents(calendarName, events, year);
        } else {
          console.log(`      ⚠️ No events found for ${year}`);
        }
      }
    } else {
      // Archive all at once
      const events = await this.getEvents(
        calendarId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      if (events.length > 0) {
        console.log(`    ✓ Found ${events.length} events`);
        await this.saveCalendarEvents(calendarName, events);
      } else {
        console.log(`    ⚠️ No events found`);
      }
    }
  }

  async archive(options = {}) {
    await this.ensureOutputDirectory();
    
    const allCalendars = await this.getCalendarList();
    
    if (allCalendars.length === 0) {
      console.log('No calendars found or unable to access.');
      return;
    }
    
    // Use provided calendars or default to all
    const calendars = options.calendars || allCalendars;
    
    console.log(`\n📊 Found ${allCalendars.length} total calendars`);
    console.log(`📥 Will archive ${calendars.length} selected calendars\n`);
    
    // Default to last 5 years if not specified
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getFullYear() - 5, 0, 1);
    const byYear = options.byYear !== false; // Default to true
    
    console.log(`📅 Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`);
    
    for (const calendar of calendars) {
      await this.archiveCalendar(
        calendar.id,
        calendar.summary || calendar.id,
        { startDate, endDate, byYear }
      );
    }
    
    console.log(`\n✨ Archive complete!`);
    console.log(`   Archived ${calendars.length} calendars`);
    console.log(`   Output directory: ${path.resolve(this.outputDir)}`);
  }
}

async function promptForCalendarSelection(calendars) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\nCalendar Selection:');
    console.log('0. All calendars');
    
    calendars.forEach((cal, index) => {
      const isPrimary = cal.primary ? ' (Primary)' : '';
      const access = cal.accessRole || 'unknown';
      console.log(`${index + 1}. ${cal.summary}${isPrimary} [${access}]`);
    });
    
    console.log('\nOptions:');
    console.log('- Single calendar: Enter number (e.g., "1")');
    console.log('- Multiple calendars: Enter numbers separated by commas (e.g., "1,3,5")');
    console.log('- All calendars: Enter "0" or press Enter\n');
    
    rl.question('Select calendars: ', (answer) => {
      rl.close();
      
      if (!answer.trim() || answer.trim() === '0') {
        resolve(calendars); // All calendars
        return;
      }
      
      const selectedIndices = answer.split(',')
        .map(n => parseInt(n.trim()) - 1)
        .filter(i => i >= 0 && i < calendars.length);
      
      const selectedCalendars = selectedIndices.map(i => calendars[i]);
      resolve(selectedCalendars);
    });
  });
}

async function promptForDateRange() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\nDate Range Options:');
    console.log('1. Last year');
    console.log('2. Last 5 years');
    console.log('3. All time');
    console.log('4. Custom range\n');
    
    rl.question('Select option (1-4): ', async (answer) => {
      const now = new Date();
      let startDate, endDate;
      
      switch(answer) {
        case '1':
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          endDate = now;
          break;
          
        case '2':
          startDate = new Date(now.getFullYear() - 5, 0, 1);
          endDate = now;
          break;
          
        case '3':
          startDate = new Date(2000, 0, 1); // Google Calendar started around 2006
          endDate = now;
          break;
          
        case '4':
          const startStr = await new Promise(res => {
            rl.question('Enter start date (YYYY-MM-DD): ', res);
          });
          const endStr = await new Promise(res => {
            rl.question('Enter end date (YYYY-MM-DD): ', res);
          });
          startDate = new Date(startStr);
          endDate = new Date(endStr);
          break;
          
        default:
          startDate = new Date(now.getFullYear() - 5, 0, 1);
          endDate = now;
      }
      
      rl.close();
      resolve({ startDate, endDate });
    });
  });
}

async function main() {
  console.log('📅 Google Calendar Archiver\n');
  console.log('This tool will download your calendar events to text files.\n');
  
  try {
    const auth = await authenticate(['https://www.googleapis.com/auth/calendar.readonly']);
    const archiver = new CalendarArchiver(auth);
    
    // Get all available calendars first
    const allCalendars = await archiver.getCalendarList();
    
    if (allCalendars.length === 0) {
      console.log('No calendars found or unable to access.');
      return;
    }
    
    // Let user select which calendars to archive
    const selectedCalendars = await promptForCalendarSelection(allCalendars);
    
    if (selectedCalendars.length === 0) {
      console.log('No calendars selected.');
      return;
    }
    
    console.log(`\n✅ Selected ${selectedCalendars.length} calendar(s):`);
    selectedCalendars.forEach(cal => {
      const isPrimary = cal.primary ? ' (Primary)' : '';
      console.log(`  • ${cal.summary}${isPrimary}`);
    });
    
    // Get date range
    const { startDate, endDate } = await promptForDateRange();
    
    // Archive selected calendars
    await archiver.archive({ 
      startDate, 
      endDate, 
      byYear: true,
      calendars: selectedCalendars 
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = CalendarArchiver;