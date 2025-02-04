const fs = require('fs');
const { google } = require('googleapis');
require('dotenv').config()

// Load credentials from the credentials.json file
const credentials = require('./credentials.json');

// Replace the placeholder with the actual private key from the environment variable
// const ReplacePrivateKey = process.env.PRIVATE_KEY;
// console.log(ReplacePrivateKey,'ReplacePrivateKey');
// const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n').split('\n').map(line => `'${line}\\n' +`).join('\n');
// console.log(privateKey,'privateKey');




credentials.private_key = process.env.PRIVATE_KEY;
credentials.private_key_id = process.env.PRIVATE_KEY_ID;
credentials.client_id = process.env.CLIENT_ID;

// console.log(credentials);


// JSON file containing promo codes
const promoData = require('./promocodes.json');
const { log } = require('console');

// Extract promo codes, rewards, and statuses from JSON
const promoCodes = promoData.map(item => [item.promoCode, item.reward, item.status]);

// Configure Google Sheets API
async function writePromoCodesToSheet() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1ZAXLtVGdAA6KP6ciUf4H6MH2Srcrq6f92vqWcVAUuK4'; // Replace with your Google Sheet ID
    const range = 'Sheet1!A1:C'; // A, B, and C columns for promoCode, reward, and status

    // Add header row
    const header = [['PROMO CODE', 'REWARD', 'CLAIMED']];
    const data = header.concat(promoCodes);

    // Prepare data for the Google Sheets API
    const resource = {
      values: data,
    };

    // Write promo codes to the sheet
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource,
    });

    console.log('Promo codes successfully written to Google Sheet!');
  } catch (error) {
    console.error('Error writing to Google Sheet:', error);
  }
}

// Run the script
writePromoCodesToSheet();
