#!/usr/bin/env node

const { WebClient } = require('@slack/web-api');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

class SlackArchiver {
  constructor(token) {
    this.client = new WebClient(token);
    this.outputDir = './slack-archive';
    this.userCache = new Map(); // Cache user info to reduce API calls
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`📁 Output directory created: ${this.outputDir}`);
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
  }

  async getConversations() {
    try {
      const conversations = [];
      let cursor;
      
      console.log('🔍 Fetching conversations...');
      
      do {
        const result = await this.client.conversations.list({
          types: 'public_channel,private_channel,mpim,im',
          limit: 200,
          cursor: cursor
        });
        
        conversations.push(...result.channels);
        cursor = result.response_metadata?.next_cursor;
      } while (cursor);
      
      console.log(`✅ Found ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  async getConversationHistory(channelId, channelName) {
    try {
      const messages = [];
      let cursor;
      
      console.log(`  📝 Fetching messages for: ${channelName}`);
      
      do {
        const result = await this.client.conversations.history({
          channel: channelId,
          limit: 200,
          cursor: cursor
        });
        
        messages.push(...result.messages);
        cursor = result.response_metadata?.next_cursor;
        
        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } while (cursor);
      
      // Sort messages by timestamp (oldest first)
      messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
      
      console.log(`    ✓ Retrieved ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error(`Error fetching history for ${channelName}:`, error.message);
      return [];
    }
  }

  async getUserInfo(userId) {
    // Check cache first
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId);
    }
    
    try {
      const result = await this.client.users.info({ user: userId });
      this.userCache.set(userId, result.user);
      return result.user;
    } catch (error) {
      return null;
    }
  }

  async formatMessage(message) {
    let formatted = '';
    const timestamp = new Date(parseFloat(message.ts) * 1000);
    const dateStr = timestamp.toISOString().replace('T', ' ').substring(0, 19);
    
    // Get user name if available
    let userName = 'Unknown User';
    if (message.user) {
      const userInfo = await this.getUserInfo(message.user);
      userName = userInfo?.real_name || userInfo?.name || message.user;
    } else if (message.bot_id) {
      userName = `Bot (${message.username || message.bot_id})`;
    } else if (message.username) {
      userName = message.username;
    }
    
    formatted += `[${dateStr}] ${userName}:\n`;
    formatted += message.text || '(No text content)';
    
    // Handle attachments
    if (message.attachments && message.attachments.length > 0) {
      formatted += '\n  Attachments:';
      message.attachments.forEach((att, i) => {
        formatted += `\n    ${i + 1}. ${att.title || att.fallback || 'Attachment'}`;
      });
    }
    
    // Handle files
    if (message.files && message.files.length > 0) {
      formatted += '\n  Files:';
      message.files.forEach((file, i) => {
        formatted += `\n    ${i + 1}. ${file.name} (${file.mimetype})`;
      });
    }
    
    // Handle thread replies
    if (message.reply_count && message.reply_count > 0) {
      formatted += `\n  [Thread with ${message.reply_count} replies]`;
    }
    
    formatted += '\n\n';
    return formatted;
  }

  async saveConversation(conversation, messages) {
    const channelName = conversation.name || conversation.id;
    const fileName = `${channelName.replace(/[^a-z0-9]/gi, '_')}.txt`;
    const filePath = path.join(this.outputDir, fileName);
    
    let content = `# Slack Archive: ${channelName}\n`;
    content += `# Channel ID: ${conversation.id}\n`;
    content += `# Exported: ${new Date().toISOString()}\n`;
    content += `# Total Messages: ${messages.length}\n`;
    content += '# ' + '='.repeat(50) + '\n\n';
    
    for (const message of messages) {
      content += await this.formatMessage(message);
    }
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`    💾 Saved to: ${fileName}`);
  }

  async archive() {
    await this.ensureOutputDirectory();
    
    const conversations = await this.getConversations();
    
    if (conversations.length === 0) {
      console.log('No conversations found or unable to access.');
      return;
    }
    
    console.log(`\n📥 Starting archive of ${conversations.length} conversations...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const conversation of conversations) {
      const channelName = conversation.name || conversation.id;
      
      try {
        const messages = await this.getConversationHistory(conversation.id, channelName);
        
        if (messages.length > 0) {
          await this.saveConversation(conversation, messages);
          successCount++;
        } else {
          console.log(`    ⚠️  No messages or no access to: ${channelName}`);
        }
      } catch (error) {
        console.error(`    ❌ Error processing ${channelName}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n✨ Archive complete!`);
    console.log(`   Successfully archived: ${successCount} conversations`);
    if (errorCount > 0) {
      console.log(`   Failed: ${errorCount} conversations`);
    }
    console.log(`   Output directory: ${path.resolve(this.outputDir)}`);
  }
}

async function promptForToken() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('Enter your Slack Token (xoxp-... or xoxb-...): ', (token) => {
      rl.close();
      resolve(token);
    });
  });
}

async function main() {
  console.log('🚀 Slack Conversation Archiver\n');
  console.log('This tool will download your accessible Slack conversations to text files.\n');
  console.log('Quick Setup:');
  console.log('1. Create a Slack app at https://api.slack.com/apps');
  console.log('2. For FULL ACCESS to all your channels:');
  console.log('   → Add scopes to "User Token Scopes" (recommended)');
  console.log('   → Get User Token (xoxp-...)');
  console.log('3. For LIMITED ACCESS (bot must be invited to each channel):');
  console.log('   → Add scopes to "Bot Token Scopes"');
  console.log('   → Get Bot Token (xoxb-...)');
  console.log('   → Manually invite bot to channels with /invite @BotName');
  console.log('\nRequired scopes: channels:history, channels:read, groups:history,');
  console.log('groups:read, im:history, im:read, mpim:history, mpim:read, users:read\n');
  
  // Check for token in environment variable or prompt
  let token = process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN;
  
  if (!token) {
    token = await promptForToken();
  }
  
  if (!token || (!token.startsWith('xoxp-') && !token.startsWith('xoxb-'))) {
    console.error('❌ Invalid token. Please provide a valid Slack token (xoxp-... or xoxb-...)');
    process.exit(1);
  }
  
  const tokenType = token.startsWith('xoxb-') ? 'Bot' : 'User';
  console.log(`\n✅ Using ${tokenType} Token\n`);
  
  const archiver = new SlackArchiver(token);
  await archiver.archive();
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = SlackArchiver;