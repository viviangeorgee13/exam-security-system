const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { watermarkPDF } = require('../services/watermark.service');
const { runAnomalyCheck } = require('../services/anomaly.service');
const { sendDownloadOtp } = require('../services/email.service');

const OTP_TTL_MS = 5 * 60 * 1000;      // OTP valid 5 minutes
const AUTH_TTL_MS = 2 * 60 * 1000;     // Download authorisation valid 2 minutes
const MAX_ATTEMPTS = 5;

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// Shared guard: paper exists, invigilator has permission, paper is released
async function checkDownloadEligibility(paperId, userId, req) {
  const paper = await prisma.paper.findFirst({ where: { id: paperId, isDeleted: false } });
  if (!paper) return { error: { status: 404, body: { error: 'Paper not found' } } };

  const permission = await prisma.paperPermission.findFirst({
    where: { paperId, userId, isActive: true },
  });
  if (!permission) {
    await logAuditEvent('PAPER_ACCESSED', userId, paperId, {
      action: 'DOWNLOAD_DENIED', reason: 'No permission assigned', ip: req.ip,
    });
    return { error: { status: 403, body: { error: 'You do not have permission to access this paper' } } };
  }

  if (!paper.isReleased) {
    await logAuditEvent('PAPER_ACCESSED', userId, paperId, {
      action: 'DOWNLOAD_DENIED', reason: 'Paper not yet released', releaseAt: paper.releaseAt, ip: req.ip,
    });
    return { error: { status: 403, body: { error: 'Paper is not yet available. Please wait for the scheduled release time.', releaseAt: paper.releaseAt } } };
  }

  return { paper };
}

