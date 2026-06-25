const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MASTER_KEY = Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'utf8');

function encryptPaper(fileBuffer) {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  return { encrypted, aesKey, iv, fileHash };
}

function encryptAesKey(aesKey, iv) {
  const masterIv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', MASTER_KEY, masterIv);
  const encryptedKey = Buffer.concat([cipher.update(aesKey), cipher.final()]);
  return {
    encryptedAesKey: encryptedKey.toString('hex'),
    masterIv: masterIv.toString('hex'),
    ivHex: iv.toString('hex'),
  };
}

function decryptAesKey(encryptedAesKeyHex, masterIvHex) {
  const masterIv = Buffer.from(masterIvHex, 'hex');
  const encryptedAesKey = Buffer.from(encryptedAesKeyHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', MASTER_KEY, masterIv);
  const aesKey = Buffer.concat([decipher.update(encryptedAesKey), decipher.final()]);
  return aesKey;
}

function decryptPaper(encryptedBuffer, aesKey, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted;
}

function saveEncryptedFile(encryptedBuffer, paperId) {
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, `${paperId}.enc`);
  fs.writeFileSync(filePath, encryptedBuffer);
  return filePath;
}

function readEncryptedFile(filePath) {
  return fs.readFileSync(filePath);
}

module.exports = {
  encryptPaper,
  encryptAesKey,
  decryptAesKey,
  decryptPaper,
  saveEncryptedFile,
  readEncryptedFile,
};