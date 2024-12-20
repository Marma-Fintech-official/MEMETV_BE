const CryptoJS = require('crypto-js')

const key = CryptoJS.enc.Utf8.parse('mySuperSecureEncryptionKey123!')
const iv = CryptoJS.enc.Utf8.parse('mySuperSecureEncryptionKey123!')

const encryptCommon = {
  encryptId: (str) => {
    // Encrypt the string using AES with CBC mode and PKCS7 padding
    const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(str), key, {
      keySize: 128 / 8,
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })
    // Return the encrypted string in Base64 format
    return encrypted.toString()
  },

  decryptId: (str) => {
    try {
      // Decrypt the string using AES with the same key, iv, and options
      const decrypted = CryptoJS.AES.decrypt(str, key, {
        keySize: 128 / 8,
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      })
      // Convert the decrypted result to a UTF-8 string
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8)

      // Check if the result is empty or invalid and return null or an empty string
      if (!decryptedStr) {
        throw new Error('Decryption failed: Invalid data')
      }
      
      return decryptedStr
    } catch (ex) {
      console.error('Error decrypting:', ex.message)
      return null // Return null if decryption fails
    }
  }
}

module.exports = { encryptCommon }
