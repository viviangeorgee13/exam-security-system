const express = require('express');
const router = express.Router();
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/role.middleware');

// POST /api/papers/:id/permissions — Assign invigilator to a paper (Admin only)
router.post('/:id/permissions', authenticate, isAdmin, async (req, res) => {
  try {
    const { id: paperId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Verify the paper exists
    const paper = await prisma.paper.findFirst({
      where: { id: paperId, isDeleted: false },
    });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Verify the target user exists and is an invigilator
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUser.role !== 'invigilator') {
      return res.status(400).json({ error: 'Permissions can only be assigned to invigilators' });
    }
    if (!targetUser.isActive) {
      return res.status(400).json({ error: 'Cannot assign permissions to a deactivated user' });
    }

    // Check if permission already exists
    const existing = await prisma.paperPermission.findUnique({
      where: { paperId_userId: { paperId, userId } },
    });

    if (existing) {
      if (existing.isActive) {
        return res.status(409).json({ error: 'This invigilator already has access to this paper' });
      }
      // Re-activate a previously revoked permission
      const reactivated = await prisma.paperPermission.update({
        where: { paperId_userId: { paperId, userId } },
        data: {
          isActive: true,
          revokedAt: null,
          grantedBy: req.user.id,
          grantedAt: new Date(),
        },
      });

      await logAuditEvent('PERMISSION_GRANTED', req.user.id, paperId, {
        action: 'PERMISSION_REACTIVATED',
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        paperTitle: paper.title,
      });

      return res.json({
        message: 'Access restored successfully',
        permission: reactivated,
      });
    }

    // Create new permission
    const permission = await prisma.paperPermission.create({
      data: {
        paperId,
        userId,
        grantedBy: req.user.id,
      },
    });

    await logAuditEvent('PERMISSION_GRANTED', req.user.id, paperId, {
      action: 'PERMISSION_GRANTED',
      targetUserId: userId,
      targetUserEmail: targetUser.email,
      paperTitle: paper.title,
    });

    res.status(201).json({
      message: `Access granted to ${targetUser.name} for "${paper.title}"`,
      permission: {
        id: permission.id,
        paperId: permission.paperId,
        userId: permission.userId,
        grantedAt: permission.grantedAt,
        isActive: permission.isActive,
        invigilator: {
          name: targetUser.name,
          email: targetUser.email,
        },
      },
    });
  } catch (err) {
    console.error('[PERMISSIONS] Grant error:', err.message);
    res.status(500).json({ error: 'Failed to grant permission' });
  }
});

// DELETE /api/papers/:id/permissions/:userId — Revoke access (Admin only)
router.delete('/:id/permissions/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const { id: paperId, userId } = req.params;

    const paper = await prisma.paper.findFirst({
      where: { id: paperId, isDeleted: false },
    });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const permission = await prisma.paperPermission.findUnique({
      where: { paperId_userId: { paperId, userId } },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (!permission || !permission.isActive) {
      return res.status(404).json({ error: 'Active permission not found for this user and paper' });
    }

    await prisma.paperPermission.update({
      where: { paperId_userId: { paperId, userId } },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    await logAuditEvent('ADMIN_ACTION', req.user.id, paperId, {
      action: 'PERMISSION_REVOKED',
      targetUserId: userId,
      targetUserEmail: permission.user.email,
      paperTitle: paper.title,
      revokedAt: new Date().toISOString(),
    });

    res.json({
      message: `Access revoked for ${permission.user.name}. They can no longer download this paper.`,
    });
  } catch (err) {
    console.error('[PERMISSIONS] Revoke error:', err.message);
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

// GET /api/papers/:id/permissions — List all assigned invigilators (Admin only)
router.get('/:id/permissions', authenticate, isAdmin, async (req, res) => {
  try {
    const { id: paperId } = req.params;

    const paper = await prisma.paper.findFirst({
      where: { id: paperId, isDeleted: false },
    });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const permissions = await prisma.paperPermission.findMany({
      where: { paperId },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true },
        },
        granter: {
          select: { name: true, email: true },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

    res.json({
      paperId,
      paperTitle: paper.title,
      permissions: permissions.map(p => ({
        id: p.id,
        isActive: p.isActive,
        grantedAt: p.grantedAt,
        revokedAt: p.revokedAt,
        invigilator: {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          accountActive: p.user.isActive,
        },
        grantedBy: {
          name: p.granter.name,
          email: p.granter.email,
        },
      })),
    });
  } catch (err) {
    console.error('[PERMISSIONS] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

module.exports = router;