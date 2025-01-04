const CryptoJS = require('crypto-js');
require('dotenv').config(); // Load environment variables from .env

const secretKey = process.env.SECRET_KEY; // Retrieve the key from .env
const iv = CryptoJS.enc.Utf8.parse("myInitVector1234"); // 16 characters for AES-128

const decryptMessage = (encryptedMessage) => {
  const decrypted = CryptoJS.AES.decrypt(encryptedMessage, CryptoJS.enc.Utf8.parse(secretKey), {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
};

const encryptMessage = (message) => {
  const encrypted = CryptoJS.AES.encrypt(message, CryptoJS.enc.Utf8.parse(secretKey), {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const encryptedData = encrypted.toString();
  const ivString = iv;
  return { encryptedData, ivString };
};

module.exports = { decryptMessage, encryptMessage };

