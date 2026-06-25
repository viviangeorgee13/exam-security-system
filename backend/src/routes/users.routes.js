const express = require('express');
const bcrypt = require('bcrypt');
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');
const { isSuperAdmin } = require('../middleware/role.middleware');

const router = express.Router();
const SALT_ROUNDS = 12;

// GET /api/users — list all users (Super Admin only)
router.get('/', authenticate, isSuperAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        failedAttempts: true,
        lockedUntil: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — create user (Super Admin only)
router.post('/', authenticate, isSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role are required' });
  }

  const allowedRoles = ['admin', 'invigilator'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${allowedRoles.join(', ')}` });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAuditEvent('ADMIN_ACTION', req.user.id, null, {
      action: 'CREATE_USER',
      targetUserId: user.id,
      targetRole: role,
    });

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id/toggle-active — activate/deactivate (Super Admin only)
router.patch('/:id/toggle-active', authenticate, isSuperAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await logAuditEvent('ADMIN_ACTION', req.user.id, null, {
      action: updated.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      targetUserId: id,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

module.exports = router;