const { decryptMessage } = require('../helpers/crypto');

const decryptedDatas=(req)=>{
const { encryptedData, iv } = req.body
    if (!encryptedData || !iv) {
      return res.status(400).json({ message: 'Missing encrypted data or IV' })
    }

    return JSON.parse(decryptMessage(encryptedData, iv)); // Ensure decryptedData is parsed JSON
};

module.exports = {decryptedDatas};

