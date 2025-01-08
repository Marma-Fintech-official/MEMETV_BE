const CryptoJS = require('crypto-js');
require('dotenv').config(); // Load environment variables from .env

const secretKey = process.env.SECRET_KEY; // Retrieve the key from .env
const iv = CryptoJS.enc.Utf8.parse("myInitVector1234"); // 16 characters for AES-128

const decryptMessage = (encryptedMessage) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, CryptoJS.enc.Utf8.parse(secretKey), {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    const decryptedMessage = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedMessage) throw new Error('Decryption failed');
    return decryptedMessage;
  } catch (error) {
    console.error(`Decryption error: ${error.message}`);
    throw new Error('Decryption failed or invalid input');
  }
};

const encryptMessage = (message) => {
  try {
    const encrypted = CryptoJS.AES.encrypt(message, CryptoJS.enc.Utf8.parse(secretKey), {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const encryptedData = encrypted.toString();
    const ivString = iv;
    return { encryptedData, ivString };
  } catch (error) {
    console.error(`Encryption error: ${error.message}`);
    throw new Error('Encryption failed');
  }
};

module.exports = { decryptMessage, encryptMessage };


