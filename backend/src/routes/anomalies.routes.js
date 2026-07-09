const express = require('express');
const router = express.Router();
const { prisma } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { isSuperAdmin, isAdmin } = require('../middleware/role.middleware');

// GET /api/anomalies — list all anomalies (Super Admin only)
router.get('/', authenticate, isSuperAdmin, async (req, res) => {
  try {
    const anomalies = await prisma.anomaly.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        paper: {
          select: { id: true, title: true, subject: true },
        },
        resolver: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(anomalies);
  } catch (err) {
    console.error('[ANOMALIES] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

// GET /api/anomalies/stats — summary stats (Super Admin only)
router.get('/stats', authenticate, isSuperAdmin, async (req, res) => {
  try {
    const totalAnomalies = await prisma.anomaly.count();
    const unresolvedAnomalies = await prisma.anomaly.count({
      where: { resolved: false },
    });
    const resolvedAnomalies = await prisma.anomaly.count({
      where: { resolved: true },
    });
    const highRiskAnomalies = await prisma.anomaly.count({
      where: { riskScore: { gte: 80 }, resolved: false },
    });

    res.json({
      total: totalAnomalies,
      unresolved: unresolvedAnomalies,
      resolved: resolvedAnomalies,
      highRisk: highRiskAnomalies,
    });
  } catch (err) {
    console.error('[ANOMALIES] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch anomaly stats' });
  }
});

// PATCH /api/anomalies/:id/resolve — mark as resolved (Super Admin only)
router.patch('/:id/resolve', authenticate, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const anomaly = await prisma.anomaly.findUnique({
      where: { id },
    });

    if (!anomaly) {
      return res.status(404).json({ error: 'Anomaly not found' });
    }

    if (anomaly.resolved) {
      return res.status(400).json({ error: 'Anomaly is already resolved' });
    }

    const resolved = await prisma.anomaly.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
      },
      include: {
        user: { select: { name: true, email: true } },
        paper: { select: { title: true } },
        resolver: { select: { name: true, email: true } },
      },
    });

    const { logAuditEvent } = require('../services/audit.service');
    await logAuditEvent('ADMIN_ACTION', req.user.id, anomaly.paperId, {
      action: 'ANOMALY_RESOLVED',
      anomalyId: id,
      riskScore: anomaly.riskScore,
      notes: notes || null,
    });

    res.json({
      message: 'Anomaly marked as resolved',
      anomaly: resolved,
    });
  } catch (err) {
    console.error('[ANOMALIES] Resolve error:', err.message);
    res.status(500).json({ error: 'Failed to resolve anomaly' });
  }
});

module.exports = router;