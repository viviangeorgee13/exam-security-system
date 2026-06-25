const express = require('express');
const router = express.Router();
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// PATCH /api/papers/:id/schedule
// Set or update the release time for a paper (Admin only)
router.patch('/:id/schedule', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { releaseAt } = req.body;

    if (!releaseAt) {
      return res.status(400).json({ error: 'releaseAt timestamp is required' });
    }

    const releaseDate = new Date(releaseAt);
    if (isNaN(releaseDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format for releaseAt' });
    }

    const paper = await prisma.paper.findFirst({
      where: { id, isDeleted: false },
    });

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    if (req.user.role === 'admin' && paper.uploadedBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only schedule your own papers' });
    }

    if (paper.isReleased) {
      return res.status(400).json({ error: 'Paper has already been released. Cannot reschedule.' });
    }

    const updated = await prisma.paper.update({
      where: { id },
      data: {
        releaseAt: releaseDate,
        isReleased: false,
      },
    });

    await logAuditEvent('ADMIN_ACTION', req.user.id, id, {
      action: 'PAPER_SCHEDULED',
      releaseAt: releaseDate.toISOString(),
      paperTitle: paper.title,
      scheduledBy: req.user.email,
    });

    res.json({
      message: 'Release time updated successfully',
      paper: {
        id: updated.id,
        title: updated.title,
        releaseAt: updated.releaseAt,
        isReleased: updated.isReleased,
      },
    });
  } catch (err) {
    console.error('[SCHEDULE] Error:', err.message);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// GET /api/papers/:id/status
// Get release status and countdown for a paper
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const paper = await prisma.paper.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        title: true,
        subject: true,
        isReleased: true,
        releaseAt: true,
        examDate: true,
      },
    });

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    if (req.user.role === 'invigilator') {
      const permission = await prisma.paperPermission.findFirst({
        where: {
          paperId: id,
          userId: req.user.id,
          isActive: true,
        },
      });
      if (!permission) {
        return res.status(403).json({ error: 'You do not have access to this paper' });
      }
    }

    const now = new Date();
    let secondsUntilRelease = null;
    let status = 'locked';

    if (paper.isReleased) {
      status = 'released';
    } else if (paper.releaseAt) {
      secondsUntilRelease = Math.max(0, Math.floor((paper.releaseAt - now) / 1000));
      status = secondsUntilRelease <= 300 ? 'releasing_soon' : 'locked';
    }

    res.json({
      id: paper.id,
      title: paper.title,
      subject: paper.subject,
      status,
      isReleased: paper.isReleased,
      releaseAt: paper.releaseAt,
      secondsUntilRelease,
      examDate: paper.examDate,
    });
  } catch (err) {
    console.error('[STATUS] Error:', err.message);
    res.status(500).json({ error: 'Failed to get paper status' });
  }
});

module.exports = router;