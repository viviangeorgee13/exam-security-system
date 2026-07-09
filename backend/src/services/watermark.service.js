const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const { decryptAesKey, decryptPaper } = require('./encryption.service');

async function watermarkPDF(paper, invigilator, downloadToken) {
  // Step 1: Split the stored encryptedAesKey to get both parts
  const [encryptedAesKeyHex, masterIvHex] = paper.encryptedAesKey.split(':');

  // Step 2: Decrypt the AES key using the master key
  const aesKey = decryptAesKey(encryptedAesKeyHex, masterIvHex);

  // Step 3: Read and decrypt the encrypted file
  const fs = require('fs');
  const encryptedBuffer = fs.readFileSync(paper.encryptedFilePath);
  const decryptedBuffer = decryptPaper(encryptedBuffer, aesKey, paper.aesIv);

  // Step 4: Load the PDF
  const pdfDoc = await PDFDocument.load(decryptedBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const watermarkText = `CONFIDENTIAL | ${invigilator.name} | ${timestamp}`;
  const tokenText = `TOKEN: ${downloadToken}`;

  // Step 5: Stamp every page
  for (const page of pages) {
    const { width, height } = page.getSize();

    // Large diagonal watermark in the centre
    page.drawText(watermarkText, {
      x: width * 0.08,
      y: height * 0.45,
      size: 14,
      font,
      color: rgb(0.85, 0.1, 0.1),
      opacity: 0.22,
      rotate: degrees(45),
    });

    // Small token text at the bottom of every page
    page.drawText(tokenText, {
      x: 20,
      y: 20,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.5,
    });
  }

  // Step 6: Embed invisible metadata for forensic tracing
  pdfDoc.setAuthor(invigilator.name);
  pdfDoc.setSubject(`TOKEN:${downloadToken}|USER:${invigilator.id}|EMAIL:${invigilator.email}`);
  pdfDoc.setKeywords([downloadToken, invigilator.id, invigilator.email, timestamp]);
  pdfDoc.setProducer(`Downloaded by ${invigilator.email} at ${timestamp}`);

  // Step 7: Return the watermarked PDF as a Buffer
  const watermarkedBytes = await pdfDoc.save();
  return Buffer.from(watermarkedBytes);
}

module.exports = { watermarkPDF };