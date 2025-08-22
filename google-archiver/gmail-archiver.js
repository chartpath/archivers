#!/usr/bin/env node

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { authenticate } = require('./auth');

class GmailArchiver {
  constructor(auth, options = {}) {
    this.gmail = google.gmail({ version: 'v1', auth });
    this.outputDir = './gmail-archive';
    this.messagesPerFile = 100; // Split into manageable files
    this.includeMarkup = options.includeMarkup || false;
    this.excludePromotions = options.excludePromotions !== false; // Default true
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`📁 Output directory created: ${this.outputDir}`);
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
  }

  async getLabels() {
    try {
      const res = await this.gmail.users.labels.list({ userId: 'me' });
      return res.data.labels || [];
    } catch (error) {
      console.error('Error fetching labels:', error);
      return [];
    }
  }

  async getMessages(query = '', maxResults = null) {
    try {
      const messages = [];
      let pageToken = null;
      let totalFetched = 0;
      
      console.log(`🔍 Fetching messages${query ? ` matching: "${query}"` : ''}...`);
      
      do {
        const res = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          pageToken: pageToken,
          maxResults: maxResults && !totalFetched ? Math.min(500, maxResults) : 500
        });
        
        if (res.data.messages) {
          messages.push(...res.data.messages);
          totalFetched += res.data.messages.length;
          console.log(`  ↓ Retrieved ${totalFetched} message IDs...`);
        }
        
        pageToken = res.data.nextPageToken;
        
        if (maxResults && totalFetched >= maxResults) {
          break;
        }
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (pageToken);
      
      console.log(`✅ Found ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async getMessage(messageId) {
    try {
      const res = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });
      return res.data;
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error.message);
      return null;
    }
  }

  parseHeaders(headers) {
    const headerMap = {};
    headers.forEach(header => {
      headerMap[header.name.toLowerCase()] = header.value;
    });
    return headerMap;
  }

  decodeBase64(data) {
    if (!data) return '';
    const buff = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return buff.toString('utf-8');
  }

  extractBody(payload) {
    let body = '';
    
    // Single part message
    if (payload.body && payload.body.data) {
      body = this.decodeBase64(payload.body.data);
    }
    
    // Multipart message
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          body += this.decodeBase64(part.body.data);
        } else if (this.includeMarkup && part.mimeType === 'text/html' && part.body && part.body.data) {
          // Only include HTML if explicitly requested
          body += '\n--- HTML Content ---\n';
          body += this.decodeBase64(part.body.data);
          body += '\n--- End HTML ---\n';
        } else if (part.parts) {
          // Nested parts
          body += this.extractBody(part);
        }
      }
    }
    
    return this.includeMarkup ? body : this.cleanText(body);
  }

  cleanText(text) {
    if (!text) return '';
    
    // Remove CSS style blocks (including those in email content)
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/style\s*=\s*"[^"]*"/gi, '');
    text = text.replace(/style\s*=\s*'[^']*'/gi, '');
    
    // Remove script blocks
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove all HTML tags (aggressive cleanup)
    text = text.replace(/<\/?[^>]+>/g, '');
    
    // Remove common CSS/styling remnants that might leak through
    text = text.replace(/\{[^}]*\}/g, '');  // Remove any remaining CSS blocks
    text = text.replace(/font-[a-z-]+:\s*[^;]+;?/gi, '');
    text = text.replace(/color:\s*[^;]+;?/gi, '');
    text = text.replace(/background[a-z-]*:\s*[^;]+;?/gi, '');
    text = text.replace(/margin[a-z-]*:\s*[^;]+;?/gi, '');
    text = text.replace(/padding[a-z-]*:\s*[^;]+;?/gi, '');
    text = text.replace(/border[a-z-]*:\s*[^;]+;?/gi, '');
    text = text.replace(/width:\s*[^;]+;?/gi, '');
    text = text.replace(/height:\s*[^;]+;?/gi, '');
    text = text.replace(/display:\s*[^;]+;?/gi, '');
    text = text.replace(/position:\s*[^;]+;?/gi, '');
    text = text.replace(/text-[a-z-]+:\s*[^;]+;?/gi, '');
    
    // Remove email tracking and styling artifacts
    text = text.replace(/=3D/g, '=');
    text = text.replace(/=20/g, ' ');
    text = text.replace(/=\r?\n/g, '');
    
    // Remove common HTML entities (more comprehensive)
    const entities = {
      '&nbsp;': ' ',
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&ldquo;': '"',
      '&rdquo;': '"',
      '&lsquo;': "'",
      '&rsquo;': "'",
      '&ndash;': '–',
      '&mdash;': '—',
      '&hellip;': '…',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™'
    };
    
    for (const [entity, replacement] of Object.entries(entities)) {
      text = text.replace(new RegExp(entity, 'g'), replacement);
    }
    
    // Remove numeric HTML entities
    text = text.replace(/&#\d+;/g, '');
    text = text.replace(/&#x[0-9a-f]+;/gi, '');
    
    // Remove URLs that are just tracking/styling (common in emails)
    text = text.replace(/https?:\/\/[^\s]*\.(css|js|gif|png|jpg|jpeg)\b[^\s]*/gi, '[removed styling/tracking URL]');
    
    // Clean up whitespace and formatting
    text = text.replace(/\r\n/g, '\n');           // Normalize line endings
    text = text.replace(/\r/g, '\n');             // Handle old Mac line endings
    text = text.replace(/\n{3,}/g, '\n\n');      // Reduce multiple empty lines to max 2
    text = text.replace(/[ \t]{2,}/g, ' ');       // Reduce multiple spaces/tabs to single space
    text = text.replace(/^\s+/gm, '');            // Remove leading whitespace on each line
    text = text.replace(/\s+$/gm, '');            // Remove trailing whitespace on each line
    
    // Remove lines that are likely CSS/styling remnants
    text = text.split('\n').filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true; // Keep empty lines for spacing
      
      // Filter out lines that look like CSS or styling artifacts
      if (trimmed.match(/^(font-|color:|background|margin|padding|border|width:|height:|display:|position:|text-)/i)) return false;
      if (trimmed.match(/^\d+px/)) return false;
      if (trimmed.match(/^rgb\(/)) return false;
      if (trimmed.match(/^#[0-9a-f]{3,6}$/i)) return false;
      if (trimmed === ';') return false;
      if (trimmed.match(/^\s*[{}]\s*$/)) return false;
      
      return true;
    }).join('\n');
    
    return text.trim();
  }

  extractAttachments(payload) {
    const attachments = [];
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.filename.length > 0) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size
          });
        }
        if (part.parts) {
          // Nested parts
          attachments.push(...this.extractAttachments(part));
        }
      }
    }
    
    return attachments;
  }

  formatMessage(message) {
    if (!message || !message.payload) {
      return 'Error: Could not parse message\n\n';
    }
    
    const headers = this.parseHeaders(message.payload.headers || []);
    const body = this.extractBody(message.payload);
    const attachments = this.extractAttachments(message.payload);
    
    let formatted = '='.repeat(80) + '\n';
    formatted += `Message ID: ${message.id}\n`;
    formatted += `Thread ID: ${message.threadId}\n`;
    formatted += `From: ${headers.from || 'Unknown'}\n`;
    formatted += `To: ${headers.to || 'Unknown'}\n`;
    formatted += `Subject: ${headers.subject || '(No Subject)'}\n`;
    formatted += `Date: ${headers.date || 'Unknown'}\n`;
    
    if (headers.cc) {
      formatted += `CC: ${headers.cc}\n`;
    }
    
    if (message.labelIds && message.labelIds.length > 0) {
      formatted += `Labels: ${message.labelIds.join(', ')}\n`;
    }
    
    if (attachments.length > 0) {
      formatted += `\nAttachments (${attachments.length}):\n`;
      attachments.forEach(att => {
        formatted += `  - ${att.filename} (${att.mimeType}, ${att.size} bytes)\n`;
      });
    }
    
    formatted += '\n' + '-'.repeat(80) + '\n\n';
    formatted += body || '(No text content)\n';
    formatted += '\n' + '='.repeat(80) + '\n\n';
    
    return formatted;
  }

  async saveMessages(messages, label = 'all', batchIndex = 0) {
    const fileName = label === 'all' 
      ? `gmail_archive_batch_${batchIndex + 1}.txt`
      : `gmail_${label}_batch_${batchIndex + 1}.txt`;
    const filePath = path.join(this.outputDir, fileName);
    
    let content = `# Gmail Archive\n`;
    content += `# Label: ${label}\n`;
    content += `# Batch: ${batchIndex + 1}\n`;
    content += `# Messages: ${messages.length}\n`;
    content += `# Exported: ${new Date().toISOString()}\n`;
    content += '#' + '='.repeat(79) + '\n\n';
    
    let processedCount = 0;
    
    for (const messageRef of messages) {
      const fullMessage = await this.getMessage(messageRef.id);
      if (fullMessage) {
        content += this.formatMessage(fullMessage);
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`    ↓ Processed ${processedCount}/${messages.length} messages...`);
        }
      }
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`    💾 Saved batch to: ${fileName}`);
  }

  async archiveByQuery(query, label, maxResults = null) {
    const messages = await this.getMessages(query, maxResults);
    
    if (messages.length === 0) {
      console.log(`No messages found for query: "${query}"`);
      return;
    }
    
    console.log(`\n📥 Archiving ${messages.length} messages...\n`);
    
    // Process in batches
    const batches = [];
    for (let i = 0; i < messages.length; i += this.messagesPerFile) {
      batches.push(messages.slice(i, i + this.messagesPerFile));
    }
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`  📝 Processing batch ${i + 1}/${batches.length} (${batches[i].length} messages)`);
      await this.saveMessages(batches[i], label, i);
    }
  }

  async archive(options = {}) {
    await this.ensureOutputDirectory();
    
    const { 
      query = '', 
      maxResults = null,
      includeSpam = false,
      includeTrash = false 
    } = options;
    
    // Build query
    let fullQuery = query;
    if (!includeSpam) {
      fullQuery += ' -in:spam';
    }
    if (!includeTrash) {
      fullQuery += ' -in:trash';
    }
    if (this.excludePromotions) {
      fullQuery += ' -category:promotions -category:social -category:updates';
    }
    
    await this.archiveByQuery(fullQuery.trim(), 'all', maxResults);
    
    console.log(`\n✨ Archive complete!`);
    console.log(`   Output directory: ${path.resolve(this.outputDir)}`);
  }

  async archiveByLabels() {
    await this.ensureOutputDirectory();
    
    const labels = await this.getLabels();
    console.log(`\n📊 Found ${labels.length} labels\n`);
    
    for (const label of labels) {
      if (label.type === 'system' && ['SPAM', 'TRASH', 'DRAFT'].includes(label.id)) {
        console.log(`⏭️  Skipping ${label.name}`);
        continue;
      }
      
      console.log(`\n📂 Processing label: ${label.name}`);
      await this.archiveByQuery(`label:${label.id}`, label.name.replace(/[^a-z0-9]/gi, '_'));
    }
    
    console.log(`\n✨ Archive complete!`);
    console.log(`   Output directory: ${path.resolve(this.outputDir)}`);
  }
}

