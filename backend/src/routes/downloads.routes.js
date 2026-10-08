const express = require('express');
const router = express.Router();
const { prisma } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/role.middleware');
const { FAILURE_EVENTS } = require('../services/failedAttempt.service');

// GET /api/downloads - all downloads (Admin/Super Admin)
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const downloads = await prisma.download.findMany({
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

// GET /api/downloads/my - current user's downloads (any role)
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

// GET /api/downloads/failed-attempts - every refused download (Admin/Super Admin)
router.get('/failed-attempts', authenticate, isAdmin, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { eventType: { in: [...FAILURE_EVENTS, 'PAPER_ACCESSED'] } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Older refusals were logged as PAPER_ACCESSED with action DOWNLOAD_DENIED
    const failures = logs.filter(l =>
      l.eventType !== 'PAPER_ACCESSED' || l.metadata?.action === 'DOWNLOAD_DENIED'
    );

    // Paper titles come from metadata where recorded, otherwise looked up
    const missingIds = [...new Set(
      failures.filter(f => !f.metadata?.paperTitle && f.paperId).map(f => f.paperId)
    )];
    const papers = missingIds.length
      ? await prisma.paper.findMany({ where: { id: { in: missingIds } }, select: { id: true, title: true } })
      : [];
    const titleById = Object.fromEntries(papers.map(p => [p.id, p.title]));

    const attempts = failures.map(f => ({
      id: f.id,
      time: f.createdAt,
      eventType: f.eventType,
      reason: f.eventType === 'DOWNLOAD_OTP_EXPIRED' ? 'OTP expired' : (f.metadata?.reason || 'Unknown'),
      paperTitle: f.metadata?.paperTitle || titleById[f.paperId] || 'Unknown paper',
      ip: f.metadata?.ip || null,
      user: f.user ? { id: f.user.id, name: f.user.name, email: f.user.email } : null,
    }));

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const byReasonMap = {};
    const byUserMap = {};

    for (const a of attempts) {
      byReasonMap[a.reason] = (byReasonMap[a.reason] || 0) + 1;
      if (a.user) {
        const u = byUserMap[a.user.id] || { ...a.user, count: 0, last24h: 0, lastAttempt: a.time };
        u.count += 1;
        if (new Date(a.time).getTime() >= dayAgo) u.last24h += 1;
        byUserMap[a.user.id] = u;
      }
    }

    const byUser = Object.values(byUserMap)
      .map(u => ({ ...u, flagged: u.last24h >= 3 }))
      .sort((a, b) => b.count - a.count);

    res.json({
      stats: {
        total: attempts.length,
        last24h: attempts.filter(a => new Date(a.time).getTime() >= dayAgo).length,
        uniqueUsers: byUser.length,
        flaggedUsers: byUser.filter(u => u.flagged).length,
      },
      byReason: Object.entries(byReasonMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      byUser,
      attempts: attempts.slice(0, 100),
    });
  } catch (err) {
    console.error('[FAILED ATTEMPTS] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch failed attempts' });
  }
});

// GET /api/downloads/verify/:token - verify a watermark token
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