// ─── POST /api/papers/:id/request-download-otp ────────────────────────────────
router.post('/:id/request-download-otp', authenticate, requireRole('invigilator'), async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const { error, paper } = await checkDownloadEligibility(id, userId, req);
    if (error) return res.status(error.status).json(error.body);

    // Invalidate any previous unused OTPs for this user + paper
    await prisma.downloadOtp.updateMany({
      where: { userId, paperId: id, used: false },
      data: { used: true },
    });

    const otp = String(crypto.randomInt(100000, 1000000)); // always 6 digits
    await prisma.downloadOtp.create({
      data: {
        userId,
        paperId: id,
        otpHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const sent = await sendDownloadOtp(user.email, user.name, paper.title, otp);

    await logAuditEvent('DOWNLOAD_OTP_REQUESTED', userId, id, {
      paperTitle: paper.title,
      emailSent: sent,
      ip: req.ip,
    });

    if (!sent) {
      return res.status(500).json({ error: 'Could not send OTP email. Please try again.' });
    }

    // Masked hint only — never the OTP itself
    const masked = user.email.replace(/^(.{2}).*(@.*)$/, '$1••••$2');
    res.json({ success: true, message: `OTP sent to your registered email address (${masked}).` });
  } catch (err) {
    console.error('[OTP] Request error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// ─── POST /api/papers/:id/verify-download-otp ─────────────────────────────────
router.post('/:id/verify-download-otp', authenticate, requireRole('invigilator'), async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;
  const userId = req.user.id;
  try {
    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP.' });
    }

    const { error } = await checkDownloadEligibility(id, userId, req);
    if (error) return res.status(error.status).json(error.body);

    const record = await prisma.downloadOtp.findFirst({
      where: { userId, paperId: id, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      await logAuditEvent('DOWNLOAD_OTP_VERIFICATION_FAILED', userId, id, { reason: 'No active OTP', ip: req.ip });
      return res.status(400).json({ error: 'No active OTP. Please request a new OTP.' });
    }

    if (record.expiresAt < new Date()) {
      await prisma.downloadOtp.update({ where: { id: record.id }, data: { used: true } });
      await logAuditEvent('DOWNLOAD_OTP_EXPIRED', userId, id, { ip: req.ip });
      return res.status(400).json({ error: 'OTP expired. Please request a new OTP.', code: 'OTP_EXPIRED' });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await prisma.downloadOtp.update({ where: { id: record.id }, data: { used: true } });
      await logAuditEvent('DOWNLOAD_OTP_VERIFICATION_FAILED', userId, id, { reason: 'Too many attempts', ip: req.ip });
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    if (record.otpHash !== hashOtp(String(otp).trim())) {
      const updated = await prisma.downloadOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      await logAuditEvent('DOWNLOAD_OTP_VERIFICATION_FAILED', userId, id, {
        reason: 'Incorrect OTP', attempt: updated.attempts, ip: req.ip,
      });
      return res.status(400).json({
        error: `Invalid OTP. ${MAX_ATTEMPTS - updated.attempts} attempt(s) remaining.`,
      });
    }

    // Correct — consume OTP and issue a short-lived one-time download authorisation
    const downloadAuth = crypto.randomUUID();
    await prisma.downloadOtp.update({
      where: { id: record.id },
      data: {
        used: true,
        downloadAuth,
        authUsed: false,
        authExpiresAt: new Date(Date.now() + AUTH_TTL_MS),
      },
    });

    await logAuditEvent('DOWNLOAD_OTP_VERIFICATION_SUCCESS', userId, id, { ip: req.ip });

    res.json({ success: true, downloadAuth });
  } catch (err) {
    console.error('[OTP] Verify error:', err.message);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ─── GET /api/papers/:id/download — now requires a valid OTP authorisation ────
router.get('/:id/download', authenticate, requireRole('invigilator'), async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Fetch the paper
    const paper = await prisma.paper.findFirst({ where: { id, isDeleted: false } });
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    // 2. Permission check
    const permission = await prisma.paperPermission.findFirst({
      where: { paperId: id, userId, isActive: true },
    });
    if (!permission) {
      await logAuditEvent('PAPER_ACCESSED', userId, id, {
        action: 'DOWNLOAD_DENIED', reason: 'No permission assigned', ip: req.ip,
      });
      return res.status(403).json({ error: 'You do not have permission to access this paper' });
    }

    // 3. Release check
    if (!paper.isReleased) {
      await logAuditEvent('PAPER_ACCESSED', userId, id, {
        action: 'DOWNLOAD_DENIED', reason: 'Paper not yet released', releaseAt: paper.releaseAt, ip: req.ip,
      });
      return res.status(403).json({
        error: 'Paper is not yet available. Please wait for the scheduled release time.',
        releaseAt: paper.releaseAt,
      });
    }

    // 3b. OTP authorisation check — no valid OTP, no download
    const auth = req.query.auth;
    if (!auth) {
      await logAuditEvent('PAPER_ACCESSED', userId, id, {
        action: 'DOWNLOAD_DENIED', reason: 'OTP verification required', ip: req.ip,
      });
      return res.status(403).json({ error: 'OTP verification required before download.', code: 'OTP_REQUIRED' });
    }

    const authRecord = await prisma.downloadOtp.findFirst({
      where: { downloadAuth: String(auth), userId, paperId: id, authUsed: false },
    });
    if (!authRecord || !authRecord.authExpiresAt || authRecord.authExpiresAt < new Date()) {
      await logAuditEvent('PAPER_ACCESSED', userId, id, {
        action: 'DOWNLOAD_DENIED', reason: 'Invalid or expired download authorisation', ip: req.ip,
      });
      return res.status(403).json({ error: 'Download authorisation invalid or expired. Please verify OTP again.', code: 'OTP_REQUIRED' });
    }

    // Consume the authorisation immediately — single use
    await prisma.downloadOtp.update({ where: { id: authRecord.id }, data: { authUsed: true } });

    // 4. Fetch invigilator details for watermark
    const invigilator = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    // 5. Generate a unique download token
    const downloadToken = crypto.randomUUID();

    // 6. Apply watermark
    let watermarkedPDF;
    try {
      watermarkedPDF = await watermarkPDF(paper, invigilator, downloadToken);
    } catch (wmErr) {
      console.error('[DOWNLOAD] Watermarking failed:', wmErr.message);
      return res.status(500).json({ error: 'Failed to watermark paper. Contact administrator.' });
    }

    // 7. Record the download
    await prisma.download.create({
      data: {
        paperId: id,
        userId,
        downloadToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    // 8. Audit trail
    await logAuditEvent('PAPER_DOWNLOADED', userId, id, {
      downloadToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      invigilatorEmail: invigilator.email,
      paperTitle: paper.title,
      otpVerified: true,
    });

    // 9. Anomaly check in background
    runAnomalyCheck(userId, id, req.ip).catch(err =>
      console.error('[ANOMALY] Background check failed:', err.message)
    );

    // 10. Serve the watermarked PDF
    const filename = `exam_${paper.subject.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', watermarkedPDF.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.send(watermarkedPDF);

  } catch (err) {
    console.error('[DOWNLOAD] Unexpected error:', err.message);
    res.status(500).json({ error: 'Download failed. Please try again.' });
  }
});

module.exports = router;