async function promptForOptions() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\nArchive Options:');
    console.log('1. Archive personal emails (excludes promotions/marketing)');
    console.log('2. Archive all emails (including promotions)');
    console.log('3. Archive by labels/folders');
    console.log('4. Archive with custom search query');
    console.log('5. Archive recent emails only\n');
    
    rl.question('Select option (1-5): ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptForQuery() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\nExample queries:');
    console.log('  from:someone@example.com');
    console.log('  subject:"important"');
    console.log('  after:2024/1/1');
    console.log('  has:attachment\n');
    
    rl.question('Enter search query: ', (query) => {
      rl.close();
      resolve(query);
    });
  });
}

async function promptForAdvancedOptions() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\nAdvanced Options:');
    rl.question('Include HTML markup/styling? (y/N): ', (markup) => {
      const includeMarkup = markup.toLowerCase().startsWith('y');
      rl.close();
      resolve({ includeMarkup });
    });
  });
}

async function main() {
  console.log('📧 Gmail Archiver\n');
  console.log('This tool will download your Gmail messages to clean text files.\n');
  console.log('By default, HTML markup and promotional emails are excluded for cleaner archives.\n');
  
  try {
    const auth = await authenticate(['https://www.googleapis.com/auth/gmail.readonly']);
    const option = await promptForOptions();
    
    // Get advanced options for certain choices
    let advancedOptions = {};
    if (['2', '4'].includes(option)) {
      advancedOptions = await promptForAdvancedOptions();
    }
    
    const archiverOptions = {
      excludePromotions: option === '1', // Only exclude for personal emails option
      ...advancedOptions
    };
    
    const archiver = new GmailArchiver(auth, archiverOptions);
    
    switch(option) {
      case '1':
        console.log('\n🔄 Archiving personal emails (excluding promotions/marketing)...\n');
        console.log('📧 This will focus on emails between real people');
        console.log('❌ Excludes: promotions, social notifications, updates, spam, trash\n');
        await archiver.archive();
        break;
        
      case '2':
        console.log('\n🔄 Archiving all emails (including promotions)...\n');
        await archiver.archive();
        break;
        
      case '3':
        console.log('\n🔄 Archiving by labels...\n');
        await archiver.archiveByLabels();
        break;
        
      case '4':
        const query = await promptForQuery();
        console.log(`\n🔄 Archiving with query: "${query}"...\n`);
        await archiver.archive({ query });
        break;
        
      case '5':
        console.log('\n🔄 Archiving emails from last 30 days...\n');
        const date = new Date();
        date.setDate(date.getDate() - 30);
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');
        await archiver.archive({ query: `after:${dateStr}` });
        break;
        
      default:
        console.log('Invalid option selected');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = GmailArchiver;