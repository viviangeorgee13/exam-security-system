const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma, logAuditEvent } = require('../services/audit.service');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  const refreshToken = jwt.sign(
    { userId, role, tokenType: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      await logAuditEvent('USER_LOGIN_FAILED', user.id, null, {
        reason: 'account_locked',
        ip,
        userAgent,
      });
      return res.status(403).json({
        error: `Account locked. Try again in ${minutesLeft} minute(s).`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated. Contact administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      const newFailedAttempts = user.failedAttempts + 1;
      const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });

      await logAuditEvent('USER_LOGIN_FAILED', user.id, null, {
        failedAttempts: newFailedAttempts,
        ip,
        userAgent,
      });

      if (shouldLock) {
        await logAuditEvent('USER_LOCKED', user.id, null, { ip, userAgent });
        return res.status(403).json({
          error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
          code: 'ACCOUNT_LOCKED',
        });
      }

      const remaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
      return res.status(401).json({
        error: `Invalid credentials. ${remaining} attempt(s) remaining.`,
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        refreshToken: refreshTokenHash,
      },
    });

    await logAuditEvent('USER_LOGIN', user.id, null, { ip, userAgent });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, refreshToken: refreshTokenHash },
    });

    if (!user) return res.status(401).json({ error: 'Invalid or revoked refresh token' });
    if (!user.isActive) return res.status(403).json({ error: 'Account deactivated' });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);

    const newRefreshTokenHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshTokenHash },
    });

    await logAuditEvent('TOKEN_REFRESHED', user.id, null, { ip: req.ip });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null },
    });

    await logAuditEvent('USER_LOGOUT', req.user.id, null, { ip: req.ip });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  });
});

module.exports = router;