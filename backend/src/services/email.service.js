const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
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
async function sendAnomalyAlert(adminEmail, userName, paperTitle, riskScore, reasons) {
  const subject = `🚨 SECURITY ALERT: Anomaly Detected (Risk Score: ${riskScore})`;
  const reasonList = reasons.map(r => `<li>${r}</li>`).join('');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Security Anomaly Detected</h2>
      <p>An unusual access pattern has been detected in the Exam Security System.</p>
      <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <strong>User:</strong> ${userName}<br/>
        <strong>Paper:</strong> ${paperTitle}<br/>
        <strong>Risk Score:</strong> <span style="color: #dc2626; font-size: 18px;">${riskScore}</span><br/>
        <strong>Triggered at:</strong> ${new Date().toLocaleString()}
      </div>
      <h3>Reasons Flagged:</h3>
      <ul>${reasonList}</ul>
      <p>Please log in to the system to investigate and resolve this alert.</p>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
}
async function sendDownloadOtp(email, name, paperTitle, otp) {
  const subject = 'ExamSecure – Paper Download OTP';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">Paper Download Verification</h2>
      <p>Hello ${name},</p>
      <p>Your OTP for downloading the following examination paper is:</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px 0;">${paperTitle}</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; margin: 0;">${otp}</p>
      </div>
      <p>This OTP is valid for <strong>5 minutes</strong> and can be used only once.</p>
      <p style="color: #b91c1c; font-size: 13px;">
        If you did not request this download, please contact the system administrator immediately.
      </p>
      <p style="color: #6b7280; font-size: 12px;">Regards,<br/>ExamSecure</p>
    </div>
  `;
  return sendEmail(email, subject, html);
}

module.exports = { sendEmail, sendPaperReleaseNotification, sendAnomalyAlert, sendDownloadOtp };