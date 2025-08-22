const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const CREDENTIALS_PATH = './credentials.json';
const TOKEN_PATH = './token.json';

async function authenticate(scopes) {
  try {
    // Load client credentials
    const credentials = await loadCredentials();
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    // Check if token already exists
    try {
      const token = await fs.readFile(TOKEN_PATH, 'utf8');
      oAuth2Client.setCredentials(JSON.parse(token));
      return oAuth2Client;
    } catch (error) {
      // Token doesn't exist or is invalid, get new one
      return await getNewToken(oAuth2Client, scopes);
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    console.log('\n📝 Setup required! Please run: npm run auth');
    process.exit(1);
  }
}

async function loadCredentials() {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`
❌ credentials.json not found!

Please follow these steps:
1. Go to https://console.cloud.google.com/
2. Create a project or select existing one
3. Enable Gmail API and Calendar API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Choose "Desktop application"
6. Download the JSON file and save as "credentials.json" in this directory
`);
  }
}

async function getNewToken(oAuth2Client, scopes) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  
  console.log('🔐 Authorize this app by visiting this URL:');
  console.log('\n' + authUrl + '\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve, reject) => {
    rl.question('Enter the authorization code from that page here: ', async (code) => {
      rl.close();
      
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        
        // Store the token for future use
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        console.log('✅ Token stored successfully!\n');
        
        resolve(oAuth2Client);
      } catch (error) {
        console.error('Error retrieving access token:', error);
        reject(error);
      }
    });
  });
}

module.exports = {
  authenticate,
  loadCredentials,
  CREDENTIALS_PATH,
  TOKEN_PATH
};