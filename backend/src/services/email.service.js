const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, htmlBody) {
  try {
    const info = await transporter.sendMail({
      from: `"Exam Security System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlBody,
    });
    console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL ERROR] Failed to send to ${to}:`, err.message);
    return false;
  }
}

async function sendPaperReleaseNotification(invigilatorEmail, invigilatorName, paperTitle) {
  const subject = `Paper Now Available: ${paperTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">Exam Paper Now Available</h2>
      <p>Dear ${invigilatorName},</p>
      <p>The following exam paper has been released and is now available for download:</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <strong>Paper:</strong> ${paperTitle}<br/>
        <strong>Released at:</strong> ${new Date().toLocaleString()}
      </div>
      <p>Please log in to the system to download your copy.</p>
      <p style="color: #6b7280; font-size: 12px;">
        This is an automated message from the Exam Security System. Do not reply.
      </p>
    </div>
  `;
  return sendEmail(invigilatorEmail, subject, html);
}

module.exports = { sendEmail, sendPaperReleaseNotification };