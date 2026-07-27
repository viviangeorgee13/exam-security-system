const express = require('express');
const router = express.Router();
const { prisma, logAuditEvent, verifyHashChain } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin, isSuperAdmin } = require('../middleware/role.middleware');

// GET /api/audit — get all audit logs (Admin/Super Admin)
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    res.json(logs);
  } catch (err) {
    console.error('[AUDIT] Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/audit/verify — verify hash chain integrity
router.get('/verify', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await verifyHashChain();
    res.json(result);
  } catch (err) {
    console.error('[AUDIT] Verify error:', err.message);
    res.status(500).json({ error: 'Failed to verify hash chain' });
  }
});

// GET /api/audit/paper/:id — logs for a specific paper
router.get('/paper/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { paperId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.json(logs);
  } catch (err) {
    console.error('[AUDIT] Paper logs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch paper audit logs' });
  }
});

module.exports = router;