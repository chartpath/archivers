#!/usr/bin/env node

const { authenticate } = require('./auth');

async function main() {
  console.log('🔧 Google API Authentication Setup\n');
  
  console.log('This will set up OAuth2 authentication for Gmail and Calendar access.\n');
  
  try {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];
    
    console.log('📋 Required scopes:');
    console.log('  - Gmail: Read access');
    console.log('  - Calendar: Read access\n');
    
    await authenticate(scopes);
    
    console.log('🎉 Authentication setup complete!');
    console.log('\nYou can now run:');
    console.log('  npm run gmail      # Archive Gmail messages');
    console.log('  npm run calendar   # Archive Calendar events');
    
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}