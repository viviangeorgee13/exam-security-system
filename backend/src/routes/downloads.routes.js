const express = require('express');
const router = express.Router();
const { prisma } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin, isSuperAdmin } = require('../middleware/role.middleware');

// GET /api/downloads — get all downloads (Admin/Super Admin)
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const where = req.user.role === 'invigilator' ? { userId: req.user.id } : {};
    const downloads = await prisma.download.findMany({
      where,
      include: {
        paper: { select: { id: true, title: true, subject: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { downloadedAt: 'desc' },
      take: 100,
    });
    res.json(downloads);
  } catch (err) {
    console.error('[DOWNLOADS] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch downloads' });
  }
});

// GET /api/downloads/my — get current user's downloads (any role)
router.get('/my', authenticate, async (req, res) => {
  try {
    const downloads = await prisma.download.findMany({
      where: { userId: req.user.id },
      include: {
        paper: { select: { id: true, title: true, subject: true } },
      },
      orderBy: { downloadedAt: 'desc' },
    });
    res.json(downloads);
  } catch (err) {
    console.error('[DOWNLOADS] My error:', err.message);
    res.status(500).json({ error: 'Failed to fetch your downloads' });
  }
});

// GET /api/downloads/verify/:token — verify a download token
router.get('/verify/:token', authenticate, async (req, res) => {
  try {
    const { token } = req.params;
    const download = await prisma.download.findFirst({
      where: { downloadToken: token },
      include: {
        paper: { select: { title: true, subject: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (!download) {
      return res.status(404).json({ valid: false, message: 'Token not found' });
    }

    res.json({
      valid: true,
      paper: download.paper.title,
      subject: download.paper.subject,
      downloadedBy: download.user.name,
      email: download.user.email,
      downloadedAt: download.downloadedAt,
      ipAddress: download.ipAddress,
    });
  } catch (err) {
    console.error('[DOWNLOADS] Verify error:', err.message);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

module.exports = router;