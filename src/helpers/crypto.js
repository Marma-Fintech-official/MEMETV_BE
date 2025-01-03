const CryptoJS = require('crypto-js');

const secretKey = "mySecretKey12345"; // 16 characters for AES-128
const iv = CryptoJS.enc.Utf8.parse("myInitVector1234"); // 16 characters for AES-128   // Use Utf8-Encoder.

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
    const encryptedData =encrypted.toString();
    const ivString =iv
    return { encryptedData, ivString };
    // return encrypted.toString();
  };

  module.exports ={decryptMessage, encryptMessage}
