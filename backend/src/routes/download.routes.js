const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { watermarkPDF } = require('../services/watermark.service');

// GET /api/papers/:id/download — Invigilator only, post-release
router.get('/:id/download', authenticate, requireRole('invigilator'), async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Fetch the paper
    const paper = await prisma.paper.findFirst({
      where: { id, isDeleted: false },
    });

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // 2. Check invigilator has permission for this paper
    const permission = await prisma.paperPermission.findFirst({
      where: {
        paperId: id,
        userId,
        isActive: true,
      },
    });

    if (!permission) {
      await logAuditEvent('PAPER_ACCESSED', userId, id, {
        action: 'DOWNLOAD_DENIED',
        reason: 'No permission assigned',
        ip: req.ip,
      });
      return res.status(403).json({ error: 'You do not have permission to access this paper' });
    }

    // 3. Check paper is released
    if (!paper.isReleased) {
      await logAuditEvent('PAPER_ACCESSED', userId, id, {
        action: 'DOWNLOAD_DENIED',
        reason: 'Paper not yet released',
        releaseAt: paper.releaseAt,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Paper is not yet available. Please wait for the scheduled release time.',
        releaseAt: paper.releaseAt,
      });
    }

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

    // 7. Record the download in the database
    await prisma.download.create({
      data: {
        paperId: id,
        userId,
        downloadToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    // 8. Log the download event in audit trail
    await logAuditEvent('PAPER_DOWNLOADED', userId, id, {
      downloadToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      invigilatorEmail: invigilator.email,
      paperTitle: paper.title,
    });

    // 9. Serve the watermarked PDF
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