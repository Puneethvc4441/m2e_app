
const dotenv = require('dotenv');
dotenv.config();
const CryptoJS = require('crypto-js');
const encryptWithAES = (ciphertext) => {
    

    try {
      // Encrypt
    //   let ciphertext = CryptoJS.AES.encrypt(seedPhrase, 'secretKey').toString();
    //   console.log(ciphertext, 'console ciphertext');
      // Decrypt
      let bytes = CryptoJS.AES.decrypt(ciphertext, 'secretKey');
      let originalText = bytes.toString(CryptoJS.enc.Utf8);
      return originalText;
    } catch (error) {
      console.log(error, 'err in console');
    }
  };
  module.exports = {
    encryptWithAES
}